import { hardhat } from '@/chains';

import { type CofhesdkConfig, getCoFheUrlOrThrow } from './config.js';
import { type KeysStorage } from './keyStore.js';

const PUBLIC_KEY_LENGTH_MIN = 15_000;
// eslint-disable-next-line no-unused-vars
export type FheKeyDeserializer = (buff: string) => void;

const checkKeyValidity = (key: string | undefined, serializer: FheKeyDeserializer) => {
  if (key == null || key.length === 0) return [false, `Key is null or empty <${key}>`];
  try {
    serializer(key);
    return [true, `Key is valid`];
  } catch (err) {
    return [false, `Serialization failed <${err}> key length <${key.length}>`];
  }
};

const fetchFhePublicKey = async (
  coFheUrl: string,
  chainId: number,
  securityZone: number,
  tfhePublicKeyDeserializer: FheKeyDeserializer,
  keysStorage?: KeysStorage | null
): Promise<[string, boolean]> => {
  // Escape if key already exists
  const storedKey = keysStorage?.getFheKey(chainId, securityZone);
  const [storedKeyValid] = checkKeyValidity(storedKey, tfhePublicKeyDeserializer);
  if (storedKeyValid) return [storedKey!, false];

  let pk_data: string | undefined = undefined;

  try {
    const pk_res = await fetch(`${coFheUrl}/GetNetworkPublicKey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ securityZone }),
    });
    const json = (await pk_res.json()) as { publicKey: string };
    pk_data = json.publicKey;
  } catch (err) {
    throw new Error(`Error fetching FHE publicKey; fetching from CoFHE failed with error ${err}`);
  }

  if (pk_data == null || typeof pk_data !== 'string') {
    throw new Error(`Error fetching FHE publicKey; fetched result invalid: missing or not a string`);
  }

  if (pk_data === '0x') {
    throw new Error('Error fetching FHE publicKey; provided chain is not FHE enabled / not found');
  }

  if (pk_data.length < PUBLIC_KEY_LENGTH_MIN) {
    throw new Error(
      `Error fetching FHE publicKey; got shorter than expected key length: ${pk_data.length}. Expected length >= ${PUBLIC_KEY_LENGTH_MIN}`
    );
  }

  // Check validity by serializing
  try {
    tfhePublicKeyDeserializer(pk_data);
  } catch (err) {
    throw new Error(`Error serializing FHE publicKey; ${err}`);
  }

  // Store result
  keysStorage?.setFheKey(chainId, securityZone, pk_data);

  return [pk_data, true];
};

const fetchCrs = async (
  coFheUrl: string,
  chainId: number,
  securityZone: number,
  compactPkeCrsDeserializer: FheKeyDeserializer,
  keysStorage?: KeysStorage | null
): Promise<[string, boolean]> => {
  // Escape if key already exists
  const storedKey = keysStorage?.getCrs(chainId);
  const [storedKeyValid] = checkKeyValidity(storedKey, compactPkeCrsDeserializer);
  if (storedKeyValid) return [storedKey!, false];

  let crs_data: string | undefined = undefined;

  try {
    const crs_res = await fetch(`${coFheUrl}/GetCrs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ securityZone }),
    });
    const json = (await crs_res.json()) as { crs: string };
    crs_data = json.crs;
  } catch (err) {
    throw new Error(`Error fetching CRS; fetching failed with error ${err}`);
  }

  if (crs_data == null || typeof crs_data !== 'string') {
    throw new Error(`Error fetching CRS; invalid: missing or not a string`);
  }

  try {
    compactPkeCrsDeserializer(crs_data);
  } catch (err) {
    console.error(`Error serializing CRS ${err}`);
    throw new Error(`Error serializing CRS; ${err}`);
  }

  keysStorage?.setCrs(chainId, crs_data);

  return [crs_data, true];
};

/**
 * Retrieves the FHE public key and the CRS from the provider.
 * If the key/crs already exists in the store it is returned, else it is fetched, stored, and returned
 * @param {CofhesdkConfig} config - The configuration object for the CoFHE SDK
 * @param {number} chainId - The chain to fetch the FHE key for, if no chainId provided, undefined is returned
 * @param securityZone - The security zone for which to retrieve the key (default 0).
 * @param tfhePublicKeyDeserializer - The serializer for the FHE public key (used for validation).
 * @param compactPkeCrsDeserializer - The serializer for the CRS (used for validation).
 * @param keysStorage - The keys storage instance to use (optional)
 * @returns {Promise<[[string, boolean], [string, boolean]]>} - A promise that resolves to [[fheKey, fheKeyFetchedFromCoFHE], [crs, crsFetchedFromCoFHE]]
 */
export const fetchKeys = async (
  config: CofhesdkConfig,
  chainId: number,
  securityZone: number = 0,
  tfhePublicKeyDeserializer: FheKeyDeserializer,
  compactPkeCrsDeserializer: FheKeyDeserializer,
  keysStorage?: KeysStorage | null
): Promise<[[string, boolean], [string, boolean]]> => {
  // Get cofhe url from config
  const coFheUrl = getCoFheUrlOrThrow(config, chainId);

  return await Promise.all([
    fetchFhePublicKey(coFheUrl, chainId, securityZone, tfhePublicKeyDeserializer, keysStorage),
    fetchCrs(coFheUrl, chainId, securityZone, compactPkeCrsDeserializer, keysStorage),
  ]);
};
