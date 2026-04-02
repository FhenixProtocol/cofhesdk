export type MockArtifact = {
  contractName: string;
  abi: readonly unknown[];
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
