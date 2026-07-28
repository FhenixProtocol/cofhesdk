import nacl from 'tweetnacl';
import { type Hex } from 'viem';
import { fromHexString, toBeArray, toBigInt, toHexString, isBigIntOrNumber, isString } from './utils.js';

/** 32-byte X25519 keys as bare hex (no 0x prefix) */
const KEY_HEX_LENGTH = 64;

export type EthEncryptedData = {
  data: Uint8Array;
  public_key: Uint8Array;
  nonce: Uint8Array;
};

/**
 * An X25519 sealing keypair, both halves 0x-prefixed 32-byte hex.
 * The public key travels in the ACP (`sealingKey`); the private key never
 * leaves the client (`sealingPrivateKey`).
 */
export type SealingKeyPair = {
  privateKey: Hex;
  publicKey: Hex;
};

/**
 * Generates a new sealing keypair. A sealing key is used to encrypt data such
 * that it can only be unsealed (decrypted) by the owner of the corresponding
 * private key.
 */
export const GenerateSealingKey = (): SealingKeyPair => {
  const sodiumKeypair = nacl.box.keyPair();

  return {
    privateKey: `0x${toHexString(sodiumKeypair.secretKey)}`,
    publicKey: `0x${toHexString(sodiumKeypair.publicKey)}`,
  };
};

/**
 * Seals (encrypts) the provided message for a receiver with the specified public key.
 *
 * @param {bigint | number} value - The message to be encrypted.
 * @param {string} publicKey - The public key of the intended recipient (with or without 0x prefix).
 * @returns {EthEncryptedData} - The encrypted message.
 * @throws Will throw if the provided publicKey or value do not meet defined preconditions.
 */
export const seal = (value: bigint | number, publicKey: string): EthEncryptedData => {
  isString(publicKey);
  isBigIntOrNumber(value);
  assertKeyLength(publicKey, 'Public');

  // generate ephemeral keypair
  const ephemeralKeyPair = nacl.box.keyPair();

  const nonce = nacl.randomBytes(nacl.box.nonceLength);

  const encryptedMessage = nacl.box(toBeArray(value), nonce, fromHexString(publicKey), ephemeralKeyPair.secretKey);

  return {
    data: encryptedMessage,
    public_key: ephemeralKeyPair.publicKey,
    nonce: nonce,
  };
};

/**
 * Unseal (decrypt) data with a sealing private key (with or without 0x prefix).
 * The ephemeral public key travels inside the payload, so the private key alone suffices.
 */
export const unsealWithPrivateKey = (privateKey: string, parsedData: EthEncryptedData): bigint => {
  assertKeyLength(privateKey, 'Private');

  const nonce = parsedData.nonce instanceof Uint8Array ? parsedData.nonce : new Uint8Array(parsedData.nonce);
  const ephemPublicKey =
    parsedData.public_key instanceof Uint8Array ? parsedData.public_key : new Uint8Array(parsedData.public_key);
  const dataToDecrypt = parsedData.data instanceof Uint8Array ? parsedData.data : new Uint8Array(parsedData.data);

  const decryptedMessage = nacl.box.open(dataToDecrypt, nonce, ephemPublicKey, fromHexString(privateKey));
  if (!decryptedMessage) {
    throw new Error('Failed to decrypt message');
  }

  return toBigInt(decryptedMessage);
};

const assertKeyLength = (key: string, kind: 'Private' | 'Public'): void => {
  const bare = key.startsWith('0x') ? key.slice(2) : key;
  if (bare.length !== KEY_HEX_LENGTH) {
    throw new Error(`${kind} key must be of length ${KEY_HEX_LENGTH}`);
  }
};
