import { type Abi, type Address, type Hex } from 'viem';

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

export type ConfidentialTokenShieldContracts = {
  approval?: Erc20ApprovalContracts;
  erc20: ContractConfig;
  native?: ContractConfig;
  wrappedPair?: ContractConfig;
};

export type ConfidentialTokenClaimContracts = {
  single: ContractConfig;
  all?: ContractConfig;
  query: ContractConfig;
};

export type ConfidentialTokenContracts = {
  confidentialBalance: ContractConfig;
  confidentialTransfer: ContractConfig;
  shield?: ConfidentialTokenShieldContracts;
  unshield?: ContractConfig;
  claims?: ConfidentialTokenClaimContracts;
};

export type ConfidentialTokenOperationSupport = {
  confidentialBalance: boolean;
  transfer: boolean;
  publicBalance: boolean;
  shield: boolean;
  unshield: boolean;
  claim: boolean;
  claimable: boolean;
};

export type ConfidentialTokenTypeConfig = {
  enabled: boolean;
  label: string;
  confidentialValueType: 'uint64' | 'uint128';
  publicBalanceSource: 'erc20Pair' | 'token' | null;
  operations: ConfidentialTokenOperationSupport;
  contracts?: ConfidentialTokenContracts;
  interfaceIds?: readonly Hex[];
  pairResolution?: 'contractGetter' | 'native';
  pairGetterFunctionNames?: readonly string[];
  claimSubmission?: 'single' | 'batch';
  claimSummaryAmount?: 'requested' | 'decryptedWhenReady';
};

const ETH_ADDRESS_LOWERCASE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

const WRAPPED_TOKEN_OPERATIONS = {
  confidentialBalance: true,
  transfer: true,
  publicBalance: true,
  shield: true,
  unshield: true,
  claim: true,
  claimable: true,
} as const satisfies ConfidentialTokenOperationSupport;

export const TOKEN_TYPE_CONFIG = {
  wrappedErc20: {
    enabled: true,
    label: 'Wrapped ERC20 confidential token',
    confidentialValueType: 'uint64',
    publicBalanceSource: 'erc20Pair',
    operations: WRAPPED_TOKEN_OPERATIONS,
    contracts: WRAPPED_TOKEN_CONTRACTS,
    interfaceIds: ['0x4d52d826'], // IFHERC20ERC20Wrapper
    pairResolution: 'contractGetter',
    pairGetterFunctionNames: ['token', 'underlying', 'underlyingToken', 'asset', 'erc20', 'erc20Token'],
    claimSubmission: 'batch',
    claimSummaryAmount: 'requested',
  },
  wrappedNative: {
    enabled: true,
    label: 'Wrapped native confidential token',
    confidentialValueType: 'uint64',
    publicBalanceSource: 'erc20Pair',
    operations: WRAPPED_TOKEN_OPERATIONS,
    contracts: WRAPPED_NATIVE_TOKEN_CONTRACTS,
    interfaceIds: ['0xaefc9bc7'], // IFHERC20NativeWrapper
    pairResolution: 'native',
    claimSubmission: 'batch',
    claimSummaryAmount: 'requested',
  },
  pure: {
    enabled: false,
    label: 'Pure confidential token',
    confidentialValueType: 'uint64',
    publicBalanceSource: null,
    operations: {
      confidentialBalance: false,
      transfer: false,
      publicBalance: false,
      shield: false,
      unshield: false,
      claim: false,
      claimable: false,
    },
    claimSummaryAmount: 'decryptedWhenReady',
  },
  dual: {
    enabled: true,
    label: 'Dual-balance confidential token',
    confidentialValueType: 'uint64',
    publicBalanceSource: 'token',
    operations: {
      confidentialBalance: true,
      transfer: true,
      publicBalance: true,
      shield: true,
      unshield: true,
      claim: true,
      claimable: true,
    },
    contracts: DUAL_TOKEN_CONTRACTS,
    interfaceIds: ['0xbe4d657f'], // IERC20Confidential
    claimSubmission: 'single',
    claimSummaryAmount: 'requested',
  },
} as const satisfies Record<string, ConfidentialTokenTypeConfig>;

export type TokenConfidentialityType = keyof typeof TOKEN_TYPE_CONFIG;
export type ConfidentialTokenSupportOperation = keyof ConfidentialTokenOperationSupport;
export type SupportedTokenConfidentialityType = {
  [K in TokenConfidentialityType]: (typeof TOKEN_TYPE_CONFIG)[K]['enabled'] extends true ? K : never;
}[TokenConfidentialityType];

export const TOKEN_CONFIDENTIALITY_TYPES = Object.keys(TOKEN_TYPE_CONFIG) as TokenConfidentialityType[];

export const TOKEN_CONFIDENTIALITY_TYPE_INTERFACE_IDS = Object.fromEntries(
  TOKEN_CONFIDENTIALITY_TYPES.flatMap((confidentialityType) => {
    const config = TOKEN_TYPE_CONFIG[confidentialityType];
    if (!config.enabled) return [];
    return 'interfaceIds' in config ? [[confidentialityType, config.interfaceIds]] : [];
  })
) as Partial<Record<SupportedTokenConfidentialityType, readonly Hex[]>>;

export function isTokenConfidentialityType(value: string | undefined): value is TokenConfidentialityType {
  return typeof value === 'string' && value in TOKEN_TYPE_CONFIG;
}

export function isSupportedTokenConfidentialityType(
  value: string | undefined
): value is SupportedTokenConfidentialityType {
  return isTokenConfidentialityType(value) && TOKEN_TYPE_CONFIG[value].enabled;
}

export function detectSupportedTokenTypeFromInterfaces(
  results: Partial<Record<SupportedTokenConfidentialityType, boolean>>
): SupportedTokenConfidentialityType | undefined {
  const supportedTypes = TOKEN_CONFIDENTIALITY_TYPES.filter(
    (confidentialityType): confidentialityType is SupportedTokenConfidentialityType =>
      isSupportedTokenConfidentialityType(confidentialityType) && results[confidentialityType] === true
  );

  return supportedTypes.length === 1 ? supportedTypes[0] : undefined;
}

export function getTokenTypeConfig(confidentialityType: TokenConfidentialityType): ConfidentialTokenTypeConfig {
  return TOKEN_TYPE_CONFIG[confidentialityType];
}

export function getTokenTypeContracts(confidentialityType: TokenConfidentialityType) {
  const contracts = getTokenTypeConfig(confidentialityType).contracts;
  if (!contracts) {
    throw new Error(`token contracts config is not defined for confidentialityType: ${confidentialityType}`);
  }
  return contracts;
}

export function isWrappedTokenConfidentialityType(
  confidentialityType: string | undefined
): confidentialityType is Extract<TokenConfidentialityType, 'wrappedErc20' | 'wrappedNative'> {
  return confidentialityType === 'wrappedErc20' || confidentialityType === 'wrappedNative';
}

type ConfidentialTokenLike = {
  address: Address;
  extensions: {
    fhenix: {
      confidentialityType: TokenConfidentialityType;
      erc20Pair?: {
        address: Address;
      };
    };
  };
};

type ContractCallArgs = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  account: Address;
  chain: undefined;
};

export function getTokenWrapperKindFromConfig(token: ConfidentialTokenLike): 'erc20' | 'native' | undefined {
  if (!isWrappedTokenConfidentialityType(token.extensions.fhenix.confidentialityType)) {
    return undefined;
  }

  return token.extensions.fhenix.erc20Pair?.address?.toLowerCase() === ETH_ADDRESS_LOWERCASE ? 'native' : 'erc20';
}

export function getShieldContractsForToken(token: ConfidentialTokenLike): ConfidentialTokenShieldContracts | undefined {
  const config = getTokenTypeConfig(token.extensions.fhenix.confidentialityType);

  return config.contracts?.shield;
}

export function buildTokenShieldCallArgs(params: { token: ConfidentialTokenLike; amount: bigint; account: Address }): {
  main: ContractCallArgs;
  approval?: ContractCallArgs;
} {
  const { token, amount, account } = params;
  const tokenAddress = token.address;
  const contracts = getShieldContractsForToken(token);

  if (!contracts) {
    throw new Error(
      `shield config is not defined for confidentialityType: ${token.extensions.fhenix.confidentialityType}`
    );
  }

  if (token.extensions.fhenix.confidentialityType === 'dual') {
    return {
      main: {
        address: tokenAddress,
        abi: contracts.erc20.abi,
        functionName: contracts.erc20.functionName,
        args: [amount],
        account,
        chain: undefined,
      },
    };
  }

  const erc20PairAddress = token.extensions.fhenix.erc20Pair?.address;
  const isEth = erc20PairAddress?.toLowerCase() === ETH_ADDRESS_LOWERCASE;

  if (isEth && contracts.native) {
    return {
      main: {
        address: tokenAddress,
        abi: contracts.native.abi,
        functionName: contracts.native.functionName,
        args: [account],
        value: amount,
        account,
        chain: undefined,
      },
    };
  }

  if (!erc20PairAddress) {
    return {
      main: {
        address: tokenAddress,
        abi: contracts.erc20.abi,
        functionName: contracts.erc20.functionName,
        args: [account, amount],
        account,
        chain: undefined,
      },
    };
  }

  if (!contracts.wrappedPair || !contracts.approval) {
    throw new Error(
      `wrapped-pair shield config is not defined for confidentialityType: ${token.extensions.fhenix.confidentialityType}`
    );
  }

  return {
    approval: {
      address: erc20PairAddress,
      abi: contracts.approval.approve.abi,
      functionName: contracts.approval.approve.functionName,
      args: [tokenAddress, amount],
      account,
      chain: undefined,
    },
    main: {
      address: tokenAddress,
      abi: contracts.wrappedPair.abi,
      functionName: contracts.wrappedPair.functionName,
      args: [account, amount],
      account,
      chain: undefined,
    },
  };
}

export function buildTokenUnshieldCallArgs(params: {
  token: ConfidentialTokenLike;
  amount: bigint;
  account: Address;
}): ContractCallArgs {
  const { token, amount, account } = params;
  const confidentialityType = token.extensions.fhenix.confidentialityType;
  const contractConfig = getTokenTypeContracts(confidentialityType).unshield;

  if (!contractConfig) {
    throw new Error(`unshield config is not defined for confidentialityType: ${confidentialityType}`);
  }

  return {
    address: token.address,
    abi: contractConfig.abi,
    functionName: contractConfig.functionName,
    args: isWrappedTokenConfidentialityType(confidentialityType) ? [account, account, amount] : [amount],
    account,
    chain: undefined,
  };
}

export function buildTokenClaimCallArgs(params: {
  token: ConfidentialTokenLike;
  account: Address;
  claim?: {
    ctHash: Hex | bigint;
    decryptedAmount: bigint;
    decryptionProof: `0x${string}`;
  };
  claims?: Array<{
    ctHash: Hex | bigint;
    decryptedAmount: bigint;
    decryptionProof: `0x${string}`;
  }>;
}): ContractCallArgs | undefined {
  const { token, account, claim, claims } = params;
  const confidentialityType = token.extensions.fhenix.confidentialityType;
  const claimSubmission = getTokenTypeConfig(confidentialityType).claimSubmission;

  if (claimSubmission === 'single') {
    if (!claim) {
      throw new Error(`${confidentialityType} claim requires ctHash, decryptedAmount, and decryptionProof`);
    }

    const contractConfig = getTokenTypeContracts(confidentialityType).claims?.single;
    if (!contractConfig) {
      throw new Error(`claim config is not defined for confidentialityType: ${confidentialityType}`);
    }

    return {
      address: token.address,
      abi: contractConfig.abi,
      functionName: contractConfig.functionName,
      args: [claim.ctHash, claim.decryptedAmount, claim.decryptionProof],
      account,
      chain: undefined,
    };
  }

  if (!claims?.length) {
    return undefined;
  }

  const contractConfig = getTokenTypeContracts(confidentialityType).claims?.all;
  if (!contractConfig) {
    throw new Error(`claim-all config is not defined for confidentialityType: ${confidentialityType}`);
  }

  return {
    address: token.address,
    abi: contractConfig.abi,
    functionName: contractConfig.functionName,
    args: [
      claims.map((item) => item.ctHash),
      claims.map((item) => item.decryptedAmount),
      claims.map((item) => item.decryptionProof),
    ],
    account,
    chain: undefined,
  };
}
