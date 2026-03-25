import type { WalletClient, PublicClient } from 'viem';
import { parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const FUNDER_PRIVATE_KEY = '0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659';

/**
 * Sends ETH to `toAddress` on the localcofhe network using the funder wallet.
 * The funder private key can be overridden via the FUNDER_PRIVATE_KEY environment variable.
 */
export async function localcofheFundAccount(
  publicClient: PublicClient,
  walletClient: WalletClient,
  toAddress: `0x${string}`,
  amount: string = '10'
): Promise<void> {
  const privateKey = (process.env['FUNDER_PRIVATE_KEY'] ?? FUNDER_PRIVATE_KEY) as `0x${string}`;
  const funderAccount = privateKeyToAccount(privateKey);

  const balance = await publicClient.getBalance({ address: funderAccount.address });
  console.log(`Funder wallet address: ${funderAccount.address}`);
  console.log(`Funder wallet balance: ${balance} wei`);

  const amountWei = parseEther(amount);
  if (balance < amountWei) {
    console.error(`Funder wallet doesn't have enough funds. Balance: ${balance} wei, needed: ${amountWei} wei`);
    return;
  }

  console.log(`Sending ${amount} ETH to ${toAddress}...`);
  const hash = await walletClient.sendTransaction({
    account: funderAccount,
    to: toAddress,
    value: amountWei,
    chain: null,
  });

  console.log(`Transaction sent! Hash: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
  console.log(`Successfully sent ${amount} ETH to ${toAddress}`);
}

/**
 * Checks a wallet's balance and funds it if below 1 ETH.
 */
export async function localcofheFundWalletIfNeeded(
  publicClient: PublicClient,
  walletClient: WalletClient,
  walletAddress: `0x${string}`
): Promise<void> {
  const balance = await publicClient.getBalance({ address: walletAddress });
  console.log(`Wallet balance: ${balance} wei`);

  if (balance < parseEther('1')) {
    console.log(`Balance below 1 ETH. Funding ${walletAddress}...`);
    await localcofheFundAccount(publicClient, walletClient, walletAddress);

    const newBalance = await publicClient.getBalance({ address: walletAddress });
    console.log(`New wallet balance: ${newBalance} wei`);
  }
}
