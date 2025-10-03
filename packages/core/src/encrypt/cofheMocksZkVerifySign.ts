import { EncryptableItem } from '../types';
import { VerifyResult } from './zkPackProveVerify';
import {
  createWalletClient,
  http,
  encodePacked,
  keccak256,
  hashMessage,
  toBytes,
  PublicClient,
  WalletClient,
} from 'viem';
import { MockZkVerifierAbi } from './MockZkVerifierAbi';
import { hardhat } from 'viem/chains';
import { CofhesdkError, CofhesdkErrorCode } from '../error';
import { privateKeyToAccount } from 'viem/accounts';

// Address the Mock ZkVerifier contract is deployed to on the Hardhat chain
export const MocksZkVerifierAddress = '0x0000000000000000000000000000000000000100';
// Private key of the account expected to sign the encrypted inputs
export const MocksEncryptedInputSignerPkey = '0x6c8d7f768a6bb4aafe85e8a2f5a9680355239c7e14646ed62b044e39de154512';

type EncryptableItemWithCtHash = EncryptableItem & {
  ctHash: bigint;
};

/**
 * In the mocks context, we use the MockZkVerifier contract to calculate the ctHashes.
 */
async function calcCtHashes(
  items: EncryptableItem[],
  sender: string,
  securityZone: number,
  publicClient: PublicClient
): Promise<EncryptableItemWithCtHash[]> {
  const calcCtHashesArgs = [
    items.map(({ data }) => BigInt(data)),
    items.map(({ utype }) => utype),
    sender as `0x${string}`,
    securityZone,
    BigInt(hardhat.id),
  ] as const;

  let ctHashes: bigint[];

  try {
    ctHashes = (await publicClient.readContract({
      address: MocksZkVerifierAddress,
      abi: MockZkVerifierAbi,
      functionName: 'zkVerifyCalcCtHashesPacked',
      args: calcCtHashesArgs,
    })) as bigint[];
  } catch (err) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.ZkMocksCalcCtHashesFailed,
      message: `mockZkVerifySign calcCtHashes failed: ${err}`,
      cause: err instanceof Error ? err : undefined,
    });
  }

  return items.map((item, index) => ({
    ...item,
    ctHash: ctHashes[index],
  }));
}

/**
 * Insert the calculated ctHashes into the MockZkVerifier contract along with the plaintext values.
 * The plaintext values are used on chain to simulate the true FHE operations.
 */
async function insertCtHashes(items: EncryptableItemWithCtHash[], walletClient: WalletClient): Promise<void> {
  const insertPackedCtHashesArgs = [items.map(({ ctHash }) => ctHash), items.map(({ data }) => BigInt(data))] as const;
  try {
    const account = walletClient.account!;

    await walletClient.writeContract({
      address: MocksZkVerifierAddress,
      abi: MockZkVerifierAbi,
      functionName: 'insertPackedCtHashes',
      args: insertPackedCtHashesArgs,
      chain: hardhat,
      account: account,
    });
  } catch (err) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.ZkMocksInsertCtHashesFailed,
      message: `mockZkVerifySign insertPackedCtHashes failed: ${err}`,
      cause: err instanceof Error ? err : undefined,
    });
  }
}

/**
 * The mocks verify the EncryptedInputs' signature against the known proof signer account.
 * Locally, we create the proof signatures from the known proof signer account.
 */
async function createProofSignatures(items: EncryptableItemWithCtHash[], securityZone: number): Promise<string[]> {
  try {
    // Create wallet client for the encrypted input signer
    // This wallet won't send a transaction, so gas isn't needed
    // This wallet doesn't even need to be connected to the network
    const encInputSignerClient = createWalletClient({
      chain: hardhat,
      transport: http(),
      account: privateKeyToAccount(MocksEncryptedInputSignerPkey),
    });

    let signatures: string[] = [];

    for (const item of items) {
      // Pack the data into bytes and hash it
      const packedData = encodePacked(['uint256', 'int32', 'uint8'], [BigInt(item.data), securityZone, item.utype]);
      const messageHash = keccak256(packedData);

      // Convert to EthSignedMessageHash (adds "\x19Ethereum Signed Message:\n32" prefix)
      const ethSignedHash = hashMessage({ raw: toBytes(messageHash) });

      // Sign the message
      const signature = await encInputSignerClient.signMessage({ message: { raw: toBytes(ethSignedHash) } });

      signatures.push(signature);
    }

    return signatures;
  } catch (err) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.ZkMocksCreateProofSignatureFailed,
      message: `mockZkVerifySign createProofSignatures failed: ${err}`,
      cause: err instanceof Error ? err : undefined,
    });
  }
}

/**
 * Transforms the encryptable items into EncryptedInputs ready to be used in a transaction on the hardhat chain.
 * The EncryptedInputs are returned in the same format as from CoFHE, and include on-chain verifiable signatures.
 */
export async function cofheMocksZkVerifySign(
  items: EncryptableItem[],
  sender: string,
  securityZone: number,
  publicClient: PublicClient,
  walletClient: WalletClient,
  zkvWalletClient: WalletClient | undefined
): Promise<VerifyResult[]> {
  // Use config.mocks.zkvWalletClient if provided, otherwise use connected walletClient
  const _walletClient = zkvWalletClient ?? walletClient;

  // Call MockZkVerifier contract to calculate the ctHashes
  const encryptableItems = await calcCtHashes(items, sender, securityZone, publicClient);

  // Insert the ctHashes into the MockZkVerifier contract
  await insertCtHashes(encryptableItems, _walletClient);

  // Locally create the proof signatures from the known proof signer account
  const signatures = await createProofSignatures(encryptableItems, securityZone);

  // Return the ctHashes and signatures in the same format as CoFHE
  return encryptableItems.map((item, index) => ({
    ct_hash: item.ctHash.toString(),
    signature: signatures[index],
  }));
}
