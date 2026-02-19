import { type EncryptableItem, FheTypes } from '../types.js';
import { MAX_ENCRYPTABLE_BITS, type VerifyResult } from './zkPackProveVerify.js';
import {
  createWalletClient,
  http,
  encodePacked,
  keccak256,
  hashMessage,
  toBytes,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { MockZkVerifierAbi } from './MockZkVerifierAbi.js';
import { hardhat } from 'viem/chains';
import { CofhesdkError, CofhesdkErrorCode } from '../error.js';
import { privateKeyToAccount } from 'viem/accounts';

// Address the Mock ZkVerifier contract is deployed to on the Hardhat chain
export const MocksZkVerifierAddress = '0x0000000000000000000000000000000000005001';

// PK & address pair for zk verifier
export const MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY =
  '0x6C8D7F768A6BB4AAFE85E8A2F5A9680355239C7E14646ED62B044E39DE154512';
export const MOCKS_ZK_VERIFIER_SIGNER_ADDRESS = '0x6E12D8C87503D4287c294f2Fdef96ACd9DFf6bd2';

type EncryptableItemWithCtHash = EncryptableItem & {
  ctHash: bigint;
};

function createMockZkVerifierSigner() {
  return createWalletClient({
    chain: hardhat,
    transport: http(),
    account: privateKeyToAccount(MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY),
  });
}
/**
 * The mocks don't use a tfhe builder, so we check the encryptable bits here to preserve parity
 */
export async function cofheMocksCheckEncryptableBits(items: EncryptableItem[]): Promise<void> {
  let totalBits = 0;
  for (const item of items) {
    switch (item.utype) {
      case FheTypes.Bool: {
        totalBits += 1;
        break;
      }
      case FheTypes.Uint8: {
        totalBits += 8;
        break;
      }
      case FheTypes.Uint16: {
        totalBits += 16;
        break;
      }
      case FheTypes.Uint32: {
        totalBits += 32;
        break;
      }
      case FheTypes.Uint64: {
        totalBits += 64;
        break;
      }
      case FheTypes.Uint128: {
        totalBits += 128;
        break;
      }
      // [U256-DISABLED]
      // case FheTypes.Uint256: {
      //   totalBits += 256;
      //   break;
      // }
      case FheTypes.Uint160: {
        totalBits += 160;
        break;
      }
    }
  }
  if (totalBits > MAX_ENCRYPTABLE_BITS) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.ZkPackFailed,
      message: `Total bits ${totalBits} exceeds ${MAX_ENCRYPTABLE_BITS}`,
      hint: `Ensure that the total bits of the items to encrypt does not exceed ${MAX_ENCRYPTABLE_BITS}`,
      context: {
        totalBits,
        maxBits: MAX_ENCRYPTABLE_BITS,
        items,
      },
    });
  }
}

/**
 * In the mocks context, we use the MockZkVerifier contract to calculate the ctHashes.
 */
async function calcCtHashes(
  items: EncryptableItem[],
  account: string,
  securityZone: number,
  publicClient: PublicClient
): Promise<EncryptableItemWithCtHash[]> {
  const calcCtHashesArgs = [
    items.map(({ data }) => BigInt(data)),
    items.map(({ utype }) => utype),
    account as `0x${string}`,
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
      message: `mockZkVerifySign calcCtHashes failed while calling zkVerifyCalcCtHashesPacked`,
      cause: err instanceof Error ? err : undefined,
      context: {
        address: MocksZkVerifierAddress,
        items,
        account,
        securityZone,
        publicClient,
        calcCtHashesArgs,
      },
    });
  }

  if (ctHashes.length !== items.length) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.ZkMocksCalcCtHashesFailed,
      message: `mockZkVerifySign calcCtHashes returned incorrect number of ctHashes`,
      context: {
        items,
        account,
        securityZone,
        publicClient,
        calcCtHashesArgs,
        ctHashes,
      },
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
      message: `mockZkVerifySign insertPackedCtHashes failed while calling insertPackedCtHashes`,
      cause: err instanceof Error ? err : undefined,
      context: {
        items,
        walletClient,
        insertPackedCtHashesArgs,
      },
    });
  }
}

/**
 * The mocks verify the EncryptedInputs' signature against the known proof signer account.
 * Locally, we create the proof signatures from the known proof signer account.
 */
async function createProofSignatures(items: EncryptableItemWithCtHash[], securityZone: number): Promise<string[]> {
  let signatures: string[] = [];

  // Create wallet client for the encrypted input signer
  // This wallet won't send a transaction, so gas isn't needed
  // This wallet doesn't need to be connected to the network
  let encInputSignerClient: WalletClient | undefined;

  try {
    encInputSignerClient = createMockZkVerifierSigner();
  } catch (err) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.ZkMocksCreateProofSignatureFailed,
      message: `mockZkVerifySign createProofSignatures failed while creating wallet client`,
      cause: err instanceof Error ? err : undefined,
      context: {
        MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY,
      },
    });
  }

  try {
    for (const item of items) {
      // Pack the data into bytes and hash it
      const packedData = encodePacked(['uint256', 'int32', 'uint8'], [BigInt(item.data), securityZone, item.utype]);
      const messageHash = keccak256(packedData);

      // Convert to EthSignedMessageHash (adds "\x19Ethereum Signed Message:\n32" prefix)
      const ethSignedHash = hashMessage({ raw: toBytes(messageHash) });

      // Sign the message
      const signature = await encInputSignerClient.signMessage({
        message: { raw: toBytes(ethSignedHash) },
        account: encInputSignerClient.account!,
      });

      signatures.push(signature);
    }
  } catch (err) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.ZkMocksCreateProofSignatureFailed,
      message: `mockZkVerifySign createProofSignatures failed while calling signMessage`,
      cause: err instanceof Error ? err : undefined,
      context: {
        items,
        securityZone,
      },
    });
  }

  if (signatures.length !== items.length) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.ZkMocksCreateProofSignatureFailed,
      message: `mockZkVerifySign createProofSignatures returned incorrect number of signatures`,
      context: {
        items,
        securityZone,
      },
    });
  }

  return signatures;
}

/**
 * Transforms the encryptable items into EncryptedInputs ready to be used in a transaction on the hardhat chain.
 * The EncryptedInputs are returned in the same format as from CoFHE, and include on-chain verifiable signatures.
 */
export async function cofheMocksZkVerifySign(
  items: EncryptableItem[],
  account: string,
  securityZone: number,
  publicClient: PublicClient,
  walletClient: WalletClient,
  zkvWalletClient: WalletClient | undefined
): Promise<VerifyResult[]> {
  // Use config._internal?.zkvWalletClient if provided, otherwise use a mock zk verifier signer
  const _walletClient = zkvWalletClient ?? createMockZkVerifierSigner();

  // Call MockZkVerifier contract to calculate the ctHashes
  const encryptableItems = await calcCtHashes(items, account, securityZone, publicClient);

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
