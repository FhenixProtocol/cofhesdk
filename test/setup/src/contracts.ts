/**
 * What the last `pnpm test:setup` in this checkout found, deployed or stored: SimpleTest's address
 * per chain and the handles of the values it stored for the decrypt tests. setup.mjs writes
 * deployments.local.json (not committed) and tsup inlines it here at build time, so a checkout
 * where setup has not run has nothing and the live suites report that.
 */
declare const __SIMPLE_TEST_DEPLOYMENTS__: string;

type DeploymentEntry = { address: string; bytecodeHash: string; deployedAt: string };

export type StoredValue = {
  /** The plaintext that was trivially encrypted and stored */
  value: number;
  /** bytes32 ciphertext handle (euint32) */
  ctHash: string;
};

export type SimpleTestValues = {
  contractAddress: string;
  /** The account that stored them; storedValue is readable only by this account */
  account: string;
  /** Stored via setValueTrivial — allowThis + allowSender */
  privateValue: StoredValue;
  /** Stored via setPublicValueTrivial — allowPublic */
  publicValue: StoredValue;
  storedAt: string;
};

type LocalRecord = {
  SimpleTest?: Record<string, DeploymentEntry>;
  SimpleTestValues?: Record<string, SimpleTestValues>;
};

const local: LocalRecord = JSON.parse(__SIMPLE_TEST_DEPLOYMENTS__ || '{}');

// Staging shares its chain ID (420105) with `localcofhe`, so it is keyed separately.
const STAGING_KEY = '420105-staging';

export function getSimpleTestAddress(chainId: number): `0x${string}` | undefined {
  return local.SimpleTest?.[String(chainId)]?.address as `0x${string}` | undefined;
}

export function getStagingSimpleTestAddress(): `0x${string}` | undefined {
  return local.SimpleTest?.[STAGING_KEY]?.address as `0x${string}` | undefined;
}

export function getSimpleTestValues(chainId: number): SimpleTestValues | undefined {
  return local.SimpleTestValues?.[String(chainId)];
}

export function getStagingSimpleTestValues(): SimpleTestValues | undefined {
  return local.SimpleTestValues?.[STAGING_KEY];
}
