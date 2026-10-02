import { describe, expect, it } from 'vitest';

import { checkBuildInfo } from '../src/index.js';
import { buildInfoWith, fixtures } from './fixtures/buildInfo.js';

const { fn } = fixtures;

const perValue = buildInfoWith('contracts/PerValue.sol', [
  fn({
    name: 'deposit',
    visibility: 'external',
    params: ['externalEuint64', 'bytes', 'externalEuint64', 'bytes'],
  }),
]);

const trailing = buildInfoWith('contracts/Trailing.sol', [
  fn({
    name: 'deposit',
    visibility: 'external',
    params: ['externalEuint64', 'externalEuint64', 'bytes'],
  }),
]);

describe('external-input-missing-proof', () => {
  it('flags external inputs with no proof bytes at all', () => {
    const info = buildInfoWith('contracts/NoProof.sol', [
      fn({ name: 'deposit', visibility: 'external', params: ['externalEuint64', 'address'] }),
    ]);

    const findings = checkBuildInfo(info).filter((f) => f.rule === 'external-input-missing-proof');

    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('error');
    expect(findings[0]!.message).toContain('never be verified');
  });

  it('accepts either arrangement, since the library supports both', () => {
    expect(checkBuildInfo(perValue)).toHaveLength(0);
    expect(checkBuildInfo(trailing)).toHaveLength(0);
  });

  it('ignores functions with no external inputs', () => {
    const info = buildInfoWith('contracts/Plain.sol', [
      fn({ name: 'poke', visibility: 'external', params: ['uint256'] }),
    ]);

    expect(checkBuildInfo(info)).toHaveLength(0);
  });
});

describe('proof-placement (opt-in)', () => {
  it('says nothing by default', () => {
    expect(checkBuildInfo(perValue)).toHaveLength(0);
    expect(checkBuildInfo(trailing)).toHaveLength(0);
  });

  it('warns on a per-value signature when trailing is pinned', () => {
    const findings = checkBuildInfo(perValue, { proofStyle: 'trailing' });

    expect(findings).toHaveLength(1);
    expect(findings[0]!.rule).toBe('proof-placement');
    expect(findings[0]!.severity).toBe('warning');
    expect(findings[0]!.message).toContain('trailing');
  });

  it('warns on a trailing signature when per-value is pinned', () => {
    const findings = checkBuildInfo(trailing, { proofStyle: 'per-value' });

    expect(findings).toHaveLength(1);
    expect(findings[0]!.rule).toBe('proof-placement');
    expect(findings[0]!.message).toContain('per-value');
  });

  it('accepts each arrangement under its own setting', () => {
    expect(checkBuildInfo(trailing, { proofStyle: 'trailing' })).toHaveLength(0);
    expect(checkBuildInfo(perValue, { proofStyle: 'per-value' })).toHaveLength(0);
  });

  it('stays quiet when the proof is missing entirely — that is the other rule', () => {
    const info = buildInfoWith('contracts/NoProof.sol', [
      fn({ name: 'deposit', visibility: 'external', params: ['externalEuint64'] }),
    ]);

    const findings = checkBuildInfo(info, { proofStyle: 'trailing' });

    expect(findings.map((f) => f.rule)).toEqual(['external-input-missing-proof']);
  });
});
