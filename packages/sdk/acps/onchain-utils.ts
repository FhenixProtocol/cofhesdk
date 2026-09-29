import { type Hex, type PublicClient, decodeErrorResult, parseAbi } from 'viem';
import type { ACPAccessStatus, EIP712Domain, ACPPublic } from './types';
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
 * ACP (ACP V3) signing domain — fetched from the ACL contract, which since V3
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

  if (version !== '2') {
    throw new Error(
      `Chain ${chainId}'s ACL serves EIP-712 domain version "${version}" — this SDK requires the upgraded (ACP-era) ACL, which signs as version "2". Pre-upgrade (V2 Permission) chains are not supported.`
    );
  }

  return {
    name,
    version,
    chainId: Number(chainId),
    verifyingContract,
  };
};

const toACPTuple = (acp: ACPPublic) => ({
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
});

/**
 * The custom error a reverted ACL call carries, however the node reports it: a viem revert, a
 * Hardhat-style 'reverted with custom error' detail, or raw return data. `undefined` when the
 * failure is not a contract revert (e.g. a network error).
 */
function revertErrorName(err: unknown, abi: readonly any[]): string | undefined {
  // Viem revert. Matched by name, not `instanceof`: the public client may come from another copy of
  // viem than this package (an app bringing its own), and then no class check ever matches.
  const walk = (err as { walk?: (fn: (e: unknown) => boolean) => unknown } | null)?.walk;
  if (typeof walk === 'function') {
    const revertError = walk.call(err, (e) => (e as { name?: string })?.name === 'ContractFunctionRevertedError') as
      | { data?: { errorName?: string } }
      | null
      | undefined;
    if (revertError) return revertError.data?.errorName ?? '';
  }

  // Check details field for custom error names (e.g., from Hardhat test nodes)
  const customErrorName = extractCustomErrorFromDetails(err, abi);
  if (customErrorName) return customErrorName;

  // Hardhat wrapped error will need to be unwrapped to get the return data
  const hhDetailsData = extractReturnData(err);
  if (hhDetailsData != null) return decodeErrorResult({ abi, data: hhDetailsData }).errorName;

  return undefined;
}

export const checkACPValidityOnChain = async (acp: ACPPublic, publicClient: PublicClient): Promise<boolean> => {
  const aclAddress = await getAclAddress(publicClient);

  // Check if the acp is valid (structure: expiration / signatures / revocation)
  try {
    await publicClient.simulateContract({
      address: aclAddress,
      abi: checkACPValidityAbi,
      functionName: 'checkPermissionValidity',
      args: [toACPTuple(acp)],
    });
    return true;
  } catch (err: any) {
    const errorName = revertErrorName(err, checkACPValidityAbi);
    if (errorName !== undefined) throw new Error(errorName);
    // Fallback throw the original error
    throw err;
  }
};

/** The ACL permission reverts, as statuses. */
const PERMISSION_ERROR_STATUS: Record<string, ACPAccessStatus> = {
  PermissionInvalid_Expired: 'expired',
  PermissionInvalid_Disabled: 'revoked',
  PermissionInvalid_IssuerSignature: 'invalid-issuer-signature',
  PermissionInvalid_RecipientSignature: 'invalid-recipient-signature',
};

/**
 * An ACP status on chain, read from the ACL: its validity (expiration, signatures, revocation)
 * and, given a handle, whether the ACP may read it. The ACL reverts for an invalid ACP; those
 * reverts come back as statuses. Anything else (e.g. a network error) still throws.
 */
export const getACPAccessStatusOnChain = async (
  acp: ACPPublic,
  publicClient: PublicClient,
  handle?: bigint | Hex
): Promise<ACPAccessStatus> => {
  const aclAddress = await getAclAddress(publicClient);

  try {
    if (handle === undefined) {
      await publicClient.simulateContract({
        address: aclAddress,
        abi: acpAccessAbi,
        functionName: 'checkPermissionValidity',
        args: [toACPTuple(acp)],
      });
      return 'valid';
    }

    const ctHash = BigInt(handle);
    const allowed = await publicClient.readContract({
      address: aclAddress,
      abi: acpAccessAbi,
      functionName: 'isAllowedWithPermission',
      args: [toACPTuple(acp), ctHash],
    });
    if (allowed) return 'allowed';

    // The ACL answers false both when the scope misses the handle and when the issuer itself may
    // not read it; the issuer own allowance tells the two apart.
    const issuerAllowed = await publicClient.readContract({
      address: aclAddress,
      abi: acpAccessAbi,
      functionName: 'isAllowed',
      args: [ctHash, acp.issuer],
    });
    return issuerAllowed ? 'out-of-scope' : 'issuer-not-allowed';
  } catch (err) {
    const status = PERMISSION_ERROR_STATUS[revertErrorName(err, acpAccessAbi) ?? ''];
    if (status) return status;
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

const checkACPValidityAbi = [
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

const acpAccessAbi = [
  ...checkACPValidityAbi,
  {
    type: 'function',
    name: 'isAllowedWithPermission',
    inputs: [checkACPValidityAbi[0].inputs[0], { name: 'handle', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isAllowed',
    inputs: [
      { name: 'handle', type: 'uint256', internalType: 'uint256' },
      { name: 'account', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
] as const;
