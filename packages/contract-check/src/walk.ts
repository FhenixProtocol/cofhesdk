/**
 * Minimal solc-AST plumbing: load a hardhat/foundry build-info file and walk it.
 *
 * We deliberately consume build-info rather than parsing Solidity ourselves —
 * the compiler already resolved imports, aliases and inheritance, so a type
 * named `euint64` here is unambiguously that type.
 */

export interface AstNode {
  id?: number;
  nodeType: string;
  src?: string;
  [key: string]: unknown;
}

export interface SourceUnit {
  /** Path as solc knows it, e.g. `contracts/Vault.sol`. */
  sourcePath: string;
  ast: AstNode;
  /** Offsets of each line start, for src -> line/column resolution. */
  lineOffsets?: number[];
}

export interface BuildInfo {
  solcVersion?: string;
  input?: { sources?: Record<string, { content?: string }> };
  output?: { sources?: Record<string, { ast?: AstNode }> };
}

export function sourceUnitsFromBuildInfo(buildInfo: BuildInfo): SourceUnit[] {
  const outSources = buildInfo.output?.sources ?? {};
  const inSources = buildInfo.input?.sources ?? {};
  const units: SourceUnit[] = [];

  for (const [sourcePath, entry] of Object.entries(outSources)) {
    if (!entry?.ast) continue;
    const content = inSources[sourcePath]?.content;
    units.push({
      sourcePath,
      ast: entry.ast,
      lineOffsets: content ? computeLineOffsets(content) : undefined,
    });
  }
  return units;
}

function computeLineOffsets(content: string): number[] {
  const offsets = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') offsets.push(i + 1);
  }
  return offsets;
}

/** solc `src` is "byteOffset:byteLength:sourceIndex". */
export function lineOf(node: AstNode, unit: SourceUnit): number {
  if (!node.src || !unit.lineOffsets) return 0;
  const offset = Number(node.src.split(':')[0]);
  if (!Number.isFinite(offset)) return 0;

  let lo = 0;
  let hi = unit.lineOffsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (unit.lineOffsets[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** Depth-first walk over every object node in the AST. */
export function walk(node: unknown, visit: (n: AstNode) => void): void {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (!node || typeof node !== 'object') return;

  const candidate = node as AstNode;
  if (typeof candidate.nodeType === 'string') visit(candidate);

  for (const value of Object.values(node as Record<string, unknown>)) {
    if (value && typeof value === 'object') walk(value, visit);
  }
}

/**
 * Collect every encrypted-type identifier reachable from a parameter's type,
 * following arrays and struct definitions (a struct field can smuggle a raw
 * handle past a naive check).
 */
export function collectTypeNames(
  typeNameNode: unknown,
  structsById: Map<number, AstNode>,
  seenStructs = new Set<number>(),
): string[] {
  const found: string[] = [];

  walk(typeNameNode, (n) => {
    const typeString = (n.typeDescriptions as { typeString?: string } | undefined)?.typeString;
    if (typeString) found.push(typeString);

    // Recurse into referenced struct definitions.
    if (n.nodeType === 'UserDefinedTypeName') {
      const ref = n.referencedDeclaration;
      if (typeof ref === 'number' && !seenStructs.has(ref)) {
        const struct = structsById.get(ref);
        if (struct) {
          seenStructs.add(ref);
          for (const member of (struct.members as AstNode[] | undefined) ?? []) {
            found.push(...collectTypeNames(member.typeName, structsById, seenStructs));
          }
        }
      }
    }
  });

  return found;
}

/** Index every StructDefinition so parameter checks can see through them. */
export function indexStructs(units: SourceUnit[]): Map<number, AstNode> {
  const byId = new Map<number, AstNode>();
  for (const unit of units) {
    walk(unit.ast, (n) => {
      if (n.nodeType === 'StructDefinition' && typeof n.id === 'number') {
        byId.set(n.id, n);
      }
    });
  }
  return byId;
}
