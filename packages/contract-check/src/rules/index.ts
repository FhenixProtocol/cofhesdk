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
  isExternalEncryptedType,
  isSharedEncryptedType,
  typeIdentifier,
} from '../types.js';

export type Severity = 'error' | 'warning';

/**
 * How a function arranges the proofs covering its `externalE*` inputs.
 *
 * `FHE.asEuintXX(hash, proof)` pairs one proof with one value, while the batch
 * verifier takes several inputs under a single signature — both are supported
 * by the library, so neither arrangement is inherently correct. `any` (the
 * default) accepts both; the narrower settings exist for projects that want
 * house consistency, typically to match a generated client encoder.
 */
export type ProofStyle = 'any' | 'per-value' | 'trailing';

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
  proofStyle: ProofStyle;
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

function paramTypeName(param: AstNode): string | undefined {
  const fromTypeName = (
    (param.typeName as AstNode | undefined)?.typeDescriptions as
      | { typeString?: string }
      | undefined
  )?.typeString;
  const fromParam = (param.typeDescriptions as { typeString?: string } | undefined)
    ?.typeString;
  return typeIdentifier(fromTypeName ?? fromParam);
}

/** `bytes` / `bytes[]` parameters — the shape a verification proof arrives in. */
function isProofParam(param: AstNode): boolean {
  return paramTypeName(param) === 'bytes';
}

function isExternalEncryptedParam(param: AstNode): boolean {
  const name = paramTypeName(param);
  return !!name && isExternalEncryptedType(name);
}

function externallyVisibleFunctions(
  unit: SourceUnit,
): Array<{ node: AstNode; params: AstNode[] }> {
  const out: Array<{ node: AstNode; params: AstNode[] }> = [];
  walk(unit.ast, (n) => {
    if (n.nodeType !== 'FunctionDefinition') return;
    if (!EXTERNALLY_VISIBLE.has(String(n.visibility))) return;
    const params =
      ((n.parameters as AstNode | undefined)?.parameters as AstNode[] | undefined) ?? [];
    out.push({ node: n, params });
  });
  return out;
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
 * R4a — an external input needs a proof to be verifiable at all.
 *
 * `externalEuintXX` is inert; the only way to a usable handle is
 * `FHE.asEuintXX(hash, proof)` or the batch verifier, both of which need proof
 * bytes. A signature that accepts external inputs but no `bytes` cannot supply
 * them, so the value can never be converted — wrong under every arrangement,
 * which is why this needs no convention.
 */
const externalInputMissingProof: Rule = {
  id: 'external-input-missing-proof',
  description:
    'functions taking externalE* inputs must also accept the proof bytes that verify them',
  run({ units, libraryPaths }) {
    const findings: Finding[] = [];
    for (const unit of units) {
      if (isLibrarySource(unit.sourcePath, libraryPaths)) continue;

      for (const { node, params } of externallyVisibleFunctions(unit)) {
        const external = params.filter(isExternalEncryptedParam);
        if (external.length === 0) continue;
        if (params.some(isProofParam)) continue;

        findings.push({
          rule: externalInputMissingProof.id,
          severity: 'error',
          file: unit.sourcePath,
          line: lineOf(external[0]!, unit),
          message:
            `${node.name || '<fallback>'} takes ${external.length} external encrypted input(s) ` +
            `but no proof bytes, so they can never be verified. ` +
            `Add a bytes parameter and convert with FHE.as*(hash, proof).`,
        });
      }
    }
    return findings;
  },
};

/**
 * R4b — optional house style for how proofs are arranged.
 *
 * Off by default (`proofStyle: 'any'`): the library supports both a proof per
 * value and one trailing proof over a batch, so neither is a defect. Projects
 * that pin a style — usually to match a generated client encoder — get
 * warnings for signatures that deviate.
 */
const proofPlacement: Rule = {
  id: 'proof-placement',
  description:
    'externalE* inputs follow the configured proof arrangement (opt-in via proofStyle)',
  run({ units, libraryPaths, proofStyle }) {
    if (proofStyle === 'any') return [];

    const findings: Finding[] = [];
    for (const unit of units) {
      if (isLibrarySource(unit.sourcePath, libraryPaths)) continue;

      for (const { node, params } of externallyVisibleFunctions(unit)) {
        const externalCount = params.filter(isExternalEncryptedParam).length;
        if (externalCount === 0) continue;

        const proofCount = params.filter(isProofParam).length;
        if (proofCount === 0) continue; // reported by external-input-missing-proof

        const name = node.name || '<fallback>';
        if (proofStyle === 'trailing') {
          const last = params[params.length - 1];
          if (proofCount !== 1 || !last || !isProofParam(last)) {
            findings.push({
              rule: proofPlacement.id,
              severity: 'warning',
              file: unit.sourcePath,
              line: lineOf(node, unit),
              message:
                `${name} does not match proofStyle "trailing": expected exactly one proof ` +
                `as the final parameter, found ${proofCount} proof parameter(s).`,
            });
          }
          continue;
        }

        // 'per-value': every external input is immediately followed by its proof.
        let paired = true;
        for (let i = 0; i < params.length; i++) {
          if (!isExternalEncryptedParam(params[i]!)) continue;
          const next = params[i + 1];
          if (!next || !isProofParam(next)) {
            paired = false;
            break;
          }
        }
        if (!paired || proofCount !== externalCount) {
          findings.push({
            rule: proofPlacement.id,
            severity: 'warning',
            file: unit.sourcePath,
            line: lineOf(node, unit),
            message:
              `${name} does not match proofStyle "per-value": expected each of the ` +
              `${externalCount} external input(s) to be followed by its own proof, ` +
              `found ${proofCount} proof parameter(s).`,
          });
        }
      }
    }
    return findings;
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
  externalInputMissingProof,
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
