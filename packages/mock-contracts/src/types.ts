import type { Abi } from 'abitype';

export type MockArtifact = {
  contractName: string;
  abi: Abi;
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
