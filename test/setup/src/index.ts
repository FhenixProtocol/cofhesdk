export { default as deploymentRegistry } from './deployments.json';
export { getSimpleTestAddress, getStagingSimpleTestAddress } from './contracts';
export { simpleTestAbi } from './simpleTestAbi';
export {
  TEST_PRIVATE_KEY,
  TEST_LOCALCOFHE_PRIVATE_KEY,
  PRIMARY_TEST_CHAIN,
  TEST_ALICE_PRIVATE_KEY,
  STAGING_RPC_URL,
} from './env';
export {
  primaryTestChainRegistry,
  isPrimaryTestChainReady,
  type PrimaryTestChainRegistry,
  type StoredValue,
} from './primaryTestChain';
export { stagingTestChainRegistry } from './stagingTestChain';
