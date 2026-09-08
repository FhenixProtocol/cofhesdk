/**
 * Web Worker for ZK Proof Generation
 * Performs heavy WASM computation off the main thread
 */

/// <reference lib="webworker" />
/* eslint-disable no-undef */

import { TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT } from '../core/consts';
import type { ZkProveWorkerRequest, ZkProveWorkerResponse } from '../core/encrypt/zkPackProveVerify.js';
import { initTfheThreadPool, type TfheThreadPoolResult } from './tfheThreadPool.js';
import type { TfheThreadsSetting } from '../core/types.js';

// TFHE module (will be initialized on first use)
let tfheModule: any = null;
let initialized = false;
let threadPool: TfheThreadPoolResult | null = null;

/**
 * Initialize TFHE in worker context
 *
 * This is where the heavy `build_with_proof_packed` call runs, so it's also
 * where tfhe's rayon thread pool matters most — the main-thread pool only helps
 * the non-worker fallback path. The pool spawns nested Workers that share this
 * worker's wasm memory, which requires the page to be cross-origin isolated;
 * `initTfheThreadPool` degrades to single-threaded instead of throwing when it
 * isn't.
 */
async function initTfhe(tfheThreads: TfheThreadsSetting = 'auto') {
  if (initialized) return;

  try {
    // Dynamic import of tfhe module
    tfheModule = await import('tfhe');
    await tfheModule.default();
    await tfheModule.init_panic_hook();

    threadPool = await initTfheThreadPool(tfheModule, tfheThreads);

    initialized = true;
    console.log(
      threadPool.enabled
        ? `[Worker] TFHE initialized (rayon thread pool: ${threadPool.threads} threads)`
        : `[Worker] TFHE initialized (single-threaded: ${threadPool.reason})`
    );
  } catch (error) {
    console.error('[Worker] Failed to initialize TFHE:', error);
    throw error;
  }
}

/**
 * Convert hex string to Uint8Array
 */
function fromHexString(hexString: string): Uint8Array {
  const cleanString = hexString.length % 2 === 1 ? `0${hexString}` : hexString;
  const arr = cleanString.replace(/^0x/, '').match(/.{1,2}/g);
  if (!arr) return new Uint8Array();
  return new Uint8Array(arr.map((byte) => parseInt(byte, 16)));
}

// Guard the top-level `self` references so this file is safe to evaluate in
// non-worker contexts (e.g. when bundlers like webpack pull the worker chunk
// into the server bundle for SSR). The body is dead code anywhere `self` is
// undefined, so skipping it is harmless.
if (typeof self !== 'undefined') {
  /**
   * Main message handler
   */
  self.onmessage = async (event: MessageEvent) => {
    const { id, type, fheKeyHex, crsHex, items, metadata, tfheThreads } = event.data as ZkProveWorkerRequest;

    if (type !== 'zkProve') {
      self.postMessage({
        id,
        type: 'error',
        error: 'Invalid message type',
      } as ZkProveWorkerResponse);
      return;
    }

    try {
      // Initialize TFHE if needed
      await initTfhe(tfheThreads);

      if (!tfheModule) {
        throw new Error('TFHE module not initialized');
      }

      // Deserialize FHE public key and CRS from hex strings
      const fheKeyBytes = fromHexString(fheKeyHex);
      const crsBytes = fromHexString(crsHex);

      const fheKey = tfheModule.TfheCompactPublicKey.safe_deserialize(
        fheKeyBytes,
        TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT
      );
      const crs = tfheModule.CompactPkeCrs.safe_deserialize(crsBytes, TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT);

      // Create builder
      const builder = tfheModule.ProvenCompactCiphertextList.builder(fheKey);

      // Pack all items (duplicate of zkPack logic)
      for (const item of items) {
        switch (item.utype) {
          case 'bool':
            builder.push_boolean(Boolean(item.data));
            break;
          case 'uint8':
            builder.push_u8(Number(item.data));
            break;
          case 'uint16':
            builder.push_u16(Number(item.data));
            break;
          case 'uint32':
            builder.push_u32(Number(item.data));
            break;
          case 'uint64':
            builder.push_u64(BigInt(item.data));
            break;
          case 'uint128':
            builder.push_u128(BigInt(item.data));
            break;
          case 'uint160':
            builder.push_u160(BigInt(item.data));
            break;
          default:
            throw new Error(`Unsupported type: ${item.utype}`);
        }
      }

      // THE HEAVY OPERATION - but in worker thread!
      const metadataBytes = new Uint8Array(metadata);
      const compactList = builder.build_with_proof_packed(crs, metadataBytes, 1);

      // Serialize result
      const result = compactList.safe_serialize(TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT);

      // Send success response
      self.postMessage({
        id,
        type: 'success',
        result: Array.from(result),
      } as ZkProveWorkerResponse);
    } catch (error) {
      // Send error response
      self.postMessage({
        id,
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      } as ZkProveWorkerResponse);
    }
  };

  // Signal ready - send proper message format
  self.postMessage({
    id: 'init',
    type: 'ready',
  } as ZkProveWorkerResponse);
}
