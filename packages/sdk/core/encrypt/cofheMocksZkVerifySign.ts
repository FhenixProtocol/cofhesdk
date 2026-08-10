import { type EncryptableItem, FheTypes } from '../types.js';
import { type VerifyBatchResult } from './zkPackProveVerify.js';
import { createWalletClient, http, encodePacked, keccak256, type PublicClient, type WalletClient } from 'viem';
import { MockZkVerifierAbi } from './MockZkVerifierAbi.js';
import { hardhat } from 'viem/chains';
import { CofheError, CofheErrorCode } from '../error.js';
import { privateKeyToAccount, sign } from 'viem/accounts';
import { MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY, MOCKS_ZK_VERIFIER_ADDRESS, TFHE_RS_ZK_MAX_BITS } from '../consts.js';

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
  if (totalBits > TFHE_RS_ZK_MAX_BITS) {
    throw new CofheError({
      code: CofheErrorCode.ZkPackFailed,
      message: `Total bits ${totalBits} exceeds ${TFHE_RS_ZK_MAX_BITS}`,
      hint: `Ensure that the total bits of the items to encrypt does not exceed ${TFHE_RS_ZK_MAX_BITS}`,
      context: {
        totalBits,
        maxBits: TFHE_RS_ZK_MAX_BITS,
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
      address: MOCKS_ZK_VERIFIER_ADDRESS,
      abi: MockZkVerifierAbi,
      functionName: 'zkVerifyCalcCtHashesPacked',
      args: calcCtHashesArgs,
    })) as bigint[];
  } catch (err) {
    throw new CofheError({
      code: CofheErrorCode.ZkMocksCalcCtHashesFailed,
      message: `mockZkVerifySign calcCtHashes failed while calling zkVerifyCalcCtHashesPacked`,
      cause: err instanceof Error ? err : undefined,
      context: {
        address: MOCKS_ZK_VERIFIER_ADDRESS,
        items,
        account,
        securityZone,
        publicClient,
        calcCtHashesArgs,
      },
    });
  }

  if (ctHashes.length !== items.length) {
    throw new CofheError({
      code: CofheErrorCode.ZkMocksCalcCtHashesFailed,
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
      address: MOCKS_ZK_VERIFIER_ADDRESS,
      abi: MockZkVerifierAbi,
      functionName: 'insertPackedCtHashes',
      args: insertPackedCtHashesArgs,
      chain: hardhat,
      account: account,
    });
  } catch (err) {
    throw new CofheError({
      code: CofheErrorCode.ZkMocksInsertCtHashesFailed,
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
 * The mocks verify a batch's signature against the known verifier signer account.
 * Locally, we create the single batch signature from the known signer account, over
 * keccak256(h_0 || h_1 || ... || h_n), where each h_i is the same per-item message hash
 * used by the on-chain digest (`ctHash || utype || securityZone || sender || chainId ||
 * consumingContract`, per cofhe-contracts#77's contract-binding fix). This is the one
 * canonical signer implementation used by the mocks - there is no separate per-item signing
 * path.
 */
async function createBatchProofSignature(
  items: EncryptableItemWithCtHash[],
  securityZone: number,
  account: string,
  consumingContract: string
): Promise<`0x${string}`> {
  try {
    // Compute each item's per-item message hash h_i
    const itemHashes = items.map((item) =>
      keccak256(
        encodePacked(
          ['uint256', 'uint8', 'uint8', 'address', 'uint256', 'address'],
          [
            BigInt(item.ctHash),
            item.utype,
            securityZone,
            account as `0x${string}`,
            BigInt(hardhat.id),
            consumingContract as `0x${string}`,
          ]
        )
      )
    );

    // Fold into one batch digest: keccak256(h_0 || h_1 || ... || h_n)
    const batchDigest = keccak256(
      encodePacked(
        itemHashes.map(() => 'bytes32' as const),
        itemHashes
      )
    );

    // Sign once for the whole batch
    return await sign({
      hash: batchDigest,
      privateKey: MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY,
      to: 'hex',
    });
  } catch (err) {
    throw new CofheError({
      code: CofheErrorCode.ZkMocksCreateProofSignatureFailed,
      message: `mockZkVerifySign createBatchProofSignature failed while signing the batch digest`,
      cause: err instanceof Error ? err : undefined,
      context: {
        items,
        securityZone,
        consumingContract,
      },
    });
  }
}

/**
 * Transforms the encryptable items into a batch-verified result ready to be used in a
 * transaction on the hardhat chain. Mirrors the shape returned by CoFHE's `/verify-batch`:
 * per-item ctHash/ctType, plus one shared on-chain verifiable signature for the whole batch.
 */
export async function cofheMocksZkVerifySign(
  items: EncryptableItem[],
  account: string,
  securityZone: number,
  consumingContract: string,
  publicClient: PublicClient,
  walletClient: WalletClient,
  zkvWalletClient: WalletClient | undefined
): Promise<VerifyBatchResult> {
  // Use config._internal?.zkvWalletClient if provided, otherwise use a mock zk verifier signer
  const _walletClient = zkvWalletClient ?? createMockZkVerifierSigner();

  // Call MockZkVerifier contract to calculate the ctHashes
  const encryptableItems = await calcCtHashes(items, account, securityZone, publicClient);

  // Insert the ctHashes into the MockZkVerifier contract
  await insertCtHashes(encryptableItems, _walletClient);

  // Locally create the single batch signature from the known signer account
  const signature = await createBatchProofSignature(encryptableItems, securityZone, account, consumingContract);

  // Return the ctHashes/ctTypes and the batch signature, in the same shape as CoFHE's /verify-batch
  return {
    outputs: encryptableItems.map((item) => ({
      ct_hash: item.ctHash.toString(),
      ct_type: item.utype,
    })),
    signature,
  };
}
