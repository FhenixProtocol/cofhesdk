import {
  getTokenConfidentialValueType,
  isSupportedTokenConfidentialityType,
  type Token,
  type TokenConfidentialityType,
  TOKEN_CONFIDENTIALITY_TYPES,
  type SupportedTokenConfidentialityType,
} from '@/types/token';
import type { Abi } from 'viem';

import { WRAPPED_TOKEN_CONTRACTS } from './confidentialTokenWrapped';

export type ContractConfig = {
  abi: Abi;
  functionName: string;
};

export type ProbeContractConfig = ContractConfig & {
  args: readonly unknown[];
};

export type Erc20ApprovalContracts = {
  allowance: ContractConfig;
  approve: ContractConfig;
};

export type TokenShieldContracts = {
  approval: Erc20ApprovalContracts;
  erc20: ContractConfig;
  native: ContractConfig;
  wrappedPair: ContractConfig;
};

export type TokenClaimContracts = {
  single: ContractConfig;
  all: ContractConfig;
  query: ContractConfig;
};

export type TokenConfidentialityContracts = {
  detection: ProbeContractConfig;
  confidentialBalance: ContractConfig;
  confidentialTransfer: ContractConfig;
  shield?: TokenShieldContracts;
  unshield?: ContractConfig;
  claims?: TokenClaimContracts;
};

export type TokenConfidentialityContractsByType = Partial<
  Record<TokenConfidentialityType, TokenConfidentialityContracts>
>;

function getRequiredContractConfig<TConfig>(
  configs: Partial<Record<TokenConfidentialityType, TConfig>>,
  confidentialityType: TokenConfidentialityType,
  operation: string
): TConfig {
  const config = configs[confidentialityType];
  if (!config) {
    throw new Error(`${operation} config is not defined for confidentialityType: ${confidentialityType}`);
  }
  return config;
}

const TOKEN_CONFIDENTIALITY_CONTRACTS = {
  wrapped: WRAPPED_TOKEN_CONTRACTS,
} as const satisfies TokenConfidentialityContractsByType;

function getDefaultShieldApprovalContracts(): Erc20ApprovalContracts {
  return WRAPPED_TOKEN_CONTRACTS.shield.approval;
}

function getContractsForType(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  return getRequiredContractConfig(TOKEN_CONFIDENTIALITY_CONTRACTS, confidentialityType, 'token contracts');
}

export function getTokenContractConfig(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  return getContractsForType(confidentialityType).confidentialBalance;
}

export function getSupportedTokenDetectionConfigs(): Array<{
  confidentialityType: SupportedTokenConfidentialityType;
  probe: ProbeContractConfig;
  confidentialValueType: ReturnType<typeof getTokenConfidentialValueType>;
}> {
  return TOKEN_CONFIDENTIALITY_TYPES.filter(
    (confidentialityType): confidentialityType is SupportedTokenConfidentialityType =>
      isSupportedTokenConfidentialityType(confidentialityType)
  ).map((confidentialityType) => ({
    confidentialityType,
    probe: getContractsForType(confidentialityType).detection,
    confidentialValueType: getTokenConfidentialValueType(confidentialityType),
  }));
}

export function getTransferContractConfig(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  return getContractsForType(confidentialityType).confidentialTransfer;
}

export function getShieldContractConfig(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  const contracts = getContractsForType(confidentialityType).shield;
  if (!contracts) {
    throw new Error(`shield config is not defined for confidentialityType: ${confidentialityType}`);
  }
  return contracts.erc20;
}

export function getShieldAllowanceContractConfig() {
  return getDefaultShieldApprovalContracts().allowance;
}

export function getShieldApproveContractConfig() {
  return getDefaultShieldApprovalContracts().approve;
}

export function getShieldEthContractConfig(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  const contracts = getContractsForType(confidentialityType).shield;
  if (!contracts) {
    throw new Error(`shield ETH config is not defined for confidentialityType: ${confidentialityType}`);
  }
  return contracts.native;
}

export function getShieldWrappedPairContractConfig(
  confidentialityType: Token['extensions']['fhenix']['confidentialityType']
) {
  const contracts = getContractsForType(confidentialityType).shield;
  if (!contracts) {
    throw new Error(`shield wrapped pair config is not defined for confidentialityType: ${confidentialityType}`);
  }
  return contracts.wrappedPair;
}

export function getUnshieldContractConfig(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  const contracts = getContractsForType(confidentialityType).unshield;
  if (!contracts) {
    throw new Error(`unshield config is not defined for confidentialityType: ${confidentialityType}`);
  }
  return contracts;
}

export function getClaimContractConfig(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  const contracts = getContractsForType(confidentialityType).claims;
  if (!contracts) {
    throw new Error(`claim config is not defined for confidentialityType: ${confidentialityType}`);
  }
  return contracts.all;
}

export function getClaimableContractConfig(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  const contracts = getContractsForType(confidentialityType).claims;
  if (!contracts) {
    throw new Error(`claimable config is not defined for confidentialityType: ${confidentialityType}`);
  }
  return contracts.query;
}
