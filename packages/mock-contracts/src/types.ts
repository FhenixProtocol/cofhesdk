import type { Abi } from 'abitype';
import type { JsonFragment } from 'ethers';

export type MockArtifact = {
  contractName: string;
  abi: any;
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
