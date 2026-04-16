import { parseAbi } from 'viem';
import deploymentRegistry from './deployments.json';

type DeploymentEntry = { address: string; bytecodeHash: string; deployedAt: string };
type DeploymentRegistry = Record<string, Record<string, DeploymentEntry>>;

export const simpleTestAbi = parseAbi([
  'function setValue((uint256 ctHash, uint8 securityZone, uint8 utype, bytes signature) inValue) external',
  'function setPublicValue((uint256 ctHash, uint8 securityZone, uint8 utype, bytes signature) inValue) external',
  'function setValueTrivial(uint256 inValue) external',
  'function setPublicValueTrivial(uint256 inValue) external',
  'function addValue((uint256 ctHash, uint8 securityZone, uint8 utype, bytes signature) inValue) external',
  'function addValueTrivial(uint256 inValue) external',
  'function getValueHash() view returns (bytes32)',
  'function publicValueHash() view returns (bytes32)',
  'function getValue() view returns (bytes32)',
  'function publicValue() view returns (bytes32)',
  'function publishDecryptResult(bytes32 input, uint32 result, bytes signature) external',
  'function getDecryptResultSafe(bytes32 input) view returns (uint32 value, bool decrypted)',
]);

export function getSimpleTestAddress(chainId: number): `0x${string}` | undefined {
  const entry = (deploymentRegistry as DeploymentRegistry)['SimpleTest']?.[String(chainId)];
  return entry?.address as `0x${string}` | undefined;
}
