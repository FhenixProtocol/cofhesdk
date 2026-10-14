import hre from 'hardhat';
import type { Contract } from 'ethers';

/**
 * The ACP share registry as production runs it: cofhe-contracts' upgradeable contract behind an
 * ERC-1967 proxy, initialized with the first signer as admin.
 */
export async function deployShareRegistry(): Promise<Contract> {
  const [admin] = await hre.ethers.getSigners();
  const impl = await (await hre.ethers.getContractFactory('ACPShareRegistry')).deploy();
  await impl.waitForDeployment();
  const proxy = await (
    await hre.ethers.getContractFactory('MockERC1967Proxy')
  ).deploy(await impl.getAddress(), impl.interface.encodeFunctionData('initialize', [admin.address]));
  await proxy.waitForDeployment();
  return impl.attach(await proxy.getAddress()) as Contract;
}
