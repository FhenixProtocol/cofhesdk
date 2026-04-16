export { default as deploymentRegistry } from './deployments.json';
export { TEST_PRIVATE_KEY } from './key';
export { simpleTestAbi, getSimpleTestAddress } from './contracts';
export { TEST_LOCALCOFHE_ENABLED, TEST_LOCALCOFHE_PRIVATE_KEY, COFHE_CHAIN_ID, PRIMARY_TEST_CHAIN } from './config';
export {
  primaryTestChainRegistry,
  isPrimaryTestChainReady,
  type PrimaryTestChainRegistry,
  type StoredValue,
} from './primaryTestChain';
