import {
  collectTypeNames,
  indexStructs,
  lineOf,
  walk,
  type AstNode,
  type SourceUnit,
} from '../walk.js';
import {
  isBaseEncryptedType,
  isSharedEncryptedType,
  typeIdentifier,
} from '../types.js';

export type Severity = 'error' | 'warning';

export interface Finding {
  rule: string;
  severity: Severity;
  file: string;
  line: number;
  message: string;
}

export interface RuleContext {
  units: SourceUnit[];
  structsById: Map<number, AstNode>;
  /** Sources whose paths match these fragments are exempt (the library itself). */
  libraryPaths: string[];
}

export interface Rule {
  id: string;
  description: string;
  run(ctx: RuleContext): Finding[];
}

const EXTERNALLY_VISIBLE = new Set(['external', 'public']);

function isLibrarySource(path: string, libraryPaths: string[]): boolean {
  return libraryPaths.some((frag) => path.includes(frag));
}

function encryptedTypesIn(
  typeNameNode: unknown,
  structsById: Map<number, AstNode>,
): string[] {
  return collectTypeNames(typeNameNode, structsById)
    .map((t) => typeIdentifier(t))
    .filter((t): t is string => !!t && isBaseEncryptedType(t));
}

/**
 * R1 — the share/receive turnstile is the only conversion.
 *
 * `sharedEuintXX.wrap` / `.unwrap` outside FHE.sol bypasses the provenance
 * check inside `receive*`, which is the whole point of the type.
 */
const noRawWrapUnwrap: Rule = {
  id: 'no-raw-shared-wrap',
  description: 'sharedE* wrap/unwrap may only be used inside the FHE library',
  run({ units, libraryPaths }) {
    const findings: Finding[] = [];
    for (const unit of units) {
      if (isLibrarySource(unit.sourcePath, libraryPaths)) continue;

      walk(unit.ast, (n) => {
        if (n.nodeType !== 'MemberAccess') return;
        const member = n.memberName;
        if (member !== 'wrap' && member !== 'unwrap') return;

        const expr = n.expression as AstNode | undefined;
        const name = typeIdentifier(
          (expr?.typeDescriptions as { typeString?: string } | undefined)?.typeString ??
            (typeof expr?.name === 'string' ? (expr.name as string) : undefined),
        );
        if (!name || !isSharedEncryptedType(name)) return;

        findings.push({
          rule: noRawWrapUnwrap.id,
          severity: 'error',
          file: unit.sourcePath,
          line: lineOf(n, unit),
          message:
            `${name}.${member}() bypasses the share/receive turnstile. ` +
            `Use FHE.share*/FHE.receive*Param/FHE.receive*FromCall instead.`,
        });
      });
    }
    return findings;
  },
};

/**
 * R2 — no raw encrypted handle may enter through an external boundary.
 *
 * This is the audit finding generalized: a handle arriving as a plain
 * `euint64` parameter has no provenance, and the callee computes on it with
 * its own ACL authority.
 */
const noRawEncryptedParams: Rule = {
  id: 'no-raw-encrypted-params',
  description: 'external/public functions must not accept raw encrypted types',
  run({ units, structsById, libraryPaths }) {
    const findings: Finding[] = [];
    for (const unit of units) {
      if (isLibrarySource(unit.sourcePath, libraryPaths)) continue;

      walk(unit.ast, (n) => {
        if (n.nodeType !== 'FunctionDefinition') return;
        if (!EXTERNALLY_VISIBLE.has(String(n.visibility))) return;

        const params = (n.parameters as AstNode | undefined)?.parameters as
          | AstNode[]
          | undefined;
        for (const param of params ?? []) {
          for (const bad of encryptedTypesIn(param.typeName, structsById)) {
            findings.push({
              rule: noRawEncryptedParams.id,
              severity: 'error',
              file: unit.sourcePath,
              line: lineOf(param, unit),
              message:
                `${n.name || '<fallback>'} is ${n.visibility} and takes a raw ${bad}` +
                `${param.name ? ` (parameter "${param.name}")` : ''}. ` +
                `Accept shared${cap(bad)} from contracts, or external${cap(bad)} + proof from users.`,
            });
          }
        }
      });
    }
    return findings;
  },
};

/**
 * R3 — no raw encrypted handle may leave through a state-mutating boundary.
 *
 * Return data of a state-mutating call is only observable to a calling
 * contract, so such a return is contract-consumed by construction and must be
 * shared. `view` returns are exempt: they serve off-chain readers, and a
 * contract reading one still needs its own ACL grant.
 */
const noRawEncryptedReturns: Rule = {
  id: 'no-raw-encrypted-returns',
  description:
    'external/public state-mutating functions must not return raw encrypted types',
  run({ units, structsById, libraryPaths }) {
    const findings: Finding[] = [];
    for (const unit of units) {
      if (isLibrarySource(unit.sourcePath, libraryPaths)) continue;

      walk(unit.ast, (n) => {
        if (n.nodeType !== 'FunctionDefinition') return;
        if (!EXTERNALLY_VISIBLE.has(String(n.visibility))) return;

        const mutability = String(n.stateMutability);
        if (mutability === 'view' || mutability === 'pure') return;

        const returns = (n.returnParameters as AstNode | undefined)?.parameters as
          | AstNode[]
          | undefined;
        for (const ret of returns ?? []) {
          for (const bad of encryptedTypesIn(ret.typeName, structsById)) {
            findings.push({
              rule: noRawEncryptedReturns.id,
              severity: 'error',
              file: unit.sourcePath,
              line: lineOf(ret, unit),
              message:
                `${n.name || '<fallback>'} is ${n.visibility} and non-view, and returns a raw ${bad}. ` +
                `Return FHE.share${cap(bad)}(value, receiver) so the caller must receive it.`,
            });
          }
        }
      });
    }
    return findings;
  },
};

function cap(t: string): string {
  return `${t[0]!.toUpperCase()}${t.slice(1)}`;
}

/**
 * R4 (stub) — proof placement convention for externalE* inputs.
 *
 * Pending a team decision between "proof follows each hash" and "one proof at
 * the end of calldata"; batch verification favours the latter. The rule is
 * registered but inert so the convention can be encoded without reshaping the
 * runner.
 */
const proofPlacement: Rule = {
  id: 'proof-placement',
  description: 'externalE* parameters must carry their proof in the agreed position (unimplemented)',
  run() {
    return [];
  },
};

/**
 * R5 (stub) — receive-variant correctness.
 *
 * `receive*Param` checks provenance against msg.sender; `receive*FromCall`
 * checks it against a named callee. Using the wrong one fails closed at
 * runtime with an opaque revert, so catching it statically is a usability win.
 * Requires light data-flow (where did this shared value come from), hence a
 * warning-grade heuristic rather than a v1 blocker.
 */
const receiveVariant: Rule = {
  id: 'receive-variant',
  description:
    'shared values from call returns should use receive*FromCall; parameters should use receive*Param (unimplemented)',
  run() {
    return [];
  },
};

export const RULES: Rule[] = [
  noRawWrapUnwrap,
  noRawEncryptedParams,
  noRawEncryptedReturns,
  proofPlacement,
  receiveVariant,
];

export function runRules(ctx: Omit<RuleContext, 'structsById'>): Finding[] {
  const structsById = indexStructs(ctx.units);
  const full: RuleContext = { ...ctx, structsById };
  return RULES.flatMap((rule) => rule.run(full)).sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line,
  );
}
