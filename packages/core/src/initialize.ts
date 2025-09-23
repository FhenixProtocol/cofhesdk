import { CofhesdkConfig } from './config';
import { PublicClient, WalletClient } from 'viem';
import { keysStorage } from './keyStore';
import { sdkStore } from './sdkStore';
import { fetchKeys, fetchMultichainKeys, FheKeySerializer } from './fetchKeys';

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
  // Hydrate keyStore
  await keysStorage.rehydrateKeysStore();

  // Fetch FHE keys
  await initializeFheKeys(config, publicClient, tfhePublicKeySerializer, compactPkeCrsSerializer);

  // TODO: Store config and clients in storage
  sdkStore.setConfig(config);
  sdkStore.setPublicClient(publicClient);
  sdkStore.setWalletClient(walletClient);

  // TODO: Generate permit if config.generatePermitDuringInit is true
  // if (config.generatePermitDuringInitialization) {
  //   generatePermit(config, publicClient, walletClient);
  // }
};

const initializeFheKeys = async (
  config: CofhesdkConfig,
  publicClient: PublicClient,
  tfhePublicKeySerializer: FheKeySerializer,
  compactPkeCrsSerializer: FheKeySerializer
) => {
  if (config.keyFetchingStrategy === 'SUPPORTED_CHAINS') {
    await fetchMultichainKeys(config, 0, tfhePublicKeySerializer, compactPkeCrsSerializer);
    return;
  }

  const connectedChainId = await publicClient.getChainId();
  await fetchKeys(config, connectedChainId, 0, tfhePublicKeySerializer, compactPkeCrsSerializer);
};
