/* eslint-disable turbo/no-undeclared-env-vars */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';
import '@nomicfoundation/hardhat-ethers';

/**
 * Sends funds to the specified address
 * @param hre Hardhat Runtime Environment
 * @param toAddress Address to send funds to
 * @param amount Amount to send in ETH (default: 10)
 * @returns Transaction receipt or null if failed
 */
export async function localcofheFundAccount(hre: HardhatRuntimeEnvironment, toAddress: string, amount: string = '10') {
  // Load private key from environment
  const privateKey =
    process.env.FUNDER_PRIVATE_KEY ?? '0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659';
  if (!privateKey) {
    console.error('Error: FUNDER_PRIVATE_KEY environment variable not set');
    return null;
  }

  try {
    // Create wallet from private key
    const wallet = new hre.ethers.Wallet(privateKey, hre.ethers.provider);

    // Get wallet balance
    const balance = await hre.ethers.provider.getBalance(wallet.address);
    console.log(`Funder wallet address: ${wallet.address}`);
    console.log(`Funder wallet balance: ${hre.ethers.formatEther(balance)} ETH`);

    // Check if wallet has enough funds
    const amountToSend = hre.ethers.parseEther(amount);
    if (balance < amountToSend) {
      console.error(
        `Error: Funder wallet doesn't have enough funds. Current balance: ${hre.ethers.formatEther(balance)} ETH`
      );
      return null;
    }

    // Send transaction
    console.log(`Sending ${amount} ETH to ${toAddress}...`);
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: amountToSend,
    });

    console.log(`Transaction sent! Hash: ${tx.hash}`);
    console.log('Waiting for confirmation...');

    // Wait for transaction to be mined
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
    console.log(`Successfully sent ${amount} ETH to ${toAddress}`);

    return receipt;
  } catch (error) {
    console.error('Error sending funds:', error);
    return null;
  }
}

/**
 * Checks a wallet's balance and funds it if below 1 ETH
 * @param hre Hardhat Runtime Environment
 * @param walletAddress Address of the wallet to check and potentially fund
 * @returns Promise that resolves when the funding operation completes (if needed)
 */
export async function localcofheFundWalletIfNeeded(hre: HardhatRuntimeEnvironment, walletAddress: string) {
  // Check wallet balance and fund if needed
  const walletBalance = await hre.ethers.provider.getBalance(walletAddress);
  console.log(`Wallet balance: ${hre.ethers.formatEther(walletBalance)} ETH`);

  if (walletBalance < hre.ethers.parseEther('1')) {
    console.log(`Wallet balance is less than 1 ETH. Funding ${walletAddress}...`);
    const receipt = await localcofheFundAccount(hre, walletAddress);
    if (receipt) {
      const newBalance = await hre.ethers.provider.getBalance(walletAddress);
      console.log(`Wallet new balance: ${hre.ethers.formatEther(newBalance)} ETH`);
    } else {
      console.error(`Failed to fund ${walletAddress}`);
    }
  }
}
