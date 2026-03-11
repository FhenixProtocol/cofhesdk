import hre from 'hardhat';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import fs from 'node:fs/promises';

// #region docs
dotenvConfig({ path: resolve(__dirname, '../../.env') });
async function main() {
  const Counter = await hre.ethers.getContractFactory('EncryptedCounter');
  const counter = await Counter.deploy(0);
  await counter.waitForDeployment();

  const address = await counter.getAddress();
  const chainId = hre.network.config.chainId;
  const network = hre.network.name;

  const outDir = resolve(__dirname, '../deployments');
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    resolve(outDir, `${network}.json`),
    JSON.stringify({ address, chainId, deployedAt: new Date().toISOString() }, null, 2) + '\n',
    'utf8'
  );

  console.log(`EncryptedCounter deployed to ${network}: ${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
// #endregion docs
