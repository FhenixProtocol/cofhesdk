import {
  BaseError,
  ContractFunctionRevertedError,
  type Hex,
  type PublicClient,
  decodeErrorResult,
  parseAbi,
} from 'viem';
import type { EIP712Domain, ACPPublic } from './types';
import { TASK_MANAGER_ADDRESS } from '../core/consts.js';

export const getAclAddress = async (publicClient: PublicClient): Promise<Hex> => {
  const ACL_IFACE = 'function acl() view returns (address)';

  // Parse the ABI for the ACL function
  const aclAbi = parseAbi([ACL_IFACE]);

  // Get the ACL address
  return (await publicClient.readContract({
    address: TASK_MANAGER_ADDRESS as `0x${string}`,
    abi: aclAbi,
    functionName: 'acl',
  })) as `0x${string}`;
};

/**
 * ACP (Permit V3) signing domain — fetched from the ACL contract, which since V3
 * carries the ACP verification logic and signs as name "ACL", version "2".
 */
export const getAclEIP712Domain = async (publicClient: PublicClient): Promise<EIP712Domain> => {
  const aclAddress = await getAclAddress(publicClient);
  const EIP712_DOMAIN_IFACE =
    'function eip712Domain() public view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)';

  // Parse the ABI for the EIP712 domain function
  const domainAbi = parseAbi([EIP712_DOMAIN_IFACE]);

  // Get the EIP712 domain
  const domain = await publicClient.readContract({
    address: aclAddress,
    abi: domainAbi,
    functionName: 'eip712Domain',
  });

  // eslint-disable-next-line no-unused-vars
  const [_fields, name, version, chainId, verifyingContract, _salt, _extensions] = domain;

  return {
    name,
    version,
    chainId: Number(chainId),
    verifyingContract,
  };
};

export const checkPermitValidityOnChain = async (acp: ACPPublic, publicClient: PublicClient): Promise<boolean> => {
  const aclAddress = await getAclAddress(publicClient);

  // Check if the permit is valid (structure: expiration / signatures / revocation)
  try {
    await publicClient.simulateContract({
      address: aclAddress,
      abi: checkPermitValidityAbi,
      functionName: 'checkPermissionValidity',
      args: [
        {
          issuer: acp.issuer,
          expiration: BigInt(acp.expiration),
          recipient: acp.recipient,
          revokerData: BigInt(acp.revokerData),
          revokerContract: acp.revokerContract,
          scope: acp.scope,
          contracts: acp.contracts,
          handles: acp.handles,
          sealingKey: acp.sealingKey,
          issuerSignature: acp.issuerSignature,
          recipientSignature: acp.recipientSignature,
        },
      ],
    });
    return true;
  } catch (err: any) {
    // Viem default handling
    if (err instanceof BaseError) {
      const revertError = err.walk((err: any) => err instanceof ContractFunctionRevertedError);
      if (revertError instanceof ContractFunctionRevertedError) {
        const errorName = revertError.data?.errorName ?? '';
        throw new Error(errorName);
      }
    }

    // Check details field for custom error names (e.g., from Hardhat test nodes)
    const customErrorName = extractCustomErrorFromDetails(err, checkPermitValidityAbi);
    if (customErrorName) {
      throw new Error(customErrorName);
    }

    // Hardhat wrapped error will need to be unwrapped to get the return data
    const hhDetailsData = extractReturnData(err);
    if (hhDetailsData != null) {
      const decoded = decodeErrorResult({
        abi: checkPermitValidityAbi,
        data: hhDetailsData,
      });

      throw new Error(decoded.errorName);
    }

    // Fallback throw the original error
    throw err;
  }
};

function extractCustomErrorFromDetails(err: unknown, abi: readonly any[]): string | undefined {
  // Check details field for custom error names (e.g., from Hardhat test nodes)
  const anyErr = err as any;
  const details = anyErr?.details ?? anyErr?.cause?.details;

  if (typeof details === 'string') {
    // Match pattern: "reverted with custom error 'ErrorName()'"
    const customErrorMatch = details.match(/reverted with custom error '(\w+)\(\)'/);
    if (customErrorMatch) {
      const errorName = customErrorMatch[1];
      // Check if this error exists in our ABI
      const errorExists = abi.some((item) => item.type === 'error' && item.name === errorName);
      if (errorExists) {
        return errorName;
      }
    }
  }

  return undefined;
}

function extractReturnData(err: unknown): `0x${string}` | undefined {
  // viem BaseError has `details`, but fall back to any message-like string we can find
  const anyErr = err as any;
  const s = anyErr?.details ?? anyErr?.cause?.details ?? anyErr?.shortMessage ?? anyErr?.message ?? String(err);

  return s.match(/return data:\s*(0x[a-fA-F0-9]+)/)?.[1] as `0x${string}` | undefined;
}

const checkPermitValidityAbi = [
  {
    type: 'function',
    name: 'checkPermissionValidity',
    inputs: [
      {
        name: 'acp',
        type: 'tuple',
        internalType: 'struct ACP',
        components: [
          {
            name: 'issuer',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'expiration',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'recipient',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'revokerData',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'revokerContract',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'scope',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'contracts',
            type: 'address[]',
            internalType: 'address[]',
          },
          {
            name: 'handles',
            type: 'bytes32[]',
            internalType: 'bytes32[]',
          },
          {
            name: 'sealingKey',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'issuerSignature',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'recipientSignature',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'error',
    name: 'PermissionInvalid_Disabled',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PermissionInvalid_Expired',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PermissionInvalid_IssuerSignature',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PermissionInvalid_RecipientSignature',
    inputs: [],
  },
] as const;
