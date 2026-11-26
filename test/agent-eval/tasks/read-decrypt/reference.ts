// Reference solution. Builder forms only, so it runs on every SDK version under test.
import { FheTypes } from '@cofhe/sdk';
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
  await client.acp.getOrCreateSelfACP();

  const handle = (await publicClient.readContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'storedValue',
  })) as `0x${string}`;

  const value = await client.decryptForView(handle, FheTypes.Uint32).execute();
  console.log(JSON.stringify({ value: value.toString() }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
