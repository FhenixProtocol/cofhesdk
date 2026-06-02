export { default as deploymentRegistry } from './deployments.json';
export { getSimpleTestAddress } from './contracts';
export { simpleTestAbi } from './simpleTestAbi';
export { TEST_PRIVATE_KEY, TEST_LOCALCOFHE_PRIVATE_KEY, PRIMARY_TEST_CHAIN } from './env';
export {
  primaryTestChainRegistry,
  isPrimaryTestChainReady,
  type PrimaryTestChainRegistry,
  type StoredValue,
} from './primaryTestChain';
