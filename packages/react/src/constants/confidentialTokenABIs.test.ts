import { describe, expect, it } from 'vitest';

import {
  TOKEN_CONFIDENTIALITY_TYPE_INTERFACE_IDS,
  detectSupportedTokenTypeFromInterfaces,
} from './confidentialTokenABIs';

describe('token confidentiality ERC165 detection', () => {
  it('defines distinct interface IDs for dual and wrapped tokens', () => {
    expect(TOKEN_CONFIDENTIALITY_TYPE_INTERFACE_IDS.dual).toMatch(/^0x[0-9a-f]{8}$/);
    expect(TOKEN_CONFIDENTIALITY_TYPE_INTERFACE_IDS.wrapped).toMatch(/^0x[0-9a-f]{8}$/);
    expect(TOKEN_CONFIDENTIALITY_TYPE_INTERFACE_IDS.dual).not.toBe(TOKEN_CONFIDENTIALITY_TYPE_INTERFACE_IDS.wrapped);
  });

  it('detects dual tokens from ERC165 support results', () => {
    expect(detectSupportedTokenTypeFromInterfaces({ dual: true, wrapped: false })).toBe('dual');
  });

  it('detects wrapped tokens from ERC165 support results', () => {
    expect(detectSupportedTokenTypeFromInterfaces({ dual: false, wrapped: true })).toBe('wrapped');
  });

  it('does not guess when ERC165 results are missing or ambiguous', () => {
    expect(detectSupportedTokenTypeFromInterfaces({})).toBeUndefined();
    expect(detectSupportedTokenTypeFromInterfaces({ dual: true, wrapped: true })).toBeUndefined();
  });
});
