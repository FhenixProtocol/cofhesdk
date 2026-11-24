/**
 * Test-only: a web client built around a substitute proving worker, to exercise the worker path
 * and its fallback without the real worker. Not exported from the package: tests import this file.
 */
import { createCofheClientBase, type CofheClient, type CofheConfig, type ProvingWorker } from '@/core';
import { mainThreadProving } from './mainThreadTfhe.js';

export function createCofheClientWithProvingWorker(config: CofheConfig, provingWorker: ProvingWorker): CofheClient {
  return createCofheClientBase({
    config,
    proving: { mainThread: mainThreadProving(config.tfheThreads), worker: { instance: provingWorker } },
  });
}
