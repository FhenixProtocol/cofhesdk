import { describe, it, expect } from 'vitest';
import { zeroAddress } from 'viem';
import { toV2SelfOptions, toV2SharingOptions, v2PermitToAcp, acpToV2Permission, toWirePermit } from '../legacy-v2/bridge.js';
import { SealingKeyV2 } from '../legacy-v2/index.js';
import type { PermitV2 } from '../legacy-v2/index.js';

const ISSUER = '0x1111111111111111111111111111111111111111' as const;
const RECIPIENT = '0x2222222222222222222222222222222222222222' as const;
const REVOKER = '0x3333333333333333333333333333333333333333' as const;

describe('legacy-v2 bridge', () => {
  it('maps revoker fields to validator fields in create options', () => {
    const v2 = toV2SelfOptions({ issuer: ISSUER, revokerData: 42, revokerContract: REVOKER, name: 'x' });
    expect(v2.validatorId).to.equal(42);
    expect(v2.validatorContract).to.equal(REVOKER);
    expect(v2.type).to.equal('self');
  });

  it('rejects scoped options — V2 chains only support global permits', () => {
    expect(() => toV2SelfOptions({ issuer: ISSUER, contracts: [RECIPIENT] })).to.throw(/upgraded/);
    expect(() => toV2SharingOptions({ issuer: ISSUER, recipient: RECIPIENT, handles: ['0x01'] })).to.throw(/upgraded/);
    expect(() => toV2SelfOptions({ issuer: ISSUER, scope: 1 })).to.throw(/upgraded/);
    // scope 0 (global) and empty arrays are fine
    expect(() => toV2SelfOptions({ issuer: ISSUER, scope: 0, contracts: [], handles: [] })).to.not.throw();
  });

  it('normalizes a signed V2 permit into a v2-tagged ACP and back into the Permission tuple', () => {
    const sealingPair = new SealingKeyV2('ab'.repeat(32), 'cd'.repeat(32));
    const v2Permit: PermitV2 = {
      hash: '0xhash',
      name: 'test',
      type: 'self',
      issuer: ISSUER,
      expiration: 1234567890,
      recipient: zeroAddress,
      validatorId: 99,
      validatorContract: REVOKER,
      sealingPair,
      issuerSignature: '0xdeadbeef',
      recipientSignature: '0x',
      _signedDomain: { name: 'ACL', version: '1', chainId: 1, verifyingContract: zeroAddress },
    };

    const acp = v2PermitToAcp(v2Permit);
    expect(acp.format).to.equal('v2');
    expect(acp.revokerData).to.equal(99);
    expect(acp.revokerContract).to.equal(REVOKER);
    expect(acp.scope).to.equal(0);
    expect(acp.contracts).to.deep.equal([]);
    expect(acp.sealingKey).to.equal(`0x${'cd'.repeat(32)}`);
    expect(acp.sealingPrivateKey).to.equal(`0x${'ab'.repeat(32)}`);

    const permission = acpToV2Permission(acp);
    expect(permission.validatorId).to.equal(99);
    expect(permission.validatorContract).to.equal(REVOKER);
    expect(permission.sealingKey).to.equal(acp.sealingKey);
    expect(permission).to.not.have.property('scope');
    expect(permission).to.not.have.property('revokerData');

    // the wire shape follows the tag
    const wire = toWirePermit(acp);
    expect(wire).to.have.property('validatorId');
    expect(wire).to.not.have.property('revokerData');
  });

  it('refuses to build a V2 Permission from an acp-format permit', () => {
    const sealingPair = new SealingKeyV2('ab'.repeat(32), 'cd'.repeat(32));
    const acp = { ...v2PermitToAcp({
      hash: '0x',
      name: '',
      type: 'self',
      issuer: ISSUER,
      expiration: 0,
      recipient: zeroAddress,
      validatorId: 0,
      validatorContract: zeroAddress,
      sealingPair,
      issuerSignature: '0x',
      recipientSignature: '0x',
    } as PermitV2), format: 'acp' as const };
    expect(() => acpToV2Permission(acp)).to.throw(/format "v2"/);
  });
});
