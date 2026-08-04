import { describe, it, expect } from 'vitest';
import { keccak256, stringToBytes, zeroAddress } from 'viem';
import { SignatureUtilsV2 } from '../legacy-v2/index.js';
import type { PermissionV2 } from '../legacy-v2/index.js';

/**
 * Typehash freeze for the legacy V2 permit engine.
 *
 * Deployed (pre-ACP) chains verify permits against exactly these typehashes —
 * they are mirrored from `PermissionUtils` in the released Permissioned.sol.
 * The type strings below are DERIVED from the legacy module's own field
 * definitions, so any edit to `legacy-v2/signature.ts` that changes the signed
 * struct fails here. If this test breaks, the fix is to revert the legacy
 * module change, never to update the pinned hashes.
 */

const PINNED_TYPEHASHES = {
  PermissionedV2IssuerSelf: '0x0ce0d938c38f948b8f9cf16098cd15ec62de132c8d422719ad270c5e2a101102',
  PermissionedV2IssuerShared: '0x8549e986c64faf9b741179c61561f9d39f337cf9739f86178d84dabc6ca4cad5',
  PermissionedV2Recipient: '0x82af07a6c9eb6bb31a0c86f7f5cad0039589750ad5b4b925ed5741f7ad4e8d4b',
} as const;

const dummyPermission: PermissionV2 = {
  issuer: zeroAddress,
  expiration: 0,
  recipient: zeroAddress,
  validatorId: 0,
  validatorContract: zeroAddress,
  sealingKey: `0x${'00'.repeat(32)}`,
  issuerSignature: '0x',
  recipientSignature: '0x',
};

const typehashOf = (primaryType: keyof typeof PINNED_TYPEHASHES): string => {
  const { types } = SignatureUtilsV2.getSignatureParams(dummyPermission, primaryType);
  const encodedType = `${primaryType}(${types[primaryType].map((f) => `${f.type} ${f.name}`).join(',')})`;
  return keccak256(stringToBytes(encodedType));
};

describe('legacy V2 typehash freeze', () => {
  for (const primaryType of Object.keys(PINNED_TYPEHASHES) as (keyof typeof PINNED_TYPEHASHES)[]) {
    it(`${primaryType} typehash is pinned`, () => {
      expect(typehashOf(primaryType)).to.equal(PINNED_TYPEHASHES[primaryType]);
    });
  }
});
