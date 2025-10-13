import { HardhatRuntimeEnvironment } from "hardhat/types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  AbstractProvider,
  AbstractSigner,
  cofhejs,
  Environment,
  InitializationParams,
} from "cofhejs/node";
import { TypedDataField } from "ethers";
import { MOCK_ZK_VERIFIER_SIGNER_ADDRESS } from "./const";

export const getCofheEnvironmentFromNetwork = (
  network: string,
): Environment => {
  switch (network) {
    case "localcofhe":
      return "LOCAL";
    case "hardhat":
    case "localhost":
      return "MOCK";
    case "arb-sepolia":
    case "eth-sepolia":
      return "TESTNET";
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
};

export const isPermittedCofheEnvironment = (
  hre: HardhatRuntimeEnvironment,
  env: string,
) => {
  switch (env) {
    case "LOCAL":
      return ["localcofhe"].includes(hre.network.name);
    case "MOCK":
      return ["hardhat", "localhost"].includes(hre.network.name);
    case "TESTNET":
      return ["arb-sepolia", "eth-sepolia"].includes(hre.network.name);
    default:
      return false;
  }
};

export type HHSignerInitializationParams = Omit<
  InitializationParams,
  | "tfhePublicKeySerializer"
  | "compactPkeCrsSerializer"
  | "signer"
  | "provider"
  | "mockConfig"
> & {
  generatePermit?: boolean;
  environment?: Environment;
};

const hhSignerToCofhejsProvider = (
  signer: HardhatEthersSigner,
): AbstractProvider => {
  const provider: AbstractProvider = {
    call: async (...args) => {
      try {
        return signer.provider.call(...args);
      } catch (e) {
        throw new Error(`cofhejs initializeWithHHSigner :: call :: ${e}`);
      }
    },
    getChainId: async () =>
      (await signer.provider.getNetwork()).chainId.toString(),
    send: async (...args) => {
      try {
        return signer.provider.send(...args);
      } catch (e) {
        throw new Error(`cofhejs initializeWithHHSigner :: send :: ${e}`);
      }
    },
  };
  return provider;
};

const hhSignerToCofhejsSigner = (
  signer: HardhatEthersSigner,
  provider: AbstractProvider,
): AbstractSigner => {
  const abstractSigner: AbstractSigner = {
    signTypedData: async (domain, types, value) =>
      signer.signTypedData(
        domain,
        types as Record<string, TypedDataField[]>,
        value,
      ),
    getAddress: async () => signer.getAddress(),
    provider,
    sendTransaction: async (...args) => {
      try {
        const tx = await signer.sendTransaction(...args);
        return tx.hash;
      } catch (e) {
        throw new Error(
          `cofhejs initializeWithHHSigner :: sendTransaction :: ${e}`,
        );
      }
    },
  };
  return abstractSigner;
};

export const cofhejs_initializeWithHardhatSigner = async (
  hre: HardhatRuntimeEnvironment,
  signer: HardhatEthersSigner,
  params?: HHSignerInitializationParams,
) => {
  const abstractProvider = hhSignerToCofhejsProvider(signer);
  const abstractSigner = hhSignerToCofhejsSigner(signer, abstractProvider);

  const zkvHhSigner = await hre.ethers.getImpersonatedSigner(
    MOCK_ZK_VERIFIER_SIGNER_ADDRESS,
  );
  const zkvSigner = hhSignerToCofhejsSigner(zkvHhSigner, abstractProvider);

  return cofhejs.initialize({
    ...(params ?? {}),
    environment:
      params?.environment ??
      getCofheEnvironmentFromNetwork((await signer.provider.getNetwork()).name),
    provider: abstractProvider,
    signer: abstractSigner,
    mockConfig: {
      zkvSigner,
    },
  });
};
