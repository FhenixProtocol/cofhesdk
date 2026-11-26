// Reference solution. Builder forms only, so it runs on every SDK version under test.
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { chains } from '@cofhe/sdk/chains';
import { publicClient, vaultAbi, vaultAddress, walletClient } from './env';

async function connect() {
  const client = createCofheClient(createCofheConfig({ supportedChains: [chains.hardhat] }));
  await client.connect(publicClient as any, walletClient as any);
  return client;
}

async function main() {
  const client = await connect();

  const handle = (await publicClient.readContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'publicTotal',
  })) as `0x${string}`;

  const { decryptedValue, signature } = await client.decryptForTx(handle).withoutACP().execute();

  const hash = await walletClient.writeContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'revealTotal',
    args: [decryptedValue, signature],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
