import { createStore } from 'zustand/vanilla';
import { persist } from 'zustand/middleware';
import { produce } from 'immer';
import { type ACP, type SerializedACP } from './types.js';
import { ACPUtils } from './acp.js';

type ChainRecord<T> = Record<number, T>;
type AccountRecord<T> = Record<string, T>;
type HashRecord<T> = Record<string, T>;

type ACPsStore = {
  acps: ChainRecord<AccountRecord<HashRecord<SerializedACP | undefined>>>;
  activeACPHash: ChainRecord<AccountRecord<string | undefined>>;
};

// Stores generated acps for each user, a hash indicating the active acp for each user
// Can be used to create reactive hooks
export const ACP_STORE_DEFAULTS: ACPsStore = {
  acps: {},
  activeACPHash: {},
};

/**
 * Store version 3 = ACP with flattened sealing keys (sealingPrivateKey/sealingKey).
 * Store version 2 = ACP (ACP V3). V2 acps are signed with retired EIP-712
 * types and cannot verify on-chain anymore — the migration drops them rather
 * than carrying dead entries (users re-create acps on next use).
 */
const ACP_STORE_VERSION = 3;

// `typeof null` and `typeof []` are both 'object', so a bare typeof check lets a broken
// persisted store through. A `null` record then throws on the first `acps[chainId]` lookup.
// Defined above the store: localStorage rehydrates synchronously inside `createStore`.
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value);

// Accounts are addresses, so their case carries no meaning: the same account may arrive
// checksummed (from the wallet client) or lowercased (from an indexer, a URL, user input).
// Resolve to the key the account is already stored under, so a lookup in another case still
// finds it and a write does not split one account's acps across two buckets. A new account
// keeps the spelling it was first written with (the connected wallet's address in practice),
// which is the key the React hooks read from the raw snapshot.
const resolveAccountKey = (records: Record<string, unknown> | undefined, account: string): string => {
  if (records == null || account in records) return account;
  const lower = account.toLowerCase();
  return Object.keys(records).find((key) => key.toLowerCase() === lower) ?? account;
};

export const _acpStore = createStore<ACPsStore>()(
  persist(() => ACP_STORE_DEFAULTS, {
    name: 'cofhesdk-acps',
    version: ACP_STORE_VERSION,
    migrate: (persistedState, version) => {
      if (version < ACP_STORE_VERSION) return ACP_STORE_DEFAULTS;
      return persistedState as ACPsStore;
    },
    // Runs on every rehydrate, including a corrupt state saved at the current version that
    // `migrate` passes through unchanged. Consumers that read the raw snapshot (e.g. the React
    // hooks) never go through `clearStaleStore`, so the shape has to be fixed here.
    merge: (persistedState, currentState) => {
      const persisted = (isRecord(persistedState) ? persistedState : {}) as Partial<ACPsStore>;
      return {
        ...currentState,
        acps: isRecord(persisted.acps) ? persisted.acps : currentState.acps,
        activeACPHash: isRecord(persisted.activeACPHash) ? persisted.activeACPHash : currentState.activeACPHash,
      };
    },
  })
);

export const clearStaleStore = () => {
  // Any is used here because we do not have types of the previous store
  const state = _acpStore.getState() as any;

  // Check if the store has the expected structure
  const hasExpectedStructure = isRecord(state) && isRecord(state.acps) && isRecord(state.activeACPHash);

  if (hasExpectedStructure) return;
  // Invalid structure detected - clear the store
  _acpStore.setState({ acps: {}, activeACPHash: {} });
};

export const getACP = (
  chainId: number | undefined,
  account: string | undefined,
  hash: string | undefined
): ACP | undefined => {
  clearStaleStore();
  if (chainId == null || account == null || hash == null) return;

  const accountACPs = _acpStore.getState().acps[chainId];
  const savedACP = accountACPs?.[resolveAccountKey(accountACPs, account)]?.[hash];
  if (savedACP == null) return;

  return ACPUtils.deserialize(savedACP);
};

export const getActiveACP = (chainId: number | undefined, account: string | undefined): ACP | undefined => {
  clearStaleStore();
  if (chainId == null || account == null) return;

  const activeHashes = _acpStore.getState().activeACPHash[chainId];
  const activeACPHash = activeHashes?.[resolveAccountKey(activeHashes, account)];
  return getACP(chainId, account, activeACPHash);
};

export const getACPs = (chainId: number | undefined, account: string | undefined): Record<string, ACP> => {
  clearStaleStore();
  if (chainId == null || account == null) return {};

  const accountACPs = _acpStore.getState().acps[chainId];
  return Object.entries(accountACPs?.[resolveAccountKey(accountACPs, account)] ?? {}).reduce(
    (acc, [hash, acp]) => {
      if (acp == undefined) return acc;
      return { ...acc, [hash]: ACPUtils.deserialize(acp) };
    },
    {} as Record<string, ACP>
  );
};

export const setACP = (chainId: number, account: string, acp: ACP) => {
  clearStaleStore();
  _acpStore.setState(
    produce<ACPsStore>((state) => {
      if (state.acps[chainId] == null) state.acps[chainId] = {};
      const key = resolveAccountKey(state.acps[chainId], account);
      if (state.acps[chainId][key] == null) state.acps[chainId][key] = {};
      state.acps[chainId][key][acp.hash] = ACPUtils.serialize(acp);
    })
  );
};

export const removeACP = (chainId: number, account: string, hash: string) => {
  clearStaleStore();
  _acpStore.setState(
    produce<ACPsStore>((state) => {
      if (state.acps[chainId] == null) state.acps[chainId] = {};
      if (state.activeACPHash[chainId] == null) state.activeACPHash[chainId] = {};

      const accountACPs = state.acps[chainId][resolveAccountKey(state.acps[chainId], account)];
      if (accountACPs == null) return;

      if (accountACPs[hash] == null) return;

      const activeKey = resolveAccountKey(state.activeACPHash[chainId], account);
      if (state.activeACPHash[chainId][activeKey] === hash) {
        // if the active acp is the one to be removed - unset it
        state.activeACPHash[chainId][activeKey] = undefined;
      }
      // Remove the acp
      accountACPs[hash] = undefined;
    })
  );
};

export const getActiveACPHash = (chainId: number | undefined, account: string | undefined): string | undefined => {
  clearStaleStore();
  if (chainId == null || account == null) return undefined;
  const activeHashes = _acpStore.getState().activeACPHash[chainId];
  return activeHashes?.[resolveAccountKey(activeHashes, account)];
};

export const setActiveACPHash = (chainId: number, account: string, hash: string) => {
  clearStaleStore();
  _acpStore.setState(
    produce<ACPsStore>((state) => {
      if (state.activeACPHash[chainId] == null) state.activeACPHash[chainId] = {};
      state.activeACPHash[chainId][resolveAccountKey(state.activeACPHash[chainId], account)] = hash;
    })
  );
};

export const removeActiveACPHash = (chainId: number, account: string) => {
  clearStaleStore();
  _acpStore.setState(
    produce<ACPsStore>((state) => {
      if (state.activeACPHash[chainId])
        state.activeACPHash[chainId][resolveAccountKey(state.activeACPHash[chainId], account)] = undefined;
    })
  );
};

export const resetStore = () => {
  clearStaleStore();
  _acpStore.setState({ acps: {}, activeACPHash: {} });
};

export const acpStore = {
  store: _acpStore,

  getACP,
  getActiveACP,
  getACPs,
  setACP,
  removeACP,

  getActiveACPHash,
  setActiveACPHash,
  removeActiveACPHash,

  resetStore,
};
