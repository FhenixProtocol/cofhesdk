import { describe, expect, it } from 'vitest';

import { checkBuildInfo } from '../src/index.js';
import { buildInfoWith, fixtures } from './fixtures/buildInfo.js';

const { fn, unwrapCall } = fixtures;

describe('no-raw-encrypted-params', () => {
  it('flags a raw euint64 on an external function', () => {
    const info = buildInfoWith('contracts/Vault.sol', [
      fn({ name: 'confidentialDeposit', visibility: 'external', params: ['euint64', 'address'] }),
    ]);

    const findings = checkBuildInfo(info).filter(
      (f) => f.rule === 'no-raw-encrypted-params',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('euint64');
    expect(findings[0]!.severity).toBe('error');
  });

  it('accepts sharedEuint64 and externalEuint64 parameters', () => {
    const info = buildInfoWith('contracts/Vault.sol', [
      fn({ name: 'fromContract', visibility: 'external', params: ['sharedEuint64'] }),
      fn({ name: 'fromUser', visibility: 'external', params: ['externalEuint64', 'bytes'] }),
    ]);

    expect(checkBuildInfo(info)).toHaveLength(0);
  });

  it('ignores internal functions — raw handles are the normal working type', () => {
    const info = buildInfoWith('contracts/Vault.sol', [
      fn({ name: '_doDeposit', visibility: 'internal', params: ['euint64'] }),
      fn({ name: '_helper', visibility: 'private', params: ['ebool', 'eaddress'] }),
    ]);

    expect(checkBuildInfo(info)).toHaveLength(0);
  });

  it('covers every encrypted width and the non-uint types', () => {
    const info = buildInfoWith('contracts/Wide.sol', [
      fn({ name: 'a', visibility: 'public', params: ['euint8'] }),
      fn({ name: 'b', visibility: 'public', params: ['euint16'] }),
      fn({ name: 'c', visibility: 'public', params: ['euint32'] }),
      fn({ name: 'd', visibility: 'public', params: ['euint128'] }),
      fn({ name: 'e', visibility: 'public', params: ['ebool'] }),
      fn({ name: 'f', visibility: 'public', params: ['eaddress'] }),
    ]);

    expect(
      checkBuildInfo(info).filter((f) => f.rule === 'no-raw-encrypted-params'),
    ).toHaveLength(6);
  });
});

describe('no-raw-encrypted-returns', () => {
  it('flags a raw encrypted return from a state-mutating function', () => {
    const info = buildInfoWith('contracts/Vault.sol', [
      fn({ name: 'deposit', visibility: 'external', returns: ['euint64'] }),
    ]);

    const findings = checkBuildInfo(info).filter(
      (f) => f.rule === 'no-raw-encrypted-returns',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('share');
  });

  it('exempts view and pure functions', () => {
    const info = buildInfoWith('contracts/Vault.sol', [
      fn({
        name: 'confidentialBalanceOf',
        visibility: 'public',
        stateMutability: 'view',
        returns: ['euint64'],
      }),
      fn({
        name: 'pureThing',
        visibility: 'external',
        stateMutability: 'pure',
        returns: ['ebool'],
      }),
    ]);

    expect(checkBuildInfo(info)).toHaveLength(0);
  });

  it('accepts a shared return', () => {
    const info = buildInfoWith('contracts/Vault.sol', [
      fn({ name: 'deposit', visibility: 'external', returns: ['sharedEuint64'] }),
    ]);

    expect(checkBuildInfo(info)).toHaveLength(0);
  });
});

describe('no-raw-shared-wrap', () => {
  it('flags sharedEuint64.unwrap outside the library', () => {
    const info = buildInfoWith('contracts/Sneaky.sol', [
      fn({ name: 'launder', visibility: 'external' }),
      unwrapCall('sharedEuint64', 'unwrap'),
    ]);

    const findings = checkBuildInfo(info).filter((f) => f.rule === 'no-raw-shared-wrap');

    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('turnstile');
  });

  it('allows wrap/unwrap inside the FHE library itself', () => {
    const info = buildInfoWith(
      'node_modules/@fhenixprotocol/cofhe-contracts/FHE.sol',
      [unwrapCall('sharedEuint64', 'unwrap'), unwrapCall('sharedEuint64', 'wrap')],
    );

    expect(checkBuildInfo(info)).toHaveLength(0);
  });
});

describe('struct smuggling', () => {
  it('sees a raw handle nested inside a struct parameter', () => {
    const structId = 90001;
    const info = buildInfoWith('contracts/Struct.sol', [
      {
        id: structId,
        nodeType: 'StructDefinition',
        name: 'Args',
        src: '0:0:0',
        members: [
          {
            id: 90002,
            nodeType: 'VariableDeclaration',
            name: 'amount',
            src: '0:0:0',
            typeName: {
              id: 90003,
              nodeType: 'UserDefinedTypeName',
              src: '0:0:0',
              typeDescriptions: { typeString: 'euint64' },
            },
          },
        ],
      },
      {
        id: 90010,
        nodeType: 'FunctionDefinition',
        name: 'takesStruct',
        src: '0:0:0',
        visibility: 'external',
        stateMutability: 'nonpayable',
        parameters: {
          id: 90011,
          nodeType: 'ParameterList',
          parameters: [
            {
              id: 90012,
              nodeType: 'VariableDeclaration',
              name: 'args',
              src: '0:0:0',
              typeName: {
                id: 90013,
                nodeType: 'UserDefinedTypeName',
                src: '0:0:0',
                referencedDeclaration: structId,
                typeDescriptions: { typeString: 'struct Args' },
              },
            },
          ],
        },
        returnParameters: { id: 90014, nodeType: 'ParameterList', parameters: [] },
      },
    ]);

    const findings = checkBuildInfo(info).filter(
      (f) => f.rule === 'no-raw-encrypted-params',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('euint64');
  });
});
