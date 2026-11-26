// Reference solution. Builder forms only, so it runs on every SDK version under test.
import { Encryptable } from '@cofhe/sdk';
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

  const [value, signature] = await client
    .encryptInputs([Encryptable.uint32(4242n)])
    .setConsumingContract(vaultAddress)
    .execute();

  const hash = await walletClient.writeContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'setValue',
    args: [[value], signature],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
