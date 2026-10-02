import { concatHex, padHex, size, sliceHex, type Address, type Hex, type Log, type PublicClient } from 'viem';
import type { EventValueLabel, ShareLabel, StoredValueLabel } from './schema.js';

/**
 * - `verified`: the chain confirms the label.
 * - `mismatch`: the chain contradicts it.
 * - `unverifiable`: the chain could not be asked — an unlabelled ctHash, a node without the
 *   state of that block (a stored value needs an archive node once its block is old), or a
 *   failed request.
 */
export type LabelVerification = 'verified' | 'mismatch' | 'unverifiable';

/**
 * How much of a share's labels a reader checks against the chain. Labels are the issuer's claim:
 * - `all` (default): every label — one `getLogs` per contract and block, one call per stored value;
 * - `events`: event values only, which any node can answer however old the block;
 * - `none`: trust the labels as written, no requests (the issuer previewing their own share).
 */
export type ShareLabelVerifyMode = 'all' | 'events' | 'none';

/** A label's verification, or `skipped` when the verify mode leaves it unchecked. */
export type ShareLabelCheck = LabelVerification | 'skipped';

const WORD_BYTES = 32;

const sameWord = (a: Hex, b: Hex): boolean => a.toLowerCase() === b.toLowerCase();

/** The 32-byte words of a byte string, in order. A trailing partial word is left out. */
const wordsOf = (data: Hex): Hex[] => {
  const count = Math.floor(size(data) / WORD_BYTES);
  return Array.from({ length: count }, (_, index) => sliceHex(data, index * WORD_BYTES, (index + 1) * WORD_BYTES));
};

/** The view call a stored-value label names, with the issuer argument filled in. */
const storedCallData = (label: StoredValueLabel, issuer: Address): Hex =>
  concatHex([
    label.selector,
    ...label.args.map((arg) => (arg.type === 'issuer' ? padHex(issuer, { size: WORD_BYTES }) : arg.value)),
  ]);

/** Whether the ctHash is the labelled return word of the call's result. */
const checkStored = (label: StoredValueLabel, handle: Hex, data: Hex | undefined): LabelVerification => {
  const found = data ? wordsOf(data)[label.returnWord] : undefined;
  return found && sameWord(found, handle) ? 'verified' : 'mismatch';
};

/**
 * Whether the labelled log is there and carries the ctHash: among the logs of the contract in the
 * labelled block, the one at the labelled log index must belong to the labelled transaction, its
 * topic0 must start with the labelled selector, and the ctHash must be one of its topics or data
 * words.
 */
const checkEvent = (label: EventValueLabel, handle: Hex, logs: readonly Log[]): LabelVerification => {
  const log = logs.find((l) => l.logIndex === label.logIndex);
  if (log == null) return 'mismatch';
  if (log.transactionIndex !== label.txIndex) return 'mismatch';
  const topic0 = log.topics[0];
  if (topic0 == null || !topic0.toLowerCase().startsWith(label.selector.toLowerCase())) return 'mismatch';
  const carried = [...log.topics.slice(1), ...wordsOf(log.data)].some((word) => word != null && sameWord(word, handle));
  return carried ? 'verified' : 'mismatch';
};

const callAt = async (publicClient: PublicClient, to: Address, data: Hex, blockNumber: bigint) =>
  (await publicClient.call({ to, data, blockNumber })).data;

const logsAt = (publicClient: PublicClient, address: Address, block: bigint) =>
  publicClient.getLogs({ address, fromBlock: block, toBlock: block });

/**
 * Checks one label against the chain: does the ctHash really come from where the label says?
 * `issuer` is the share issuer (`acp.issuer`), which an issuer argument of a stored value stands
 * for. One request.
 */
export const verifyShareLabel = async (
  label: ShareLabel,
  handle: Hex,
  publicClient: PublicClient,
  issuer: Address
): Promise<LabelVerification> => {
  try {
    switch (label.kind) {
      case 'stored':
        return checkStored(
          label,
          handle,
          await callAt(publicClient, label.contract, storedCallData(label, issuer), label.block)
        );
      case 'event':
        return checkEvent(label, handle, await logsAt(publicClient, label.contract, label.block));
      case 'unlabelled':
        return 'unverifiable';
    }
  } catch {
    return 'unverifiable';
  }
};

/**
 * Checks the labels of a share, index for index with `handles`, as far as `verify` says. Requests
 * are shared: one `getLogs` per contract and block, however many values it carries, and one call
 * per distinct stored read.
 */
export const verifyShareLabels = async ({
  labels,
  handles,
  issuer,
  publicClient,
  verify = 'all',
}: {
  labels: readonly ShareLabel[];
  handles: readonly Hex[];
  issuer: Address;
  publicClient: PublicClient;
  verify?: ShareLabelVerifyMode;
}): Promise<ShareLabelCheck[]> => {
  if (labels.length !== handles.length) {
    throw new Error(`share metadata: ${labels.length} labels for ${handles.length} ctHashes`);
  }

  const requests = new Map<string, Promise<unknown>>();
  const once = <T>(key: string, request: () => Promise<T>): Promise<T> => {
    if (!requests.has(key)) requests.set(key, request());
    return requests.get(key) as Promise<T>;
  };

  return Promise.all(
    labels.map(async (label, i): Promise<ShareLabelCheck> => {
      const handle = handles[i];
      try {
        switch (label.kind) {
          case 'stored': {
            if (verify !== 'all') return 'skipped';
            const data = storedCallData(label, issuer);
            const key = `call:${label.contract.toLowerCase()}:${label.block}:${data}`;
            return checkStored(
              label,
              handle,
              await once(key, () => callAt(publicClient, label.contract, data, label.block))
            );
          }
          case 'event': {
            if (verify === 'none') return 'skipped';
            const key = `logs:${label.contract.toLowerCase()}:${label.block}`;
            return checkEvent(label, handle, await once(key, () => logsAt(publicClient, label.contract, label.block)));
          }
          case 'unlabelled':
            return verify === 'none' ? 'skipped' : 'unverifiable';
        }
      } catch {
        return 'unverifiable';
      }
    })
  );
};
