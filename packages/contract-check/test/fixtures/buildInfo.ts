/**
 * Hand-built solc AST fragments.
 *
 * Real build-info files are megabytes of resolved compiler output; these carry
 * only the fields the rules read, so a fixture stays reviewable. The shapes
 * follow solc's standard-JSON output for Solidity 0.8.x.
 */
import type { BuildInfo } from '../../src/walk.js';

interface FnSpec {
  name: string;
  visibility: 'external' | 'public' | 'internal' | 'private';
  stateMutability?: 'nonpayable' | 'view' | 'pure' | 'payable';
  params?: string[];
  returns?: string[];
}

let nextId = 1000;

function typeName(typeString: string) {
  return {
    id: nextId++,
    nodeType: 'UserDefinedTypeName',
    src: '0:0:0',
    typeDescriptions: { typeString },
  };
}

function variable(typeString: string, name: string) {
  return {
    id: nextId++,
    nodeType: 'VariableDeclaration',
    name,
    src: '0:0:0',
    typeName: typeName(typeString),
    typeDescriptions: { typeString },
  };
}

function fn(spec: FnSpec) {
  return {
    id: nextId++,
    nodeType: 'FunctionDefinition',
    name: spec.name,
    src: '0:0:0',
    visibility: spec.visibility,
    stateMutability: spec.stateMutability ?? 'nonpayable',
    parameters: {
      id: nextId++,
      nodeType: 'ParameterList',
      parameters: (spec.params ?? []).map((t, i) => variable(t, `arg${i}`)),
    },
    returnParameters: {
      id: nextId++,
      nodeType: 'ParameterList',
      parameters: (spec.returns ?? []).map((t, i) => variable(t, `ret${i}`)),
    },
  };
}

/** A `sharedEuint64.unwrap(x)` style call. */
function unwrapCall(typeString: string, member: 'wrap' | 'unwrap') {
  return {
    id: nextId++,
    nodeType: 'FunctionCall',
    src: '0:0:0',
    expression: {
      id: nextId++,
      nodeType: 'MemberAccess',
      src: '0:0:0',
      memberName: member,
      expression: {
        id: nextId++,
        nodeType: 'Identifier',
        name: typeString,
        src: '0:0:0',
        typeDescriptions: { typeString: `type(${typeString})` },
      },
    },
  };
}

export function buildInfoWith(sourcePath: string, nodes: unknown[], content = '\n'.repeat(50)): BuildInfo {
  return {
    solcVersion: '0.8.27',
    input: { sources: { [sourcePath]: { content } } },
    output: {
      sources: {
        [sourcePath]: {
          ast: {
            id: nextId++,
            nodeType: 'SourceUnit',
            src: '0:0:0',
            absolutePath: sourcePath,
            nodes: [
              {
                id: nextId++,
                nodeType: 'ContractDefinition',
                name: 'Fixture',
                src: '0:0:0',
                nodes,
              },
            ],
          },
        },
      },
    },
  };
}

export const fixtures = { fn, variable, typeName, unwrapCall };
