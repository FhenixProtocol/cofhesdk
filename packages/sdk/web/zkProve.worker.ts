/**
 * Web Worker for ZK Proof Generation
 * Performs heavy WASM computation off the main thread
 */

/// <reference lib="webworker" />
/* eslint-disable no-undef */

import type { ZkProveWorkerRequest, ZkProveWorkerResponse } from '../core/encrypt/zkPackProveVerify.js';

// TFHE module (will be initialized on first use)
let tfheModule: any = null;
let initialized = false;

/**
 * Initialize TFHE in worker context
 */
async function initTfhe() {
  if (initialized) return;

  try {
    // Dynamic import of tfhe module
    tfheModule = await import('tfhe');
    await tfheModule.default();
    await tfheModule.init_panic_hook();
    initialized = true;
    console.log('[Worker] TFHE initialized');
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

/**
 * Main message handler
 */
self.onmessage = async (event: MessageEvent) => {
  const { id, type, fheKeyHex, crsHex, items, metadata } = event.data as ZkProveWorkerRequest;

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
    await initTfhe();

    if (!tfheModule) {
      throw new Error('TFHE module not initialized');
    }

    // Deserialize FHE public key and CRS from hex strings
    const fheKeyBytes = fromHexString(fheKeyHex);
    const crsBytes = fromHexString(crsHex);

    const fheKey = tfheModule.TfheCompactPublicKey.deserialize(fheKeyBytes);
    const crs = tfheModule.CompactPkeCrs.deserialize(crsBytes);

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
    const result = compactList.serialize();

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
