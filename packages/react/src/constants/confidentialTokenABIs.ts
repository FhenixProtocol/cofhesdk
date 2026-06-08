import {
  getTokenWrapperKind,
  isSupportedTokenConfidentialityType,
  type Token,
  type TokenConfidentialityType,
  TOKEN_CONFIDENTIALITY_TYPES,
  type SupportedTokenConfidentialityType,
} from '@/types/token';
import { toFunctionSelector, type Abi, type Hex } from 'viem';

import { DUAL_TOKEN_CONTRACTS } from './confidentialTokenDual';
import { WRAPPED_NATIVE_TOKEN_CONTRACTS, WRAPPED_TOKEN_CONTRACTS } from './confidentialTokenWrapped';

export type ContractConfig = {
  abi: Abi;
  functionName: string;
};

export type Erc20ApprovalContracts = {
  allowance: ContractConfig;
  approve: ContractConfig;
};

export type TokenShieldContracts = {
  approval?: Erc20ApprovalContracts;
  erc20: ContractConfig;
  native?: ContractConfig;
  wrappedPair?: ContractConfig;
};

export type TokenClaimContracts = {
  single: ContractConfig;
  all?: ContractConfig;
  query: ContractConfig;
};

export type TokenConfidentialityContracts = {
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

const TOKEN_CONFIDENTIALITY_CONTRACTS: TokenConfidentialityContractsByType = {
  dual: DUAL_TOKEN_CONTRACTS,
  wrapped: WRAPPED_TOKEN_CONTRACTS,
};

function toInterfaceId(signatures: readonly string[]): Hex {
  const interfaceId = signatures
    .map((signature) => Number.parseInt(toFunctionSelector(signature), 16))
    .reduce((acc, selector) => acc ^ selector, 0);

  return `0x${(interfaceId >>> 0).toString(16).padStart(8, '0')}`;
}

export const TOKEN_CONFIDENTIALITY_TYPE_INTERFACE_IDS: Partial<Record<SupportedTokenConfidentialityType, Hex>> = {
  dual: toInterfaceId([
    'function shield(uint256)',
    'function unshield(uint64)',
    'function claimUnshielded(bytes32,uint64,bytes)',
  ]),
  wrapped: toInterfaceId([
    'function shield(address,uint256)',
    'function shieldNative(address)',
    'function shieldWrappedNative(address,uint256)',
    'function unshield(address,address,uint64)',
    'function getClaim(bytes32)',
    'function claimUnshieldedBatch(bytes32[],uint64[],bytes[])',
  ]),
};

export function detectSupportedTokenTypeFromInterfaces(
  results: Partial<Record<SupportedTokenConfidentialityType, boolean>>
): SupportedTokenConfidentialityType | undefined {
  const supportedTypes = TOKEN_CONFIDENTIALITY_TYPES.filter(
    (confidentialityType): confidentialityType is SupportedTokenConfidentialityType =>
      isSupportedTokenConfidentialityType(confidentialityType) && results[confidentialityType] === true
  );

  return supportedTypes.length === 1 ? supportedTypes[0] : undefined;
}
function getDefaultShieldApprovalContracts(): Erc20ApprovalContracts {
  const approval = WRAPPED_TOKEN_CONTRACTS.shield.approval;
  if (!approval) {
    throw new Error('Default shield approval config is not defined for wrapped tokens');
  }
  return approval;
}

function getContractsForType(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  return getRequiredContractConfig(TOKEN_CONFIDENTIALITY_CONTRACTS, confidentialityType, 'token contracts');
}

export function getTokenContractConfig(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  return getContractsForType(confidentialityType).confidentialBalance;
}

export function getTransferContractConfig(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  return getContractsForType(confidentialityType).confidentialTransfer;
}

function getShieldContractsForToken(token: Token): TokenShieldContracts | undefined {
  if (token.extensions.fhenix.confidentialityType === 'wrapped') {
    return getTokenWrapperKind(token) === 'native'
      ? WRAPPED_NATIVE_TOKEN_CONTRACTS.shield
      : WRAPPED_TOKEN_CONTRACTS.shield;
  }

  return getContractsForType(token.extensions.fhenix.confidentialityType).shield;
}

export function getShieldContractConfig(token: Token) {
  const contracts = getShieldContractsForToken(token);
  if (!contracts) {
    throw new Error(
      `shield config is not defined for confidentialityType: ${token.extensions.fhenix.confidentialityType}`
    );
  }
  return contracts.erc20;
}

export function getShieldAllowanceContractConfig() {
  return getDefaultShieldApprovalContracts().allowance;
}

export function getShieldApproveContractConfig() {
  return getDefaultShieldApprovalContracts().approve;
}

export function getShieldEthContractConfig(token: Token) {
  const contracts = getShieldContractsForToken(token);
  if (!contracts?.native) {
    throw new Error(
      `shield ETH config is not defined for confidentialityType: ${token.extensions.fhenix.confidentialityType}`
    );
  }
  return contracts.native;
}

export function getShieldWrappedPairContractConfig(token: Token) {
  const contracts = getShieldContractsForToken(token);
  if (!contracts?.wrappedPair) {
    throw new Error(
      `shield wrapped pair config is not defined for confidentialityType: ${token.extensions.fhenix.confidentialityType}`
    );
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

export function getClaimSingleContractConfig(
  confidentialityType: Token['extensions']['fhenix']['confidentialityType']
) {
  const contracts = getContractsForType(confidentialityType).claims;
  if (!contracts) {
    throw new Error(`claim config is not defined for confidentialityType: ${confidentialityType}`);
  }
  return contracts.single;
}

export function getClaimAllContractConfig(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  const contracts = getContractsForType(confidentialityType).claims;
  if (!contracts?.all) {
    throw new Error(`claim-all config is not defined for confidentialityType: ${confidentialityType}`);
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
