import { describe, it, expect, beforeEach } from 'vitest'
import { parseEther, createPublicClient, createWalletClient, http, PublicClient, WalletClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { WagmiAdapter } from '../src/wagmi'

describe('WagmiAdapter', () => {
	const testRpcUrl = 'https://ethereum-sepolia.rpc.subquery.network/public'
	const SEPOLIA_CHAIN_ID = 11155111
	let account: ReturnType<typeof privateKeyToAccount>
	let publicClient: PublicClient
	let walletClient: WalletClient

	beforeEach(() => {
		// Create common setup for all tests - no chain needed
		account = privateKeyToAccount(('0x' + '1'.repeat(64)) as `0x${string}`)

		publicClient = createPublicClient({
			transport: http(testRpcUrl),
		})

		walletClient = createWalletClient({
			transport: http(testRpcUrl),
			account,
		})
	})

	it('should work with real Wagmi clients', async () => {
		const result = await WagmiAdapter(walletClient, publicClient)

		expect(result).toHaveProperty('publicClient')
		expect(result).toHaveProperty('walletClient')
		expect(result.publicClient).toBe(publicClient)
		expect(result.walletClient).toBe(walletClient)
	})

	it('should throw error when wallet client is missing', async () => {
		const mockPublicClient = {} as any

		await expect(async () => {
			await WagmiAdapter(null as any, mockPublicClient)
		}).rejects.toThrow('WalletClient is required')
	})

	it('should throw error when public client is missing', async () => {
		const mockWalletClient = {} as any

		await expect(async () => {
			await WagmiAdapter(mockWalletClient, null as any)
		}).rejects.toThrow('PublicClient is required')
	})

	describe('Provider Functions', () => {
		it('should support getChainId', async () => {
			const { publicClient: resultPublic } = await WagmiAdapter(walletClient, publicClient)

			const chainId = await resultPublic.getChainId()
			expect(typeof chainId).toBe('number')
			expect(chainId).toBe(SEPOLIA_CHAIN_ID)
		}, 10000)

		it('should support call (contract read)', async () => {
			const { publicClient: resultPublic } = await WagmiAdapter(walletClient, publicClient)

			// Test eth_call - get ETH balance of zero address
			const balance = await resultPublic.getBalance({
				address: '0x0000000000000000000000000000000000000000',
			})
			expect(typeof balance).toBe('bigint')
		}, 10000)

		it('should support request (raw RPC)', async () => {
			const { publicClient: resultPublic } = await WagmiAdapter(walletClient, publicClient)

			// Test raw RPC request
			const blockNumber = (await resultPublic.request({
				method: 'eth_blockNumber',
			})) as string
			expect(typeof blockNumber).toBe('string')
			expect(blockNumber.startsWith('0x')).toBe(true)
		}, 10000)
	})

	describe('Signer Functions', () => {
		it('should support getAddress', async () => {
			const { walletClient: resultWallet } = await WagmiAdapter(walletClient, publicClient)

			const addresses = await resultWallet.getAddresses()
			expect(Array.isArray(addresses)).toBe(true)
			// Should contain the account address
			expect(addresses).toContain(account.address)
		}, 10000)

		it('should support signTypedData', async () => {
			const { walletClient: resultWallet } = await WagmiAdapter(walletClient, publicClient)

			const domain = {
				name: 'Test',
				version: '1',
				chainId: SEPOLIA_CHAIN_ID, // Sepolia
				verifyingContract: '0x0000000000000000000000000000000000000000' as const,
			}

			const types = {
				Message: [{ name: 'content', type: 'string' }],
			}

			const message = { content: 'Hello World' }

			const signature = await resultWallet.signTypedData({
				domain,
				types,
				primaryType: 'Message',
				message,
				account: resultWallet.account!,
			})

			expect(typeof signature).toBe('string')
			expect(signature.startsWith('0x')).toBe(true)
		}, 10000)

		it('should support sendTransaction', async () => {
			const { publicClient: resultPublic, walletClient: resultWallet } = await WagmiAdapter(walletClient, publicClient)

			// Try to send a transaction - this will fail due to insufficient funds
			try {
				console.log('estimating gas')
				const gas = await resultPublic.estimateGas({
					account: account.address,
					to: '0x0000000000000000000000000000000000000000',
					value: parseEther('0'),
				})

				console.log('sending transaction', account.address)
				const hash = await resultWallet.sendTransaction({
					to: '0x0000000000000000000000000000000000000000' as `0x${string}`,
					value: parseEther('0'),
					gas,
					account: resultWallet.account!,
					chain: resultWallet.chain,
				})
				console.log('transaction sent', hash)

				// If it succeeds (shouldn't due to no funds), verify the format
				expect(typeof hash).toBe('string')
				expect(hash.startsWith('0x')).toBe(true)
				expect(hash.length).toBe(66)
			} catch (error: any) {
				// Expected error: insufficient funds (good!)
				const isInsufficientFunds = error.message.includes('insufficient funds') || error.message.includes('balance')

				expect(isInsufficientFunds).toBe(true)
				console.log('Expected error (insufficient funds):', error.message)
			}
		}, 10000)
	})
})
