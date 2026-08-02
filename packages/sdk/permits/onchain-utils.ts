import {
  BaseError,
  ContractFunctionRevertedError,
  type Hex,
  type PublicClient,
  decodeErrorResult,
  parseAbi,
} from 'viem';
import type { EIP712Domain, Permission } from './types';
import { TASK_MANAGER_ADDRESS } from '../core/consts.js';
import { CofheError, CofheErrorCode } from '../core/error.js';

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

export const checkPermitValidityOnChain = async (
  permission: Permission,
  publicClient: PublicClient
): Promise<boolean> => {
  const aclAddress = await getAclAddress(publicClient);

  // Check if the permit is valid
  try {
    await publicClient.simulateContract({
      address: aclAddress,
      abi: checkPermitValidityAbi,
      functionName: 'checkPermitValidity',
      args: [
        {
          issuer: permission.issuer,
          expiration: BigInt(permission.expiration),
          recipient: permission.recipient,
          validatorId: BigInt(permission.validatorId),
          validatorContract: permission.validatorContract,
          sealingKey: permission.sealingKey,
          issuerSignature: permission.issuerSignature,
          recipientSignature: permission.recipientSignature,
        },
      ],
    });
    return true;
  } catch (err: unknown) {
    // Viem default handling
    if (err instanceof BaseError) {
      const revertError = err.walk((inner) => inner instanceof ContractFunctionRevertedError);
      if (revertError instanceof ContractFunctionRevertedError) {
        // `data` is undefined when the revert data doesn't decode against our ABI (e.g. a custom
        // error declared elsewhere). Fall through to the strategies below rather than throwing an
        // empty error that discards the original one.
        const errorName = revertError.data?.errorName;
        if (errorName) {
          throw permitInvalidError(errorName, err);
        }
      }
    }

    // Check details field for custom error names (e.g., from Hardhat test nodes)
    const customErrorName = extractCustomErrorFromDetails(err, checkPermitValidityAbi);
    if (customErrorName) {
      throw permitInvalidError(customErrorName, err);
    }

    // Hardhat wrapped error will need to be unwrapped to get the return data
    const hhDetailsData = extractReturnData(err);
    if (hhDetailsData != null) {
      // Decoding throws when the return data isn't one of our ABI errors; keep the original error
      // in that case instead of surfacing an unrelated decode failure.
      const decodedErrorName = tryDecodeErrorName(hhDetailsData);
      if (decodedErrorName != null) {
        throw permitInvalidError(decodedErrorName, err);
      }
    }

    // Fallback throw the original error
    throw err;
  }
};

/** Builds the error thrown when the ACL rejected the permit with a known revert reason. */
function permitInvalidError(errorName: string, cause: unknown): CofheError {
  return new CofheError({
    code: CofheErrorCode.PermitInvalid,
    message: `On-chain permit validation reverted with ${errorName}`,
    cause: cause instanceof Error ? cause : new Error(String(cause)),
    context: { errorName },
  });
}

function tryDecodeErrorName(data: `0x${string}`): string | undefined {
  try {
    return decodeErrorResult({ abi: checkPermitValidityAbi, data }).errorName;
  } catch {
    return undefined;
  }
}

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
    name: 'checkPermitValidity',
    inputs: [
      {
        name: 'permission',
        type: 'tuple',
        internalType: 'struct Permission',
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
            name: 'validatorId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'validatorContract',
            type: 'address',
            internalType: 'address',
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
