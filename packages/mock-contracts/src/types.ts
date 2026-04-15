export type MockArtifact = {
  contractName: string;
  abi: any;
} & (
  | {
      isFixed: true;
      fixedAddress: string;
    }
  | {
      isFixed: false;
    }
);
