import type {
  ACP,
  ACPPublic,
  CreateSelfPermitOptions,
  CreateSharingPermitOptions,
  ImportSharedPermitOptions,
} from '../types.js';
import { ACPUtils } from '../permit.js';
import type {
  Permit as PermitV2,
  Permission as PermissionV2,
  CreateSelfPermitOptions as CreateSelfPermitOptionsV2,
  CreateSharingPermitOptions as CreateSharingPermitOptionsV2,
  ImportSharedPermitOptions as ImportSharedPermitOptionsV2,
} from './types.js';

/**
 * Bridge between the ACP API surface and the frozen V2 engine.
 *
 * The SDK exposes one (ACP-shaped) API regardless of chain generation. On a
 * V2 chain, create options are translated to V2 options, the frozen engine
 * signs the `PermissionedV2*` typed data, and the signed permit is normalized
 * back into an ACP-shaped object tagged `format: 'v2'` — so storage and every
 * downstream consumer handle a single shape. The tag is what payload
 * serializers and on-chain checks branch on.
 *
 * Field correspondence (rename only — the on-chain revoker/validator interface
 * `disabled(address issuer, uint256 id)` is identical in both generations):
 *   revokerData     <-> validatorId
 *   revokerContract <-> validatorContract
 * Scope (`scope`/`contracts`/`handles`) does not exist in V2 — scoped options
 * are rejected, and normalized V2 permits are always global (scope 0).
 *
 * This file is NOT part of the frozen engine — it may evolve with the ACP API.
 */

const assertNoScopeOptions = (options: { scope?: number; contracts?: string[]; handles?: unknown[] }): void => {
  const hasScope =
    (options.scope != null && options.scope !== 0) ||
    (options.contracts != null && options.contracts.length > 0) ||
    (options.handles != null && options.handles.length > 0);
  if (hasScope) {
    throw new Error(
      "Scoped permits (contracts/handles) require the upgraded (ACP) ACL — this chain's ACL only supports global permits"
    );
  }
};

export const toV2SelfOptions = (options: CreateSelfPermitOptions): CreateSelfPermitOptionsV2 => {
  assertNoScopeOptions(options);
  return {
    type: 'self',
    issuer: options.issuer,
    name: options.name,
    expiration: options.expiration,
    validatorId: options.revokerData,
    validatorContract: options.revokerContract,
  };
};

export const toV2SharingOptions = (options: CreateSharingPermitOptions): CreateSharingPermitOptionsV2 => {
  assertNoScopeOptions(options);
  return {
    type: 'sharing',
    issuer: options.issuer,
    recipient: options.recipient,
    name: options.name,
    expiration: options.expiration,
    validatorId: options.revokerData,
    validatorContract: options.revokerContract,
  };
};

/**
 * Import options may originate from an old-SDK export (validatorId keys) or a
 * new-SDK export (revokerData keys) — both are accepted.
 */
export const toV2ImportOptions = (
  options: (ImportSharedPermitOptions & { validatorId?: number; validatorContract?: string }) | string
): ImportSharedPermitOptionsV2 | string => {
  if (typeof options === 'string') return options;
  assertNoScopeOptions(options);
  return {
    type: 'sharing',
    issuer: options.issuer,
    recipient: options.recipient,
    issuerSignature: options.issuerSignature,
    name: options.name,
    expiration: options.expiration,
    validatorId: options.validatorId ?? options.revokerData,
    validatorContract: options.validatorContract ?? options.revokerContract,
  };
};

/** Normalize a signed V2 permit into the ACP shape, tagged `format: 'v2'`. */
export const v2PermitToAcp = (permit: PermitV2): ACP => {
  return {
    format: 'v2',
    hash: permit.hash,
    name: permit.name,
    type: permit.type,
    issuer: permit.issuer,
    expiration: permit.expiration,
    recipient: permit.recipient,
    revokerData: permit.validatorId,
    revokerContract: permit.validatorContract,
    scope: 0,
    contracts: [],
    handles: [],
    sealingKey: `0x${permit.sealingPair.publicKey}`,
    sealingPrivateKey: `0x${permit.sealingPair.privateKey}`,
    issuerSignature: permit.issuerSignature,
    recipientSignature: permit.recipientSignature,
    _signedDomain: permit._signedDomain,
  };
};

/**
 * Reconstruct the V2 `Permission` tuple from a v2-tagged ACP — the shape the
 * V2 ACL (`checkPermitValidity`) and the pre-upgrade decryption backend expect.
 */
/**
 * The permit object as sent over the wire (decryption backend request bodies):
 * the ACP struct for upgraded chains, the V2 Permission struct for pre-upgrade
 * chains — whichever protocol the permit was signed under.
 */
export type WirePermit = ACPPublic | PermissionV2;

export const toWirePermit = (acp: ACP): WirePermit => {
  return acp.format === 'v2' ? acpToV2Permission(acp) : ACPUtils.getPublic(acp, true);
};

export const acpToV2Permission = (acp: ACP): PermissionV2 => {
  if (acp.format !== 'v2') {
    throw new Error('acpToV2Permission requires a permit created for a V2 chain (format "v2")');
  }
  return {
    issuer: acp.issuer,
    expiration: acp.expiration,
    recipient: acp.recipient,
    validatorId: acp.revokerData,
    validatorContract: acp.revokerContract,
    sealingKey: acp.sealingKey,
    issuerSignature: acp.issuerSignature,
    recipientSignature: acp.recipientSignature,
  };
};
