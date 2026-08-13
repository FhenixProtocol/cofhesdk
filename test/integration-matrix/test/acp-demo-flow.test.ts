import { describe, it, expect, beforeAll } from 'vitest';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { Encryptable, FheTypes } from '@cofhe/sdk';
import { simpleTestAbi } from '@cofhe/test-setup';
import { createWalletClient, http, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ALL_CHAINS } from '../src/chains/index.js';
import { getMatrixChains } from '../src/matrix.js';
import type { ClientFactory, TestContext } from '../src/types.js';

// Dedicated demo issuer (anvil key #2): validator revocation state is keyed
// per-issuer, so using our own account isolates this file's revocations from
// the other suites sharing the same anvil instance (and their Bob permits).
const DEMO_PRIVATE_KEY = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' as const;

/**
 * ACP (Permit V3) — minimal user-flow demo, end to end:
 *
 *   1. encrypt + store a value
 *   2. create a CONTRACT-SCOPED, REVOCABLE permit
 *      (validator injected by config.permit.defaultRevoker — no explicit opts)
 *   3. decrypt with it
 *   4. revoke it on-chain (revokeSingle via the timestamp validator)
 *   5. decrypting with the revoked permit fails (PermissionInvalid_Disabled)
 *   6. a freshly created permit works again
 *
 * Chain-agnostic by construction: runs against anvil+mocks today; remote
 * devnet inherits it once the upgraded ACL/ACP contracts are deployed there.
 */

const factory: ClientFactory = {
  createConfig: createCofheConfig,
  createClient: createCofheClient,
};

const matrix = getMatrixChains(process.env.MATRIX_ENV ?? '', process.env.MATRIX_CHAIN ?? '', ALL_CHAINS);
const enabledChains = matrix.filter(({ chainEnabled }) => chainEnabled).map(({ chain }) => chain);

describe.each(enabledChains)('[ACP DEMO] $label', (chainConfig) => {
  let ctx: TestContext;
  let demoWallet: WalletClient;
  let demoAccount: ReturnType<typeof privateKeyToAccount>;
  const testValue = 42n;

  beforeAll(async () => {
    ctx = await chainConfig.setup(factory);
    demoAccount = privateKeyToAccount(DEMO_PRIVATE_KEY);
    demoWallet = createWalletClient({
      chain: chainConfig.viemChain,
      transport: http(chainConfig.rpc),
      account: demoAccount,
    });
    // reconnect the client as the demo issuer
    await ctx.cofheClient.connect(ctx.publicClient, demoWallet);
  }, 120_000);

  it('full flow: scoped revocable permit → decrypt → revoke → denied → fresh permit works', async () => {
    // 1. encrypt + store
    const [encryptedHash, encryptedSignature] = await ctx.cofheClient
      .encryptInputs([Encryptable.uint32(testValue)])
      .setConsumingContract(ctx.contractAddress)
      .execute();
    const txHash = await demoWallet.writeContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'setValue',
      args: [encryptedHash, encryptedSignature],
      chain: chainConfig.viemChain,
      account: demoAccount,
    });
    await ctx.publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: chainConfig.txConfirmationsRequired,
    });
    const ctHash = await ctx.publicClient.readContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'getValueHash',
    });

    // 2. contract-scoped permit; revocable by default via config.permit.defaultRevoker
    const permit = await ctx.cofheClient.acp.createSelf({
      issuer: demoAccount.address,
      name: 'ACP Demo Permit',
      contracts: [ctx.contractAddress],
    });
    expect(permit.scope).toBe(1); // contract scope derived automatically
    expect(permit.revokerContract).not.toBe('0x0000000000000000000000000000000000000000');
    expect(permit.revokerData).toBeGreaterThan(0); // creation timestamp

    // 3. decrypt with the scoped permit
    const value = await ctx.cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();
    expect(value).toBe(BigInt(testValue));
    expect(await ctx.cofheClient.acp.isPermitRevoked(permit)).toBe(false);

    // 4. revoke on-chain
    const revokeTx = await ctx.cofheClient.acp.revokePermit(permit);
    await ctx.publicClient.waitForTransactionReceipt({
      hash: revokeTx,
      confirmations: chainConfig.txConfirmationsRequired,
    });
    expect(await ctx.cofheClient.acp.isPermitRevoked(permit)).toBe(true);

    // 5. the revoked permit no longer decrypts. Mocks propagate the on-chain revert
    // reason directly; the staging sealOutput backend reports it as a generic denial.
    await expect(ctx.cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute()).rejects.toThrow(
      /PermissionInvalid_Disabled|acp_denied/
    );

    // 6. a fresh permit restores access.
    // Wait >1s first: permit ids are second-resolution creation timestamps, and
    // a permit minted in the same second as the revoked one shares its id — the
    // documented same-second collision (accepted as fail-safe over-revocation).
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await ctx.cofheClient.acp.createSelf({
      issuer: demoAccount.address,
      name: 'ACP Demo Permit (fresh)',
      contracts: [ctx.contractAddress],
    });
    const valueAgain = await ctx.cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();
    expect(valueAgain).toBe(BigInt(testValue));
  }, 180_000);
});
