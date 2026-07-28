import { type EIP712Message, type EIP712Types, type Permission, type PermitSignaturePrimaryType } from './types.js';

// Field order must match the on-chain ACP typehash strings exactly (see ACP.sol / ACPUtils)
const PermitSignatureAllFields = [
  { name: 'issuer', type: 'address' },
  { name: 'expiration', type: 'uint64' },
  { name: 'recipient', type: 'address' },
  { name: 'revokerData', type: 'uint256' },
  { name: 'revokerContract', type: 'address' },
  { name: 'scope', type: 'uint8' },
  { name: 'contracts', type: 'address[]' },
  { name: 'handles', type: 'uint256[]' },
  { name: 'sealingKey', type: 'bytes32' },
  { name: 'issuerSignature', type: 'bytes' },
] as const;

type PermitSignatureFieldOption = (typeof PermitSignatureAllFields)[number]['name'];

export const SignatureTypes = {
  ACPIssuerSelf: [
    'issuer',
    'expiration',
    'recipient',
    'revokerData',
    'revokerContract',
    'scope',
    'contracts',
    'handles',
    'sealingKey',
  ] satisfies PermitSignatureFieldOption[],
  ACPIssuerShared: [
    'issuer',
    'expiration',
    'recipient',
    'revokerData',
    'revokerContract',
    'scope',
    'contracts',
    'handles',
  ] satisfies PermitSignatureFieldOption[],
  ACPRecipient: ['sealingKey', 'issuerSignature'] satisfies PermitSignatureFieldOption[],
} as const;

/**
 * Get signature types and message for EIP712 signing
 */
export const getSignatureTypesAndMessage = <T extends PermitSignatureFieldOption>(
  primaryType: PermitSignaturePrimaryType,
  fields: T[] | readonly T[],
  values: Pick<Permission, T> & Partial<Permission>
): { types: EIP712Types; primaryType: string; message: EIP712Message } => {
  const types = {
    [primaryType]: PermitSignatureAllFields.filter((fieldType) => fields.includes(fieldType.name as T)),
  };

  const message: Record<T, string | string[] | number | number[] | boolean | bigint[]> = {} as Record<
    T,
    string | string[] | number | number[] | boolean | bigint[]
  >;
  fields.forEach((field) => {
    if (field in values) {
      message[field] = values[field];
    }
  });

  return { types, primaryType, message: message as EIP712Message };
};

/**
 * Signature utilities for permit operations
 */
export const SignatureUtils = {
  /**
   * Get signature parameters for a permit
   */
  getSignatureParams: (permit: Permission, primaryType: PermitSignaturePrimaryType) => {
    return getSignatureTypesAndMessage(primaryType, SignatureTypes[primaryType], permit);
  },

  /**
   * Determine the required signature type based on permit type
   */
  getPrimaryType: (permitType: 'self' | 'sharing' | 'recipient'): PermitSignaturePrimaryType => {
    if (permitType === 'self') return 'ACPIssuerSelf';
    if (permitType === 'sharing') return 'ACPIssuerShared';
    if (permitType === 'recipient') return 'ACPRecipient';
    throw new Error(`Unknown permit type: ${permitType}`);
  },
};
