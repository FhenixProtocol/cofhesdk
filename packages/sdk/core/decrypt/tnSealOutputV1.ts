import { type Permission, type EthEncryptedData } from '@/permits';

import { CofhesdkError, CofhesdkErrorCode } from '../error.js';

export async function tnSealOutputV1(
  ctHash: bigint,
  chainId: number,
  permission: Permission,
  thresholdNetworkUrl: string
): Promise<EthEncryptedData> {
  let sealed: EthEncryptedData | undefined;
  let errorMessage: string | undefined;
  let sealOutputResult: { sealed: EthEncryptedData; error_message: string } | undefined;

  const body = {
    ct_tempkey: ctHash.toString(16).padStart(64, '0'),
    host_chain_id: chainId,
    permit: permission,
  };

  try {
    const sealOutputRes = await fetch(`${thresholdNetworkUrl}/sealoutput`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    sealOutputResult = (await sealOutputRes.json()) as { sealed: EthEncryptedData; error_message: string };
    sealed = sealOutputResult.sealed;
    errorMessage = sealOutputResult.error_message;
  } catch (e) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.SealOutputFailed,
      message: `sealOutput request failed`,
      hint: 'Ensure the threshold network URL is valid.',
      cause: e instanceof Error ? e : undefined,
      context: {
        thresholdNetworkUrl,
        body,
      },
    });
  }

  if (sealed == null) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.SealOutputReturnedNull,
      message: `sealOutput request returned no data | Caused by: ${errorMessage}`,
      context: {
        thresholdNetworkUrl,
        body,
        sealOutputResult,
      },
    });
  }

  return sealed;
}
