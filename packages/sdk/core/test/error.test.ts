import { describe, expect, it } from 'vitest';
import { CofheError, CofheErrorCode, isCofheError } from '../error';

const notFound = () =>
  new CofheError({
    code: CofheErrorCode.ACPNotFound,
    message: 'No active ACP',
    hint: 'Call client.acp.getOrCreateSelfACP().',
  });

describe('CofheError message', () => {
  it('keeps shortMessage clean and puts the cause and the hint in message', () => {
    const error = new CofheError({
      code: CofheErrorCode.FetchKeysFailed,
      message: 'Fetching keys failed',
      hint: 'Check the chain config.',
      cause: new Error('socket hang up'),
    });

    expect(error.shortMessage).toBe('Fetching keys failed');
    expect(error.message).toBe(
      `Fetching keys failed | Caused by: socket hang up | Hint: Check the chain config. | Guide: ${error.repairGuide}`
    );
  });

  it('message is shortMessage and the guide without a cause or a hint', () => {
    const error = new CofheError({ code: CofheErrorCode.InternalError, message: 'Boom' });

    expect(error.message).toBe(`Boom | Guide: ${error.repairGuide}`);
    expect(error.shortMessage).toBe('Boom');
  });

  it('toString prints the hint on its own line, not inside the headline', () => {
    const [headline, hintLine] = notFound().toString().split('\n');

    expect(headline).toBe('CofheError [ACP_NOT_FOUND]: No active ACP');
    expect(hintLine).toBe('Hint: Call client.acp.getOrCreateSelfACP().');
  });

  it('serialize includes shortMessage', () => {
    expect(JSON.parse(notFound().serialize()).shortMessage).toBe('No active ACP');
  });
});

describe('isCofheError', () => {
  it('recognises a CofheError and rejects other values', () => {
    expect(isCofheError(notFound())).toBe(true);
    expect(isCofheError(new Error('No active ACP'))).toBe(false);
    expect(isCofheError({ name: 'CofheError', code: CofheErrorCode.ACPNotFound })).toBe(false);
    expect(isCofheError(null)).toBe(false);
    expect(isCofheError('ACP_NOT_FOUND')).toBe(false);
  });

  it('with a code, matches only that code', () => {
    expect(isCofheError(notFound(), CofheErrorCode.ACPNotFound)).toBe(true);
    expect(isCofheError(notFound(), CofheErrorCode.ACPExpired)).toBe(false);
    expect(isCofheError(new Error('x'), CofheErrorCode.ACPNotFound)).toBe(false);
  });

  it('recognises an error from another copy of the SDK, where instanceof fails', () => {
    // What a second copy of the package produces: its own class, the same registered brand.
    class ForeignCofheError extends Error {
      readonly code = CofheErrorCode.ACPNotFound;
    }
    const foreign = Object.assign(new ForeignCofheError('No active ACP'), {
      [Symbol.for('@cofhe/sdk/CofheError')]: true,
    });

    expect(foreign instanceof CofheError).toBe(false);
    expect(isCofheError(foreign, CofheErrorCode.ACPNotFound)).toBe(true);
    expect(CofheError.fromError(foreign)).toBe(foreign);
  });
});

describe('CofheError context in logs', () => {
  const client = { request: async () => null, transport: { url: 'https://rpc.example/v2/SECRET_API_KEY' } };

  it('never prints a client that ended up in context', () => {
    const error = new CofheError({
      code: CofheErrorCode.NotConnected,
      message: 'Not connected',
      context: { chainId: 1, publicClient: client, nested: { walletClient: client } },
    });

    for (const output of [error.serialize(), error.toString()]) {
      expect(output).not.toContain('SECRET_API_KEY');
      expect(output).toContain('[Client]');
      expect(output).toContain('"chainId":1');
    }
  });

  it('does not throw on a circular context', () => {
    const circular: Record<string, unknown> = { name: 'loop' };
    circular.self = circular;
    const error = new CofheError({ code: CofheErrorCode.InternalError, message: 'Boom', context: { circular } });

    expect(JSON.parse(error.serialize()).context.circular).toEqual({ name: 'loop', self: '[Circular]' });
  });

  it('prints an object that appears twice without being circular', () => {
    const shared = { id: 7 };
    const error = new CofheError({
      code: CofheErrorCode.InternalError,
      message: 'Boom',
      context: { a: shared, b: shared },
    });

    expect(JSON.parse(error.serialize()).context).toEqual({ a: { id: 7 }, b: { id: 7 } });
  });

  it('prints bigints', () => {
    const error = new CofheError({ code: CofheErrorCode.InternalError, message: 'Boom', context: { value: 5n } });

    expect(JSON.parse(error.serialize()).context.value).toBe('5n');
  });
});
