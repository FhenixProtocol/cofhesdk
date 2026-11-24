import { type KeysStorage } from './keyStore.js';

const PUBLIC_KEY_LENGTH_MIN = 15_000;
export type FheKeyDeserializer = (buff: string) => void;

// Keys a deserializer has already accepted, by storage slot. Deserializing is the only way to
// validate a key, and it is synchronous and heavy (the CRS is several megabytes), so each key is
// validated once per page, not on every encrypt. A slot whose key changes is validated again.
const validatedKeys = new WeakMap<FheKeyDeserializer, Map<string, string>>();

const isAlreadyValidated = (slot: string, key: string, deserializer: FheKeyDeserializer) =>
  validatedKeys.get(deserializer)?.get(slot) === key;

const markValidated = (slot: string, key: string, deserializer: FheKeyDeserializer) => {
  let slots = validatedKeys.get(deserializer);
  if (!slots) validatedKeys.set(deserializer, (slots = new Map()));
  slots.set(slot, key);
};

const checkKeyValidity = (key: string | undefined, serializer: FheKeyDeserializer, slot: string) => {
  if (key == null || key.length === 0) return [false, `Key is null or empty <${key}>`];
  if (isAlreadyValidated(slot, key, serializer)) return [true, `Key is valid`];
  try {
    serializer(key);
    markValidated(slot, key, serializer);
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
  const slot = `fheKey:${chainId}:${securityZone}`;
  const [storedKeyValid] = checkKeyValidity(storedKey, tfhePublicKeyDeserializer, slot);
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
  markValidated(slot, pk_data, tfhePublicKeyDeserializer);

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
  const storedKey = keysStorage?.getCrs(chainId, securityZone);
  const slot = `crs:${chainId}:${securityZone}`;
  const [storedKeyValid] = checkKeyValidity(storedKey, compactPkeCrsDeserializer, slot);
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
  markValidated(slot, crs_data, compactPkeCrsDeserializer);

  keysStorage?.setCrs(chainId, securityZone, crs_data);

  return [crs_data, true];
};

/**
 * The FHE public key and the CRS for one chain and security zone, from `keysStorage` when it holds
 * valid ones and from the CoFHE server at `coFheUrl` otherwise (then stored).
 *
 * Takes the URL, not the client config, and this file does not import the config module, so the
 * proving worker can use it without bundling the config's dependencies. `fetchKeys` in
 * `fetchKeysForConfig.ts` is the same call for a caller that has the config.
 *
 * @returns [[fheKey, fheKeyFetchedFromCoFHE], [crs, crsFetchedFromCoFHE]]
 */
export const fetchKeysFromUrl = async (
  coFheUrl: string,
  chainId: number,
  securityZone: number,
  tfhePublicKeyDeserializer: FheKeyDeserializer,
  compactPkeCrsDeserializer: FheKeyDeserializer,
  keysStorage?: KeysStorage | null
): Promise<[[string, boolean], [string, boolean]]> => {
  return await Promise.all([
    fetchFhePublicKey(coFheUrl, chainId, securityZone, tfhePublicKeyDeserializer, keysStorage),
    fetchCrs(coFheUrl, chainId, securityZone, compactPkeCrsDeserializer, keysStorage),
  ]);
};
