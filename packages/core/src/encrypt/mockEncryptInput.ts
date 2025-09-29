import { EncryptableItem, EncryptSetStateFn, EncryptedItemInputs, EncryptStep, EncryptedItemInput } from '../types';
import { encryptExtract, encryptReplace } from './encryptUtils';
import { VerifyResult } from './zkPackProveVerify';
import { createWalletClient, http, encodePacked, keccak256, hashMessage, toBytes } from 'viem';
import { MockZkVerifierAbi } from './MockZkVerifierAbi';
import { hardhat } from 'viem/chains';
import { CofhesdkError, CofhesdkErrorCode } from '../error';
import { privateKeyToAccount } from 'viem/accounts';
import { sleep } from '../utils';
import { sdkStore } from '../sdkStore';

// Address the Mock ZkVerifier contract is deployed to on the Hardhat chain
export const MockZkVerifierAddress = '0x0000000000000000000000000000000000000100';
// Private key of the account expected to sign the encrypted inputs
export const MockEncryptedInputSignerPkey = '0x6c8d7f768a6bb4aafe85e8a2f5a9680355239c7e14646ed62b044e39de154512';

async function mockZkVerifySign(items: EncryptableItem[], securityZone: number): Promise<VerifyResult[]> {
  const { publicClient, walletClient } = sdkStore.getValidatedClients();
  const zkvWalletClient = sdkStore.getZkvWalletClient() ?? walletClient;
  const user = walletClient.account!.address;

  // Create array to store results
  const results = [];

  const chainId = await publicClient.getChainId();

  const calcCtHashesArgs = [
    items.map(({ data }) => BigInt(data)),
    items.map(({ utype }) => utype),
    user,
    securityZone,
    BigInt(chainId),
  ] as const;

  const ctHashes = await publicClient.readContract({
    address: MockZkVerifierAddress,
    abi: MockZkVerifierAbi,
    functionName: 'zkVerifyCalcCtHashesPacked',
    args: calcCtHashesArgs,
  });

  const itemsWithCtHashes = items.map((item, index) => ({
    ...item,
    ctHash: ctHashes[index],
  }));

  try {
    const insertPackedCtHashesArgs = [
      itemsWithCtHashes.map(({ ctHash }) => ctHash),
      itemsWithCtHashes.map(({ data }) => BigInt(data)),
    ] as const;

    const zkvInsertPackedHashesAccount = zkvWalletClient.account!;

    await (zkvWalletClient ?? walletClient).writeContract({
      address: MockZkVerifierAddress,
      abi: MockZkVerifierAbi,
      functionName: 'insertPackedCtHashes',
      args: insertPackedCtHashesArgs,
      chain: hardhat,
      account: zkvInsertPackedHashesAccount,
    });
  } catch (err) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.ZkVerifyInsertPackedCtHashesFailed,
      message: `mockZkVerifySign insertPackedCtHashes failed: ${err}`,
      cause: err instanceof Error ? err : undefined,
    });
  }

  // Create wallet client for the encrypted input signer
  // This wallet won't send a transaction, so gas isn't needed
  const encInputSignerClient = createWalletClient({
    chain: hardhat,
    transport: http(),
    account: privateKeyToAccount(MockEncryptedInputSignerPkey),
  });

  // Sign the items
  try {
    for (const item of itemsWithCtHashes) {
      // Pack the data into bytes and hash it
      const packedData = encodePacked(['uint256', 'int32', 'uint8'], [BigInt(item.data), securityZone, item.utype]);
      const messageHash = keccak256(packedData);

      // Convert to EthSignedMessageHash (adds "\x19Ethereum Signed Message:\n32" prefix)
      const ethSignedHash = hashMessage({ raw: toBytes(messageHash) });

      // Sign the message
      const signature = await encInputSignerClient.signMessage({ message: { raw: toBytes(ethSignedHash) } });

      results.push({
        ct_hash: item.ctHash.toString(),
        signature: signature,
      });
    }

    return results;
  } catch (err) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.ZkVerifySignFailed,
      message: `mockZkVerifySign sign failed: ${err}`,
      cause: err instanceof Error ? err : undefined,
    });
  }
}

export async function mockEncrypt<T extends any[]>(
  item: [...T],
  securityZone = 0,
  setStateCallback?: EncryptSetStateFn
): Promise<[...EncryptedItemInputs<T>]> {
  setStateCallback?.(EncryptStep.Extract);

  const encryptableItems = encryptExtract(item);

  setStateCallback?.(EncryptStep.Pack);

  await sleep(100);

  setStateCallback?.(EncryptStep.Prove);

  await sleep(500);

  setStateCallback?.(EncryptStep.Verify);

  await sleep(500);

  const signedResults = await mockZkVerifySign(encryptableItems, securityZone);

  const inItems: EncryptedItemInput[] = signedResults.map(({ ct_hash, signature }, index) => ({
    ctHash: BigInt(ct_hash),
    securityZone,
    utype: encryptableItems[index].utype,
    signature,
  }));

  setStateCallback?.(EncryptStep.Replace);

  const [preparedInputItems, remainingInItems] = encryptReplace(item, inItems);

  if (remainingInItems.length !== 0)
    throw new CofhesdkError({
      code: CofhesdkErrorCode.EncryptRemainingInItems,
      message: 'Some encrypted inputs remaining after replacement',
    });

  setStateCallback?.(EncryptStep.Done);

  return preparedInputItems;
}
