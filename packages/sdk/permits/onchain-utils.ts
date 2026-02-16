import { type Hex, type PublicClient, parseAbi } from 'viem';
import type { EIP712Domain, Permission } from './types';

export const getAclAddress = async (publicClient: PublicClient): Promise<Hex> => {
  // Hardcoded constants from the original implementation
  const TASK_MANAGER_ADDRESS = '0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9';
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

export const checkPermitValidityOnChain = async (permission: Permission, publicClient: PublicClient): Promise<boolean> => {
  const aclAddress = await getAclAddress(publicClient);
  const CHECK_PERMIT_VALIDITY_IFACE =
    'function checkPermitValidity(Permission memory permission) public view returns (bool)';

  // Parse the ABI for the EIP712 domain function
  const checkPermitValidityAbi = parseAbi([CHECK_PERMIT_VALIDITY_IFACE]);

  // Check if the permit is valid
  return publicClient.readContract({
    address: aclAddress,
    abi: checkPermitValidityAbi,
    functionName: 'checkPermitValidity',
    args: [permission],
  });
};
