import type { Abi } from 'abitype';
import type { JsonFragment } from 'ethers';

export type MockArtifact = {
  contractName: string;
  // viem-friendly ABI typing (used by Hardhat 3 viem plugin)
  abi: Abi;
  // ethers-friendly ABI typing (used by the Hardhat ethers plugin)
  ethersAbi: JsonFragment[];
} & (
  | {
      isFixed: true;
      fixedAddress: string;
      deployedBytecode: string;
    }
  | {
      isFixed: false;
      bytecode: string;
    }
);
