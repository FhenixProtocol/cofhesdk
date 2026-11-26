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

  const [min, max, rangeSignature] = await client
    .encryptInputs([Encryptable.uint64(10n), Encryptable.uint64(500n)])
    .setConsumingContract(vaultAddress)
    .execute();
  const rangeTx = await walletClient.writeContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'setRange',
    args: [[min, max], rangeSignature],
  });
  await publicClient.waitForTransactionReceipt({ hash: rangeTx });

  const [enabled, enabledSignature] = await client
    .encryptInputs([Encryptable.bool(true)])
    .setConsumingContract(vaultAddress)
    .execute();
  const enabledTx = await walletClient.writeContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'setEnabled',
    args: [[enabled], enabledSignature],
  });
  await publicClient.waitForTransactionReceipt({ hash: enabledTx });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
