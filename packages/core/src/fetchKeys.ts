import { hardhat } from '@cofhesdk/chains';
import { CofhesdkConfig, getCoFheUrlOrThrow } from './config';
import { getCrs, getFheKey, setCrs, setFheKey } from './keyStore';
import { fromHexString } from './utils';

const PUBLIC_KEY_LENGTH_MIN = 15_000;
// eslint-disable-next-line no-unused-vars
export type FheKeySerializer = (buff: Uint8Array) => void;

const fetchFhePublicKey = async (
  coFheUrl: string,
  chainId: number,
  securityZone: number,
  tfhePublicKeySerializer: FheKeySerializer
) => {
  // Escape if key already exists
  const storedKey = getFheKey(chainId, securityZone);
  if (storedKey != null) return storedKey;

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

  const pk_buff = fromHexString(pk_data);

  // Check validity by serializing
  try {
    tfhePublicKeySerializer(pk_buff);
  } catch (err) {
    throw new Error(`Error serializing FHE publicKey; ${err}`);
  }

  // Store result
  setFheKey(chainId, securityZone, pk_buff);

  return pk_buff;
};

const fetchCrs = async (
  coFheUrl: string,
  chainId: number,
  securityZone: number,
  compactPkeCrsSerializer: FheKeySerializer
) => {
  // Escape if key already exists
  const storedKey = getCrs(chainId);
  if (storedKey != null) return storedKey;

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

  const crs_buff = fromHexString(crs_data);

  try {
    compactPkeCrsSerializer(crs_buff);
  } catch (err) {
    console.error(`Error serializing CRS ${err}`);
    throw new Error(`Error serializing CRS; ${err}`);
  }

  setCrs(chainId, crs_buff);

  return crs_buff;
};

/**
 * Retrieves the FHE public key and the CRS from the provider.
 * If the key/crs already exists in the store it is returned, else it is fetched, stored, and returned
 * @param {CofhesdkConfig} config - The configuration object for the CoFHE SDK
 * @param {number} chainId - The chain to fetch the FHE key for, if no chainId provided, undefined is returned
 * @param securityZone - The security zone for which to retrieve the key (default 0).
 * @param tfhePublicKeySerializer - The serializer for the FHE public key (used for validation).
 * @param compactPkeCrsSerializer - The serializer for the CRS (used for validation).
 * @returns {Promise<void>} - A promise that resolves when the keys are fetched and stored.
 */
export const fetchKeys = async (
  config: CofhesdkConfig,
  chainId: number,
  securityZone: number = 0,
  tfhePublicKeySerializer: FheKeySerializer,
  compactPkeCrsSerializer: FheKeySerializer
) => {
  // Get cofhe url from config
  const coFheUrl = getCoFheUrlOrThrow(config, chainId);

  return await Promise.all([
    fetchFhePublicKey(coFheUrl, chainId, securityZone, tfhePublicKeySerializer),
    fetchCrs(coFheUrl, chainId, securityZone, compactPkeCrsSerializer),
  ]);
};

/**
 * Fetches the FHE public key and the CRS for all chains in the config
 * @param {CofhesdkConfig} config - The configuration object for the CoFHE SDK
 * @param {number} securityZone - The security zone for which to retrieve the key (default 0).
 * @param tfhePublicKeySerializer - The serializer for the FHE public key (used for validation).
 * @param compactPkeCrsSerializer - The serializer for the CRS (used for validation).
 * @returns {Promise<void>} - A promise that resolves when the keys are fetched and stored.
 */
export const fetchMultichainKeys = async (
  config: CofhesdkConfig,
  securityZone: number = 0,
  tfhePublicKeySerializer: FheKeySerializer,
  compactPkeCrsSerializer: FheKeySerializer
) => {
  await Promise.all(
    config.supportedChains
      .filter((chain) => chain.id !== hardhat.id)
      .map((chain) => fetchKeys(config, chain.id, securityZone, tfhePublicKeySerializer, compactPkeCrsSerializer))
  );
};
