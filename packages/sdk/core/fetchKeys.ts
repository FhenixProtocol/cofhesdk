import { type CofheConfig, getCoFheUrlOrThrow } from './config.js';
import { type KeysStorage } from './keyStore.js';
import { fetchKeysFromUrl, type FheKeyDeserializer } from './fetchKeysFromUrl.js';

export type { FheKeyDeserializer };

/**
 * Retrieves the FHE public key and the CRS from the provider.
 * If the key/crs already exists in the store it is returned, else it is fetched, stored, and returned
 * @param {CofheConfig} config - The configuration object for the CoFHE client
 * @param {number} chainId - The chain to fetch the FHE key for, if no chainId provided, undefined is returned
 * @param securityZone - The security zone for which to retrieve the key (default 0).
 * @param tfhePublicKeyDeserializer - The serializer for the FHE public key (used for validation).
 * @param compactPkeCrsDeserializer - The serializer for the CRS (used for validation).
 * @param keysStorage - The keys storage instance to use (optional)
 * @returns {Promise<[[string, boolean], [string, boolean]]>} - A promise that resolves to [[fheKey, fheKeyFetchedFromCoFHE], [crs, crsFetchedFromCoFHE]]
 */
export const fetchKeys = async (
  config: CofheConfig,
  chainId: number,
  securityZone: number = 0,
  tfhePublicKeyDeserializer: FheKeyDeserializer,
  compactPkeCrsDeserializer: FheKeyDeserializer,
  keysStorage?: KeysStorage | null
): Promise<[[string, boolean], [string, boolean]]> => {
  return await fetchKeysFromUrl(
    getCoFheUrlOrThrow(config, chainId),
    chainId,
    securityZone,
    tfhePublicKeyDeserializer,
    compactPkeCrsDeserializer,
    keysStorage
  );
};
