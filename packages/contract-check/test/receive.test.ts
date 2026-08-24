import { describe, expect, it } from 'vitest';

import { checkBuildInfo } from '../src/index.js';
import { buildInfoWith } from './fixtures/buildInfo.js';

let nextId = 50000;

/** `FHE.receiveEuint64Param(arg)` / `FHE.receiveEuint64FromCall(arg, callee)`. */
function receiveCall(memberName: string, arg: unknown) {
  return {
    id: nextId++,
    nodeType: 'FunctionCall',
    src: '0:0:0',
    expression: {
      id: nextId++,
      nodeType: 'MemberAccess',
      src: '0:0:0',
      memberName,
      expression: { id: nextId++, nodeType: 'Identifier', name: 'FHE', src: '0:0:0' },
    },
    arguments: [arg],
  };
}

/** `token.someCall(...)` — an external call whose return value we consume. */
function externalCall() {
  return {
    id: nextId++,
    nodeType: 'FunctionCall',
    src: '0:0:0',
    expression: {
      id: nextId++,
      nodeType: 'MemberAccess',
      src: '0:0:0',
      memberName: 'pull',
      expression: { id: nextId++, nodeType: 'Identifier', name: 'token', src: '0:0:0' },
    },
    arguments: [],
  };
}

function identifier(name: string, referencedDeclaration: number) {
  return {
    id: nextId++,
    nodeType: 'Identifier',
    name,
    referencedDeclaration,
    src: '0:0:0',
  };
}

/** A function taking one `sharedEuint64` parameter, with the given statements. */
function fnWithSharedParam(name: string, statements: unknown[], paramId = nextId++) {
  return {
    id: nextId++,
    nodeType: 'FunctionDefinition',
    name,
    src: '0:0:0',
    visibility: 'external',
    stateMutability: 'nonpayable',
    parameters: {
      id: nextId++,
      nodeType: 'ParameterList',
      parameters: [
        {
          id: paramId,
          nodeType: 'VariableDeclaration',
          name: 'shared',
          src: '0:0:0',
          typeName: {
            id: nextId++,
            nodeType: 'UserDefinedTypeName',
            src: '0:0:0',
            typeDescriptions: { typeString: 'sharedEuint64' },
          },
        },
      ],
    },
    returnParameters: { id: nextId++, nodeType: 'ParameterList', parameters: [] },
    body: { id: nextId++, nodeType: 'Block', src: '0:0:0', statements },
    __paramId: paramId,
  };
}

/** `sharedEuint64 local = <init>;` */
function localFrom(init: unknown, declId = nextId++) {
  return {
    id: nextId++,
    nodeType: 'VariableDeclarationStatement',
    src: '0:0:0',
    declarations: [
      {
        id: declId,
        nodeType: 'VariableDeclaration',
        name: 'local',
        src: '0:0:0',
      },
    ],
    initialValue: init,
    __declId: declId,
  };
}

describe('receive-variant', () => {
  it('flags Param used on a value that came straight from a call', () => {
    const fn = fnWithSharedParam('consume', [receiveCall('receiveEuint64Param', externalCall())]);
    const info = buildInfoWith('contracts/Consumer.sol', [fn]);

    const findings = checkBuildInfo(info).filter((f) => f.rule === 'receive-variant');

    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('warning');
    expect(findings[0]!.message).toContain('FromCall');
  });

  it('flags FromCall used on a value that arrived as a parameter', () => {
    const paramId = nextId++;
    const fn = fnWithSharedParam(
      'consume',
      [receiveCall('receiveEuint64FromCall', identifier('shared', paramId))],
      paramId
    );
    const info = buildInfoWith('contracts/Consumer.sol', [fn]);

    const findings = checkBuildInfo(info).filter((f) => f.rule === 'receive-variant');

    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('Param variant');
  });

  it('accepts each variant on its matching origin', () => {
    const paramId = nextId++;
    const ok = buildInfoWith('contracts/Ok.sol', [
      fnWithSharedParam('fromParam', [receiveCall('receiveEuint64Param', identifier('shared', paramId))], paramId),
      fnWithSharedParam('fromCall', [receiveCall('receiveEuint64FromCall', externalCall())]),
    ]);

    expect(checkBuildInfo(ok).filter((f) => f.rule === 'receive-variant')).toHaveLength(0);
  });

  it('follows a local assigned exactly once', () => {
    const declId = nextId++;
    const decl = localFrom(externalCall(), declId);
    const fn = fnWithSharedParam('consume', [decl, receiveCall('receiveEuint64Param', identifier('local', declId))]);
    const info = buildInfoWith('contracts/Local.sol', [fn]);

    const findings = checkBuildInfo(info).filter((f) => f.rule === 'receive-variant');

    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('FromCall');
  });

  it('stays silent when a local is reassigned — origin is no longer provable', () => {
    const declId = nextId++;
    const decl = localFrom(externalCall(), declId);
    const reassign = {
      id: nextId++,
      nodeType: 'ExpressionStatement',
      src: '0:0:0',
      expression: {
        id: nextId++,
        nodeType: 'Assignment',
        src: '0:0:0',
        leftHandSide: identifier('local', declId),
        rightHandSide: { id: nextId++, nodeType: 'Identifier', name: 'other', src: '0:0:0' },
      },
    };
    const fn = fnWithSharedParam('consume', [
      decl,
      reassign,
      receiveCall('receiveEuint64Param', identifier('local', declId)),
    ]);

    const findings = checkBuildInfo(buildInfoWith('contracts/Reassigned.sol', [fn])).filter(
      (f) => f.rule === 'receive-variant'
    );

    expect(findings).toHaveLength(0);
  });

  it('stays silent on origins it cannot resolve', () => {
    const fn = fnWithSharedParam('consume', [
      receiveCall('receiveEuint64Param', {
        id: nextId++,
        nodeType: 'MemberAccess',
        src: '0:0:0',
        memberName: 'stored',
        expression: { id: nextId++, nodeType: 'Identifier', name: 'state', src: '0:0:0' },
      }),
    ]);

    const findings = checkBuildInfo(buildInfoWith('contracts/Unknown.sol', [fn])).filter(
      (f) => f.rule === 'receive-variant'
    );

    expect(findings).toHaveLength(0);
  });

  it('covers every encrypted width', () => {
    const fns = ['Ebool', 'Euint8', 'Euint128', 'Eaddress'].map((cap, i) =>
      fnWithSharedParam(`consume${i}`, [receiveCall(`receive${cap}Param`, externalCall())])
    );

    const findings = checkBuildInfo(buildInfoWith('contracts/Wide.sol', fns)).filter(
      (f) => f.rule === 'receive-variant'
    );

    expect(findings).toHaveLength(4);
  });
});
