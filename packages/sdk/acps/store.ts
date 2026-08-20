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

export const _acpStore = createStore<ACPsStore>()(
  persist(() => ACP_STORE_DEFAULTS, {
    name: 'cofhesdk-acps',
    version: ACP_STORE_VERSION,
    migrate: (persistedState, version) => {
      if (version < ACP_STORE_VERSION) return ACP_STORE_DEFAULTS;
      return persistedState as ACPsStore;
    },
  })
);

export const clearStaleStore = () => {
  // Any is used here because we do not have types of the previous store
  const state = _acpStore.getState() as any;

  // Check if the store has the expected structure
  const hasExpectedStructure =
    state &&
    typeof state === 'object' &&
    'acps' in state &&
    'activeACPHash' in state &&
    typeof state.acps === 'object' &&
    typeof state.activeACPHash === 'object';

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

  const savedACP = _acpStore.getState().acps[chainId]?.[account]?.[hash];
  if (savedACP == null) return;

  return ACPUtils.deserialize(savedACP);
};

export const getActiveACP = (chainId: number | undefined, account: string | undefined): ACP | undefined => {
  clearStaleStore();
  if (chainId == null || account == null) return;

  const activeACPHash = _acpStore.getState().activeACPHash[chainId]?.[account];
  return getACP(chainId, account, activeACPHash);
};

export const getACPs = (chainId: number | undefined, account: string | undefined): Record<string, ACP> => {
  clearStaleStore();
  if (chainId == null || account == null) return {};

  return Object.entries(_acpStore.getState().acps[chainId]?.[account] ?? {}).reduce(
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
      if (state.acps[chainId][account] == null) state.acps[chainId][account] = {};
      state.acps[chainId][account][acp.hash] = ACPUtils.serialize(acp);
    })
  );
};

export const removeACP = (chainId: number, account: string, hash: string) => {
  clearStaleStore();
  _acpStore.setState(
    produce<ACPsStore>((state) => {
      if (state.acps[chainId] == null) state.acps[chainId] = {};
      if (state.activeACPHash[chainId] == null) state.activeACPHash[chainId] = {};

      const accountACPs = state.acps[chainId][account];
      if (accountACPs == null) return;

      if (accountACPs[hash] == null) return;

      if (state.activeACPHash[chainId][account] === hash) {
        // if the active acp is the one to be removed - unset it
        state.activeACPHash[chainId][account] = undefined;
      }
      // Remove the acp
      accountACPs[hash] = undefined;
    })
  );
};

export const getActiveACPHash = (chainId: number | undefined, account: string | undefined): string | undefined => {
  clearStaleStore();
  if (chainId == null || account == null) return undefined;
  return _acpStore.getState().activeACPHash[chainId]?.[account];
};

export const setActiveACPHash = (chainId: number, account: string, hash: string) => {
  clearStaleStore();
  _acpStore.setState(
    produce<ACPsStore>((state) => {
      if (state.activeACPHash[chainId] == null) state.activeACPHash[chainId] = {};
      state.activeACPHash[chainId][account] = hash;
    })
  );
};

export const removeActiveACPHash = (chainId: number, account: string) => {
  clearStaleStore();
  _acpStore.setState(
    produce<ACPsStore>((state) => {
      if (state.activeACPHash[chainId]) state.activeACPHash[chainId][account] = undefined;
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
