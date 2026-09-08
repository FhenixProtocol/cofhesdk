import { describe, it, expect } from 'vitest';
import { mapApiErrorCodeToCofheErrorCode, parseApiErrorResponseBody } from '../decrypt/apiError.js';
import { CofheErrorCode } from '../error.js';

const makeResponse = (opts: { status?: number; statusText?: string; json: () => Promise<unknown> }): Response => {
  return {
    status: opts.status ?? 500,
    statusText: opts.statusText ?? '',
    json: opts.json,
  } as unknown as Response;
};

describe('mapApiErrorCodeToCofheErrorCode', () => {
  const cases: Array<[string, CofheErrorCode]> = [
    ['bad_request', CofheErrorCode.BadRequest],
    ['unknown_chain', CofheErrorCode.UnknownChain],
    ['acp_malformed', CofheErrorCode.ACPMalformed],
    ['acp_denied', CofheErrorCode.ACPDenied],
    ['acp_expired', CofheErrorCode.ACPExpired],
    ['acp_invalid', CofheErrorCode.ACPInvalid],
    ['not_publicly_allowed', CofheErrorCode.NotPubliclyAllowed],
    ['ct_not_found', CofheErrorCode.CtNotFound],
    ['unsupported_security_zone', CofheErrorCode.UnsupportedSecurityZone],
    ['unsupported_type', CofheErrorCode.UnsupportedType],
    ['internal_error', CofheErrorCode.InternalError],
    ['signing_failed', CofheErrorCode.SigningFailed],
    ['ct_source_error', CofheErrorCode.CtSourceError],
    ['acp_verifier_error', CofheErrorCode.ACPVerifierError],
    ['ct_source_timeout', CofheErrorCode.CtSourceTimeout],
    ['acp_verifier_timeout', CofheErrorCode.ACPVerifierTimeout],
    ['acp_required', CofheErrorCode.ACPRequired],
    ['seal_failed', CofheErrorCode.SealFailed],
  ];

  it.each(cases)('maps %s to %s', (apiErrorCode, expected) => {
    expect(mapApiErrorCodeToCofheErrorCode(apiErrorCode, CofheErrorCode.DecryptFailed)).toBe(expected);
  });

  it('falls back for an unrecognized code', () => {
    expect(mapApiErrorCodeToCofheErrorCode('some_future_code', CofheErrorCode.DecryptFailed)).toBe(
      CofheErrorCode.DecryptFailed
    );
  });

  it('falls back for an undefined code', () => {
    expect(mapApiErrorCodeToCofheErrorCode(undefined, CofheErrorCode.SealOutputFailed)).toBe(
      CofheErrorCode.SealOutputFailed
    );
  });

  it('falls back for a code that only exists on Object.prototype', () => {
    for (const inherited of ['toString', 'constructor', 'valueOf', 'hasOwnProperty']) {
      expect(mapApiErrorCodeToCofheErrorCode(inherited, CofheErrorCode.DecryptFailed)).toBe(
        CofheErrorCode.DecryptFailed
      );
    }
  });
});

describe('parseApiErrorResponseBody', () => {
  it('reads error and error_message from a well-formed body', async () => {
    const response = makeResponse({
      status: 401,
      json: async () => ({ error: 'acp_expired', error_message: 'acp has expired' }),
    });

    await expect(parseApiErrorResponseBody(response)).resolves.toEqual({
      apiErrorCode: 'acp_expired',
      errorMessage: 'acp has expired',
    });
  });

  it('falls back to message when error_message is absent', async () => {
    const response = makeResponse({
      status: 500,
      json: async () => ({ error: 'internal_error', message: 'boom' }),
    });

    await expect(parseApiErrorResponseBody(response)).resolves.toEqual({
      apiErrorCode: 'internal_error',
      errorMessage: 'boom',
    });
  });

  it('falls back to HTTP <status> when body has neither error_message nor message', async () => {
    const response = makeResponse({
      status: 400,
      json: async () => ({ error: 'bad_request' }),
    });

    await expect(parseApiErrorResponseBody(response)).resolves.toEqual({
      apiErrorCode: 'bad_request',
      errorMessage: 'HTTP 400',
    });
  });

  it('falls back to statusText when the body is not JSON (framework rejection)', async () => {
    const response = makeResponse({
      status: 415,
      statusText: 'Unsupported Media Type',
      json: async () => {
        throw new Error('Unexpected token in JSON');
      },
    });

    await expect(parseApiErrorResponseBody(response)).resolves.toEqual({
      apiErrorCode: undefined,
      errorMessage: 'Unsupported Media Type',
    });
  });

  it('falls back to HTTP <status> when the body is not JSON and statusText is empty', async () => {
    const response = makeResponse({
      status: 405,
      statusText: '',
      json: async () => {
        throw new Error('Unexpected token in JSON');
      },
    });

    await expect(parseApiErrorResponseBody(response)).resolves.toEqual({
      apiErrorCode: undefined,
      errorMessage: 'HTTP 405',
    });
  });

  it('ignores a non-object JSON body', async () => {
    const response = makeResponse({
      status: 500,
      json: async () => 'just a string',
    });

    await expect(parseApiErrorResponseBody(response)).resolves.toEqual({
      apiErrorCode: undefined,
      errorMessage: 'HTTP 500',
    });
  });
});
