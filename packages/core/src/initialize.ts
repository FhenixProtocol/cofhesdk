import { CofhesdkConfig } from './config';
import { PublicClient, WalletClient } from 'viem';
import { keysStorage } from './keyStore';
import { sdkStore } from './sdkStore';
import { fetchKeys, fetchMultichainKeys, FheKeySerializer } from './fetchKeys';
import { permits } from './permits';

/**
 * Initializes the CoFHE SDK
 * @param {CofhesdkConfig} config - The configuration object for the CoFHE SDK
 * @param {PublicClient} publicClient - The public client for the CoFHE SDK
 * @param {WalletClient} walletClient - The wallet client for the CoFHE SDK
 * @returns {Promise<void>} - A promise that resolves when the CoFHE SDK is initialized
 */
export const initialize = async (
  config: CofhesdkConfig,
  publicClient: PublicClient,
  walletClient: WalletClient,
  tfhePublicKeySerializer: FheKeySerializer,
  compactPkeCrsSerializer: FheKeySerializer
) => {
  // Store config and clients in storage
  sdkStore.setConfig(config);
  sdkStore.setPublicClient(publicClient);
  sdkStore.setWalletClient(walletClient);

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
