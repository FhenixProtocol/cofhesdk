/* eslint-disable */

import { SealingKey as SealingKeyClass, EthEncryptedData } from './sealing'

/**
 * EIP712 related types
 */
export type EIP712Type = { name: string; type: string }
export type EIP712Types = Record<string, EIP712Type[]>
export type EIP712Message = Record<string, string>
export type EIP712Domain = {
	chainId: number
	name: string
	verifyingContract: `0x${string}`
	version: string
}

/**
 * Sealing key type - using the actual SealingKey class
 */
export type SealingKey = SealingKeyClass

/**
 * Re-export EthEncryptedData from sealing module
 */
export type { EthEncryptedData }

// Viem client types will be imported from viem package

/**
 * Core Permit interface - immutable design for React compatibility
 */
export interface Permit {
	/**
	 * Name for this permit, for organization and UI usage, not included in signature.
	 */
	name: string
	/**
	 * The type of the Permit (self / sharing)
	 * (self) Permit that will be signed and used by the issuer
	 * (sharing) Permit that is signed by the issuer, but intended to be shared with recipient
	 * (recipient) Permit that has been received, and signed by the recipient
	 */
	type: 'self' | 'sharing' | 'recipient'
	/**
	 * (base) User that initially created the permission, target of data fetching
	 */
	issuer: string
	/**
	 * (base) Expiration timestamp
	 */
	expiration: number
	/**
	 * (sharing) The user that this permission will be shared with
	 * ** optional, use `address(0)` to disable **
	 */
	recipient: string
	/**
	 * (issuer defined validation) An id used to query a contract to check this permissions validity
	 * ** optional, use `0` to disable **
	 */
	validatorId: number
	/**
	 * (issuer defined validation) The contract to query to determine permission validity
	 * ** optional, user `address(0)` to disable **
	 */
	validatorContract: string
	/**
	 * (base) The publicKey of a sealingPair used to re-encrypt `issuer`s confidential data
	 *   (non-sharing) Populated by `issuer`
	 *   (sharing)     Populated by `recipient`
	 */
	sealingPair: SealingKey
	/**
	 * (base) `signTypedData` signature created by `issuer`.
	 * (base) Shared- and Self- permissions differ in signature format: (`sealingKey` absent in shared signature)
	 *   (non-sharing) < issuer, expiration, recipient, validatorId, validatorContract, sealingKey >
	 *   (sharing)     < issuer, expiration, recipient, validatorId, validatorContract >
	 */
	issuerSignature: string
	/**
	 * (sharing) `signTypedData` signature created by `recipient` with format:
	 * (sharing) < sealingKey, issuerSignature>
	 * ** required for shared permits **
	 */
	recipientSignature: string
	/**
	 * EIP712 domain used to sign this permit.
	 * Should not be set manually, included in metadata as part of serialization flows.
	 */
	_signedDomain?: EIP712Domain
}

/**
 * Optional additional metadata of a Permit
 * Can be passed into the constructor, but not necessary
 * Useful for deserialization
 */
export interface PermitMetadata {
	/**
	 * EIP712 domain used to sign this permit.
	 * Should not be set manually, included in metadata as part of serialization flows.
	 */
	_signedDomain?: EIP712Domain
}

/**
 * Utility types for permit creation
 */
export type PickPartial<T, F extends keyof T> = Expand<Omit<T, F> & Partial<Pick<T, F>>>

export type PermitCore = Expand<Pick<Permit, 'issuer'> & Partial<Pick<Permit, 'recipient' | 'validatorId' | 'validatorContract'>>>

export type PermitOptions =
	// Self permit requires at minimum `issuer`, excludes `recipient`, `recipientSignature`, and `sealingPair`
	| Expand<
			Partial<Omit<Permit, 'recipient' | 'recipientSignature' | 'sealingPair'>> & {
				type: 'self'
				issuer: string
			}
	  >
	// Sharing permit requires at minimum `issuer` and `recipient`, excludes `recipientSignature` and `sealingPair`
	| Expand<
			Partial<Omit<Permit, 'recipientSignature' | 'sealingPair'>> & {
				type: 'sharing'
				issuer: string
				recipient: string
			}
	  >
	// Recipient permit requires the full issuer's permit, excludes `sealingPair`
	| Expand<
			Partial<Omit<Permit, 'sealingPair'>> & {
				type: 'recipient'
				issuer: string
				recipient: string
				issuerSignature: string
			}
	  >

// Specific option types for each permit creation method
export type SelfPermitOptions = {
	type: 'self'
	issuer: string
	name?: string
	expiration?: number
	validatorId?: number
	validatorContract?: string
}

export type SharingPermitOptions = {
	type: 'sharing'
	issuer: string
	recipient: string
	name?: string
	expiration?: number
	validatorId?: number
	validatorContract?: string
}

export type ImportPermitOptions = {
	type: 'recipient'
	issuer: string
	recipient: string
	issuerSignature: string
	name?: string
	expiration?: number
	validatorId?: number
	validatorContract?: string
}

export type SerializedPermit = Omit<Permit, 'sealingPair'> & {
	_signedDomain?: EIP712Domain
	sealingPair: {
		privateKey: string
		publicKey: string
	}
}

/**
 * A type representing the Permission struct that is passed to Permissioned.sol to grant encrypted data access.
 */
export type Permission = Expand<
	Omit<Permit, 'name' | 'type' | 'sealingPair'> & {
		sealingKey: string
	}
>

/**
 * Validation result type
 */
export interface ValidationResult {
	valid: boolean
	error: string | null
}

/**
 * Signature types for EIP712 signing
 */
export type PermitSignaturePrimaryType = 'PermissionedV2IssuerSelf' | 'PermissionedV2IssuerShared' | 'PermissionedV2Recipient'

// Utils
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never
