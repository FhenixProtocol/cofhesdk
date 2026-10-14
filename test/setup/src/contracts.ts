import { parseAbi } from 'viem';
import deploymentRegistry from './deployments.json';

type DeploymentEntry = { address: string; bytecodeHash: string; deployedAt: string };
type DeploymentRegistry = Record<string, Record<string, DeploymentEntry>>;

export function getSimpleTestAddress(chainId: number): `0x${string}` | undefined {
  const entry = (deploymentRegistry as DeploymentRegistry)['SimpleTest']?.[String(chainId)];
  return entry?.address as `0x${string}` | undefined;
}

// Staging shares its chain ID (420105) with `localcofhe`, so its deployment is keyed separately.
export function getStagingSimpleTestAddress(): `0x${string}` | undefined {
  const entry = (deploymentRegistry as DeploymentRegistry)['SimpleTest']?.['420105-staging'];
  return entry?.address as `0x${string}` | undefined;
}
