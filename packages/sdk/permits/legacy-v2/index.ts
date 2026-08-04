/**
 * Legacy Permit V2 engine — FROZEN.
 *
 * This is the released (pre-ACP) permit implementation, kept verbatim so the
 * SDK can serve chains whose ACL has not been upgraded to V3 yet: the EIP-712
 * struct (`PermissionedV2*` primary types, `validatorId`/`validatorContract`
 * fields), the `Permission` on-chain tuple, the SealingKey class flow, and the
 * V2 ACL entry point (`checkPermitValidity`).
 *
 * Do not refactor or "modernize" this code — deployed chains verify against
 * these exact typehashes (see the legacy freeze tests). It is deleted wholesale
 * once every supported chain runs the V3 ACL.
 *
 * Everything is exported under V2-suffixed names to keep the ACP namespace
 * clean; the only intended consumer is the version-branching layer in
 * `core/permits.ts`.
 */

export {
  type Permit as PermitV2,
  type SelfPermit as SelfPermitV2,
  type SharingPermit as SharingPermitV2,
  type RecipientPermit as RecipientPermitV2,
  type Permission as PermissionV2,
  type SerializedPermit as SerializedPermitV2,
  type CreateSelfPermitOptions as CreateSelfPermitOptionsV2,
  type CreateSharingPermitOptions as CreateSharingPermitOptionsV2,
  type ImportSharedPermitOptions as ImportSharedPermitOptionsV2,
  type PermitType as PermitTypeV2,
} from './types.js';

export { PermitUtils as PermitV2Utils } from './permit.js';
export { SignatureUtils as SignatureUtilsV2, SignatureTypes as SignatureTypesV2 } from './signature.js';
export { SealingKey as SealingKeyV2, GenerateSealingKey as GenerateSealingKeyV2 } from './sealing.js';
export { getAclEIP712Domain as getAclEIP712DomainV2, checkPermitValidityOnChain } from './onchain-utils.js';
