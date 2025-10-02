import { CofhesdkConfig } from './config';
import { PublicClient, WalletClient } from 'viem';
import { keysStorage } from './keyStore';
import { sdkStore } from './sdkStore';
import { fetchKeys, fetchMultichainKeys, FheKeySerializer } from './fetchKeys';
import { permits } from './permits';
import { ZkBuilderAndCrsGenerator } from './encrypt/zkPackProveVerify';
import { CofhesdkError, CofhesdkErrorCode } from './error';

/**
 * Initializes the CoFHE SDK
 * @param {CofhesdkConfig} config - Configuration object for the CoFHE SDK
 * @param {ZkBuilderAndCrsGenerator} zkBuilderAndCrsGenerator - Platform specific zk builder and crs generator
 * @param {FheKeySerializer} tfhePublicKeySerializer - Platform specific tfhe public key serializer
 * @param {FheKeySerializer} compactPkeCrsSerializer - Platform specific compact pke crs serializer
 * @returns {Promise<void>} - A promise that resolves when the CoFHE SDK is initialized
 */
export const configure = async (
  config: CofhesdkConfig,
  zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator,
  tfhePublicKeySerializer: FheKeySerializer,
  compactPkeCrsSerializer: FheKeySerializer
) => {
  // Store config and clients in storage
  sdkStore.setConfig(config);
  sdkStore.setZkBuilderAndCrsGenerator(zkBuilderAndCrsGenerator);
  sdkStore.setTfhePublicKeySerializer(tfhePublicKeySerializer);
  sdkStore.setCompactPkeCrsSerializer(compactPkeCrsSerializer);
};

export const connect = async (publicClient: PublicClient, walletClient: WalletClient) => {
  sdkStore.setPublicClient(publicClient);
  sdkStore.setWalletClient(walletClient);

  // Fetch config
  const config = sdkStore.getConfig();
  if (!config) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.MissingConfig,
      message: 'connect: Config not found, ensure initialize() has been called',
    });
  }

  const tfhePublicKeySerializer = sdkStore.getTfhePublicKeySerializer();
  if (!tfhePublicKeySerializer) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.MissingTfhePublicKeySerializer,
      message: 'connect: TfhePublicKeySerializer not found, ensure initialize() has been called',
    });
  }

  const compactPkeCrsSerializer = sdkStore.getCompactPkeCrsSerializer();
  if (!compactPkeCrsSerializer) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.MissingCompactPkeCrsSerializer,
      message: 'connect: CompactPkeCrsSerializer not found, ensure initialize() has been called',
    });
  }

  // Fetch FHE keys
  await initializeFheKeys(config, publicClient, tfhePublicKeySerializer, compactPkeCrsSerializer);

  // Generate permit if configured and necessary
  await initializePermitGeneration(config, walletClient);
};

const initializeFheKeys = async (
  config: CofhesdkConfig,
  publicClient: PublicClient,
  tfhePublicKeySerializer: FheKeySerializer,
  compactPkeCrsSerializer: FheKeySerializer
) => {
  // Hydrate keyStore
  await keysStorage.rehydrateKeysStore();

  if (config.keyFetchingStrategy === 'SUPPORTED_CHAINS') {
    await fetchMultichainKeys(config, 0, tfhePublicKeySerializer, compactPkeCrsSerializer);
    return;
  }

  const connectedChainId = await publicClient.getChainId();
  await fetchKeys(config, connectedChainId, 0, tfhePublicKeySerializer, compactPkeCrsSerializer);
};

const initializePermitGeneration = async (config: CofhesdkConfig, walletClient: WalletClient) => {
  if (!config.generatePermitDuringInitialization) return;

  // Check if permit already exists
  const permit = await permits.getPermit(walletClient.account!.address);

  // TODO: Check if permit is valid
  // Need to check expiration, signatures, and perform a call to the new ACL function `checkPermitValidity`
  const isValid = true;

  // If permit exists and is valid, return
  if (permit != null && isValid) return;

  // Else generate fresh permit
  await permits.createSelf({ name: 'Test Permit', issuer: walletClient.account!.address });
};
