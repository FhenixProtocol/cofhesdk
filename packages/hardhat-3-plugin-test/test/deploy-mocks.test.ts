import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import {
  TASK_MANAGER_ADDRESS,
  MOCKS_DECRYPT_RESULT_SIGNER_PRIVATE_KEY,
  MOCKS_ZK_VERIFIER_ADDRESS,
  MOCKS_THRESHOLD_NETWORK_ADDRESS,
  MOCKS_ZK_VERIFIER_SIGNER_ADDRESS,
  TEST_BED_ADDRESS,
  FheTypes,
} from '@cofhe/sdk';
import { privateKeyToAccount } from 'viem/accounts';

describe('Deploy Mocks', async () => {
  const { viem, cofhe } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const walletClients = await viem.getWalletClients();
  const [walletClient, attackerClient] = walletClients;

  const hasCode = async (address: `0x${string}`) => {
    const code = await publicClient.getCode({ address });
    return !!code && code.length > 2;
  };

  const lower = (address: string) => address.toLowerCase();

  const zeroAddress = '0x0000000000000000000000000000000000000000' as const;
  const zeroBytes32 = `0x${'00'.repeat(32)}` as const;

  const getErrorText = (err: unknown) => {
    if (err && typeof err === 'object') {
      const e = err as any;
      return [e?.shortMessage, e?.message, e?.details, e?.cause ? String(e.cause) : undefined, String(err)]
        .filter(Boolean)
        .join('\n');
    }
    return String(err);
  };

  const expectRevert = async (fn: () => Promise<unknown>, pattern: RegExp) => {
    await assert.rejects(fn, (err) => {
      assert.match(getErrorText(err), pattern);
      return true;
    });
  };

  it('MockTaskManager is deployed at the expected fixed address', async () => {
    const { address } = cofhe.mocks.MockTaskManager;
    assert.equal(lower(address), lower(TASK_MANAGER_ADDRESS));
    assert.ok(await hasCode(address));
  });

  it('MockTaskManager is initialized and has decryptResultSigner configured', async () => {
    const isInitialized = await publicClient.readContract({
      ...cofhe.mocks.MockTaskManager,
      functionName: 'isInitialized',
    });
    assert.equal(isInitialized, true);

    const decryptResultSigner = await publicClient.readContract({
      ...cofhe.mocks.MockTaskManager,
      functionName: 'decryptResultSigner',
    });

    const expectedDecryptSigner = privateKeyToAccount(MOCKS_DECRYPT_RESULT_SIGNER_PRIVATE_KEY).address;
    assert.equal(lower(decryptResultSigner), lower(expectedDecryptSigner));
    assert.notEqual(lower(decryptResultSigner), lower(zeroAddress));
  });

  it('MockACL is deployed and its address matches TaskManager.acl()', async () => {
    const { address } = await cofhe.mocks.MockACL();
    const aclFromTm = await publicClient.readContract({
      ...cofhe.mocks.MockTaskManager,
      functionName: 'acl',
    });
    assert.equal(lower(address), lower(aclFromTm));
    assert.ok(await hasCode(address));
  });

  it('MockZkVerifier is deployed at the expected fixed address', async () => {
    const { address } = cofhe.mocks.MockZkVerifier;
    assert.equal(lower(address), lower(MOCKS_ZK_VERIFIER_ADDRESS));
    assert.ok(await hasCode(address));
  });

  it('MockZkVerifier can insert ctHashes into MockTaskManager mockStorage', async () => {
    assert.ok(walletClient, 'walletClient not available');

    const user = walletClient.account?.address;
    assert.ok(user);

    const chainId = await publicClient.getChainId();
    const value = 123n;
    const ctHash = await publicClient.readContract({
      ...cofhe.mocks.MockZkVerifier,
      functionName: 'zkVerifyCalcCtHash',
      args: [value, FheTypes.Uint32, user, 0, BigInt(chainId)],
    });

    await walletClient.writeContract({
      ...cofhe.mocks.MockZkVerifier,
      functionName: 'insertCtHash',
      args: [ctHash, value],
    });

    const stored = await publicClient.readContract({
      ...cofhe.mocks.MockTaskManager,
      functionName: 'mockStorage',
      args: [ctHash],
    });

    assert.equal(stored, value);
  });

  it('MockThresholdNetwork is deployed at the expected fixed address', async () => {
    const { address } = cofhe.mocks.MockThresholdNetwork;
    assert.equal(lower(address), lower(MOCKS_THRESHOLD_NETWORK_ADDRESS));
    assert.ok(await hasCode(address));
  });

  it('MockThresholdNetwork is initialized with TaskManager + ACL', async () => {
    const tmFromThreshold = await publicClient.readContract({
      ...cofhe.mocks.MockThresholdNetwork,
      functionName: 'mockTaskManager',
    });
    assert.equal(lower(tmFromThreshold), lower(TASK_MANAGER_ADDRESS));

    const aclFromThreshold = await publicClient.readContract({
      ...cofhe.mocks.MockThresholdNetwork,
      functionName: 'mockAcl',
    });
    const aclFromTm = await publicClient.readContract({
      ...cofhe.mocks.MockTaskManager,
      functionName: 'acl',
    });
    assert.equal(lower(aclFromThreshold), lower(aclFromTm));
  });

  it('TestBed is deployed at the expected fixed address', async () => {
    const { address } = cofhe.mocks.TestBed;
    assert.equal(lower(address), lower(TEST_BED_ADDRESS));
    assert.ok(await hasCode(address));
  });

  it('Negative: only the owner can call MockTaskManager admin setters', async () => {
    assert.notEqual(lower(attackerClient.account?.address ?? ''), lower(walletClient.account?.address ?? ''));

    await expectRevert(
      () =>
        attackerClient.writeContract({
          ...cofhe.mocks.MockTaskManager,
          functionName: 'setAggregator',
          args: [MOCKS_ZK_VERIFIER_SIGNER_ADDRESS],
        }),
      /OnlyOwnerAllowed|0x7238ea56/i
    );
  });

  it('Negative: MockTaskManager rejects zero addresses for setACLContract / setAggregator', async () => {
    await expectRevert(
      () =>
        walletClient.writeContract({
          ...cofhe.mocks.MockTaskManager,
          functionName: 'setACLContract',
          args: [zeroAddress],
        }),
      /InvalidAddress|0xe6c4247b/i
    );

    await expectRevert(
      () =>
        walletClient.writeContract({
          ...cofhe.mocks.MockTaskManager,
          functionName: 'setAggregator',
          args: [zeroAddress],
        }),
      /InvalidAddress|0xe6c4247b/i
    );
  });

  it('Negative: MockThresholdNetwork.querySealOutput reverts when sealingKey is missing', async () => {
    await expectRevert(
      () =>
        publicClient.readContract({
          ...cofhe.mocks.MockThresholdNetwork,
          functionName: 'querySealOutput',
          args: [
            0n,
            0n,
            {
              issuer: zeroAddress,
              expiration: 0n,
              recipient: zeroAddress,
              validatorId: 0n,
              validatorContract: zeroAddress,
              sealingKey: zeroBytes32,
              issuerSignature: '0x',
              recipientSignature: '0x',
            },
          ],
        }),
      /SealingKeyMissing|0xb78926d8/i
    );
  });
});
