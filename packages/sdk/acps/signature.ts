import { type EIP712Message, type EIP712Types, type ACPPublic, type ACPSignaturePrimaryType } from './types.js';

// Field order must match the on-chain ACP typehash strings exactly (see ACP.sol / ACPUtils)
const ACPSignatureAllFields = [
  { name: 'issuer', type: 'address' },
  { name: 'expiration', type: 'uint64' },
  { name: 'recipient', type: 'address' },
  { name: 'revokerData', type: 'uint256' },
  { name: 'revokerContract', type: 'address' },
  { name: 'scope', type: 'uint8' },
  { name: 'contracts', type: 'address[]' },
  { name: 'handles', type: 'bytes32[]' },
  { name: 'sealingKey', type: 'bytes32' },
  { name: 'issuerSignature', type: 'bytes' },
] as const;

type ACPSignatureFieldOption = (typeof ACPSignatureAllFields)[number]['name'];

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
  ] satisfies ACPSignatureFieldOption[],
  ACPIssuerShared: [
    'issuer',
    'expiration',
    'recipient',
    'revokerData',
    'revokerContract',
    'scope',
    'contracts',
    'handles',
  ] satisfies ACPSignatureFieldOption[],
  ACPRecipient: ['sealingKey', 'issuerSignature'] satisfies ACPSignatureFieldOption[],
} as const;

/**
 * Get signature types and message for EIP712 signing
 */
export const getSignatureTypesAndMessage = <T extends ACPSignatureFieldOption>(
  primaryType: ACPSignaturePrimaryType,
  fields: T[] | readonly T[],
  values: Pick<ACPPublic, T> & Partial<ACPPublic>
): { types: EIP712Types; primaryType: string; message: EIP712Message } => {
  const types = {
    [primaryType]: ACPSignatureAllFields.filter((fieldType) => fields.includes(fieldType.name as T)),
  };

  const message: Record<T, string | string[] | number | number[] | boolean> = {} as Record<
    T,
    string | string[] | number | number[] | boolean
  >;
  fields.forEach((field) => {
    if (field in values) {
      message[field] = values[field];
    }
  });

  return { types, primaryType, message: message as EIP712Message };
};

/**
 * Signature utilities for ACP operations
 */
export const SignatureUtils = {
  /**
   * Get signature parameters for an ACP
   */
  getSignatureParams: (acp: ACPPublic, primaryType: ACPSignaturePrimaryType) => {
    return getSignatureTypesAndMessage(primaryType, SignatureTypes[primaryType], acp);
  },

  /**
   * Determine the required signature type based on acp type
   */
  getPrimaryType: (acpType: 'self' | 'sharing' | 'recipient'): ACPSignaturePrimaryType => {
    if (acpType === 'self') return 'ACPIssuerSelf';
    if (acpType === 'sharing') return 'ACPIssuerShared';
    if (acpType === 'recipient') return 'ACPRecipient';
    throw new Error(`Unknown acp type: ${acpType}`);
  },
};
