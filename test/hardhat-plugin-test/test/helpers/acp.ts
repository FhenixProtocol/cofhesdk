import hre from 'hardhat';
import type { Contract } from 'ethers';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

/** Shared ACP (Permit V3) EIP-712 helpers for tests. */

export const ZERO_ADDRESS = '0x' + '0'.repeat(40);
export const ZERO_BYTES32 = '0x' + '0'.repeat(64);
export const DEFAULT_SEALING_KEY = '0x' + '5ea1'.padStart(64, '0');

export const ACP_DOMAIN_NAME = 'ACL';
export const ACP_DOMAIN_VERSION = '2';

export const TYPES_ISSUER_SELF = {
  ACPIssuerSelf: [
    { name: 'issuer', type: 'address' },
    { name: 'expiration', type: 'uint64' },
    { name: 'recipient', type: 'address' },
    { name: 'validatorId', type: 'uint256' },
    { name: 'validatorContract', type: 'address' },
    { name: 'global', type: 'bool' },
    { name: 'contracts', type: 'address[]' },
    { name: 'handles', type: 'uint256[]' },
    { name: 'sealingKey', type: 'bytes32' },
  ],
};

export const TYPES_ISSUER_SHARED = {
  ACPIssuerShared: [
    { name: 'issuer', type: 'address' },
    { name: 'expiration', type: 'uint64' },
    { name: 'recipient', type: 'address' },
    { name: 'validatorId', type: 'uint256' },
    { name: 'validatorContract', type: 'address' },
    { name: 'global', type: 'bool' },
    { name: 'contracts', type: 'address[]' },
    { name: 'handles', type: 'uint256[]' },
  ],
};

export const TYPES_RECIPIENT = {
  ACPRecipient: [
    { name: 'sealingKey', type: 'bytes32' },
    { name: 'issuerSignature', type: 'bytes' },
  ],
};

export type ACPermission = {
  issuer: string;
  expiration: bigint;
  recipient: string;
  validatorId: bigint;
  validatorContract: string;
  global: boolean;
  contracts: string[];
  handles: bigint[];
  sealingKey: string;
  issuerSignature: string;
  recipientSignature: string;
};

export const acpDomain = async (acpVerifier: Contract) => ({
  name: ACP_DOMAIN_NAME,
  version: ACP_DOMAIN_VERSION,
  chainId: (await hre.ethers.provider.getNetwork()).chainId,
  verifyingContract: await acpVerifier.getAddress(),
});

export const latestTimestamp = async (): Promise<bigint> =>
  BigInt((await hre.ethers.provider.getBlock('latest'))!.timestamp);

/** Build and issuer-sign a self permission (global scope + no validator unless overridden). */
export const signedSelfPermission = async (
  acpVerifier: Contract,
  issuer: HardhatEthersSigner,
  overrides: Partial<ACPermission> = {}
): Promise<ACPermission> => {
  const p: ACPermission = {
    issuer: issuer.address,
    expiration: (await latestTimestamp()) + 7n * 24n * 3600n,
    recipient: ZERO_ADDRESS,
    validatorId: 0n,
    validatorContract: ZERO_ADDRESS,
    global: true,
    contracts: [],
    handles: [],
    sealingKey: DEFAULT_SEALING_KEY,
    issuerSignature: '0x',
    recipientSignature: '0x',
    ...overrides,
  };
  p.issuerSignature = await issuer.signTypedData(await acpDomain(acpVerifier), TYPES_ISSUER_SELF, p);
  return p;
};

/** Advance chain time by `seconds` and mine a block. */
export const advanceTime = async (seconds: number) => {
  await hre.network.provider.send('evm_increaseTime', [seconds]);
  await hre.network.provider.send('evm_mine');
};
