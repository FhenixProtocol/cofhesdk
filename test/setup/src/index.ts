export { default as deploymentRegistry } from './deployments.json';
export { simpleTestAbi, getSimpleTestAddress } from './contracts';
export { TEST_PRIVATE_KEY, TEST_LOCALCOFHE_PRIVATE_KEY, PRIMARY_TEST_CHAIN } from './env';
export {
  primaryTestChainRegistry,
  isPrimaryTestChainReady,
  type PrimaryTestChainRegistry,
  type StoredValue,
} from './primaryTestChain';
