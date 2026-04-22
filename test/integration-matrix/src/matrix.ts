const CHAIN_SLUGS: Record<string, string> = {
  hardhat: 'Hardhat (Mock)',
  '31337': 'Hardhat (Mock)',
  localcofhe: 'Local CoFHE',
  '420105': 'Local CoFHE',
  sepolia: 'Ethereum Sepolia',
  '11155111': 'Ethereum Sepolia',
  'arb-sepolia': 'Arbitrum Sepolia',
  'arbitrum-sepolia': 'Arbitrum Sepolia',
  '421614': 'Arbitrum Sepolia',
  'base-sepolia': 'Base Sepolia',
  '84532': 'Base Sepolia',
};

const CHAIN_GROUPS: Record<string, string[]> = {
  testnet: ['sepolia', 'arb-sepolia', 'base-sepolia'],
};

export const ALL_CHAIN_LABELS = [
  'Hardhat (Mock)',
  'Local CoFHE',
  'Ethereum Sepolia',
  'Arbitrum Sepolia',
  'Base Sepolia',
];

export function resolveChainFilter(matrixChain?: string): string[] | null {
  const raw = (matrixChain || undefined)?.toLowerCase();
  if (!raw) return null;
  const slugs = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s) => CHAIN_GROUPS[s] ?? [s]);

  const invalid = slugs.filter((s) => !CHAIN_SLUGS[s]);
  if (invalid.length) {
    throw new Error(
      `Unknown MATRIX_CHAIN value(s): ${invalid.join(', ')}. Valid values: ${Object.keys(CHAIN_SLUGS).join(', ')}, ${Object.keys(CHAIN_GROUPS).join(', ')}`
    );
  }

  return slugs.map((s) => CHAIN_SLUGS[s]);
}

function getMatrixEnvironmentEnabled(environment: string, matrixEnv: string): boolean {
  if (matrixEnv === 'all' || matrixEnv === '') return true;
  return environment.toLowerCase() === matrixEnv.toLowerCase();
}

export function getMatrixChains<T extends { enabled: boolean; label: string }>(
  matrixEnv: string,
  matrixChain: string,
  allChains: T[]
): { chain: T; chainEnabled: boolean; webEnabled: boolean; nodeEnabled: boolean }[] {
  const enabledLabels = resolveChainFilter(matrixChain);
  const webEnabled = getMatrixEnvironmentEnabled('web', matrixEnv);
  const nodeEnabled = getMatrixEnvironmentEnabled('node', matrixEnv);

  return allChains.map((c) => {
    if (!c.enabled) return { chain: c, chainEnabled: false, webEnabled: false, nodeEnabled: false };
    if (!enabledLabels) return { chain: c, chainEnabled: true, webEnabled, nodeEnabled };

    const chainEnabled = enabledLabels.includes(c.label);
    return { chain: c, chainEnabled, webEnabled: chainEnabled && webEnabled, nodeEnabled: chainEnabled && nodeEnabled };
  });
}
