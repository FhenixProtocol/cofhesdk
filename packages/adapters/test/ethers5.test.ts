import { describe, it, expect, beforeEach } from 'vitest'
import { parseEther } from 'viem'
import { Ethers5Adapter } from '../src/ethers5'
import { createMockEIP1193Provider } from './test-utils'
import * as ethers5 from 'ethers5'

describe('Ethers5Adapter', () => {
	const testRpcUrl = 'https://ethereum-sepolia.rpc.subquery.network/public'
	const SEPOLIA_CHAIN_ID = 11155111
	let provider: ethers5.providers.JsonRpcProvider
	let wallet: ethers5.Wallet

	beforeEach(() => {
		// Create common setup for all tests
		provider = new ethers5.providers.JsonRpcProvider(testRpcUrl)
		wallet = new ethers5.Wallet('0x' + '1'.repeat(64), provider)
	})

	it('should work with real JsonRpcProvider and Wallet', async () => {
		const result = await Ethers5Adapter(provider, wallet)

		expect(result).toHaveProperty('publicClient')
		expect(result).toHaveProperty('walletClient')
		expect(result.publicClient).toBeDefined()
		expect(result.walletClient).toBeDefined()
	})

	it('should work with Web3Provider signer', async () => {
		const mockEthereum = createMockEIP1193Provider()
		const web3Provider = new ethers5.providers.Web3Provider(mockEthereum as any)
		const wallet = new ethers5.Wallet('0x' + '1'.repeat(64), web3Provider)

		const result = await Ethers5Adapter(web3Provider, wallet)

		expect(result).toHaveProperty('publicClient')
		expect(result).toHaveProperty('walletClient')
	})

	it('should work without configuration', async () => {
		const result = await Ethers5Adapter(provider, wallet)

		expect(result).toHaveProperty('publicClient')
		expect(result).toHaveProperty('walletClient')
		expect(result.publicClient).toBeDefined()
		expect(result.walletClient).toBeDefined()
	})

	it('should throw error when signer has no provider', async () => {
		const signerWithoutProvider = { provider: null }

		await expect(async () => {
			await Ethers5Adapter(signerWithoutProvider as any, wallet)
		}).rejects.toThrow('Provider does not support EIP-1193 interface')
	})

	it('should work with real network call', async () => {
		const result = await Ethers5Adapter(provider, wallet)

		// Test real network call
		const chainId = await result.publicClient.getChainId()
		expect(typeof chainId).toBe('number')
		expect(chainId).toBeGreaterThan(0)
	}, 10000)

	describe('Provider Functions', () => {
		it('should support getChainId', async () => {
			const { publicClient } = await Ethers5Adapter(provider, wallet)

			const chainId = await publicClient.getChainId()
			expect(typeof chainId).toBe('number')
			expect(chainId).toBe(SEPOLIA_CHAIN_ID) // Sepolia
		}, 10000)

		it('should support call (contract read)', async () => {
			const { publicClient } = await Ethers5Adapter(provider, wallet)

			// Test eth_call - get ETH balance of zero address
			const balance = await publicClient.getBalance({
				address: '0x0000000000000000000000000000000000000000',
			})
			expect(typeof balance).toBe('bigint')
		}, 10000)

		it('should support request (raw RPC)', async () => {
			const { publicClient } = await Ethers5Adapter(provider, wallet)

			// Test raw RPC request - viem requires both method and params
			const blockNumber = (await publicClient.request({
				method: 'eth_blockNumber',
			})) as string
			expect(typeof blockNumber).toBe('string')
			expect(blockNumber.startsWith('0x')).toBe(true)
		}, 10000)
	})

	describe('Signer Functions', () => {
		it('should support getAddress', async () => {
			const { walletClient } = await Ethers5Adapter(provider, wallet)

			const addresses = await walletClient.getAddresses()
			expect(Array.isArray(addresses)).toBe(true)
			// Note: For HTTP transport, this might return empty array
			// For EIP-1193 providers, it would return actual addresses
		}, 10000)

		it('should support signTypedData', async () => {
			const { walletClient } = await Ethers5Adapter(provider, wallet)

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

			const signature = await walletClient.signTypedData({
				domain,
				types,
				primaryType: 'Message',
				message,
				account: walletClient.account!,
			})

			expect(typeof signature).toBe('string')
			expect(signature.startsWith('0x')).toBe(true)
		}, 10000)

		it('should support sendTransaction', async () => {
			const { publicClient, walletClient } = await Ethers5Adapter(provider, wallet)

			const account = await walletClient.account
			const chain = await publicClient.getChainId()

			console.log('Wallet client ethers5', account, chain)

			// Try to send a transaction - this will fail due to insufficient funds
			try {
				console.log('estimating gas')
				const gas = await publicClient.estimateGas({
					account: wallet.address as `0x${string}`,
					to: '0x0000000000000000000000000000000000000000',
					value: parseEther('0'),
				})

				console.log('sending transaction', await wallet.getAddress())
				const hash = await walletClient.sendTransaction({
					to: '0x0000000000000000000000000000000000000000' as `0x${string}`,
					value: parseEther('0'),
					gas,
					account: walletClient.account!,
					chain: walletClient.chain,
				})
				console.log('transaction sent', hash)

				// If it succeeds (shouldn't due to no funds), verify the format
				expect(typeof hash).toBe('string')
				expect(hash.startsWith('0x')).toBe(true)
				expect(hash.length).toBe(66)
			} catch (error: any) {
				// Expected errors: either insufficient funds (good!) or method not supported
				const isInsufficientFunds = error.message.includes('insufficient funds') || error.message.includes('balance')

				expect(isInsufficientFunds).toBe(true)
				console.log('Expected error (insufficient funds):', error.message)
			}
		}, 10000)
	})
})
