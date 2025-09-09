import { describe, it, expect } from 'vitest'
import { PermitUtils, PermitOptions } from '../src/index'
import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem'
import { arbitrumSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

// Test private key (well-known test key from Anvil/Hardhat)
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

// Create real viem clients for Arbitrum Sepolia
const publicClient: PublicClient = createPublicClient({
	chain: arbitrumSepolia,
	transport: http(),
})

const walletClient: WalletClient = createWalletClient({
	chain: arbitrumSepolia,
	transport: http(),
	account: privateKeyToAccount(TEST_PRIVATE_KEY),
})

// Helper to get the wallet address
const walletAddress = walletClient.account!.address

describe('PermitUtils Tests', () => {
	describe('create', () => {
		it('should create a permit with valid options', async () => {
			const options: PermitOptions = {
				type: 'self',
				issuer: walletAddress,
				name: 'Test Permit',
			}

			const permit = await PermitUtils.create(options)

			expect(permit.name).toBe('Test Permit')
			expect(permit.type).toBe('self')
			expect(permit.issuer).toBe(walletAddress)
			expect(permit.sealingPair).toBeDefined()
			expect(permit.sealingPair.privateKey).toBeDefined()
			expect(permit.sealingPair.publicKey).toBeDefined()
		})

		it('should throw error for invalid options', async () => {
			const options: PermitOptions = {
				type: 'self',
				issuer: 'invalid-address',
				name: 'Test Permit',
			}

			await expect(PermitUtils.create(options)).rejects.toThrow()
		})
	})

	describe('createAndSign', () => {
		it('should create and sign a permit', async () => {
			const options: PermitOptions = {
				type: 'self',
				issuer: walletAddress,
				name: 'Test Permit',
			}

			const permit = await PermitUtils.createAndSign(options, walletClient, publicClient)

			expect(permit.issuerSignature).toBeDefined()
			expect(permit.issuerSignature).not.toBe('0x')
			expect(permit._signedDomain).toBeDefined()
		})
	})

	describe('sign', () => {
		it('should sign a self permit', async () => {
			const permit = await PermitUtils.create({
				type: 'self',
				issuer: walletAddress,
				name: 'Test Permit',
			})

			const signedPermit = await PermitUtils.sign(permit, walletClient, publicClient)

			expect(signedPermit.issuerSignature).toBeDefined()
			expect(signedPermit.issuerSignature).not.toBe('0x')
			expect(signedPermit._signedDomain).toBeDefined()
		})

		it('should sign a recipient permit', async () => {
			const permit = await PermitUtils.create({
				type: 'recipient',
				issuer: walletAddress,
				recipient: '0x0987654321098765432109876543210987654321',
				issuerSignature: '0xexisting-signature',
				name: 'Test Permit',
			})

			const signedPermit = await PermitUtils.sign(permit, walletClient, publicClient)

			expect(signedPermit.recipientSignature).toBeDefined()
			expect(signedPermit.recipientSignature).not.toBe('0x')
			expect(signedPermit._signedDomain).toBeDefined()
		})

		it('should throw error for undefined signer', async () => {
			const permit = await PermitUtils.create({
				type: 'self',
				issuer: walletAddress,
				name: 'Test Permit',
			})

			await expect(
				// @ts-expect-error - undefined signer
				PermitUtils.sign(permit, undefined, publicClient)
			).rejects.toThrow()
		})
	})

	describe('serialize/deserialize', () => {
		it('should serialize and deserialize a permit', async () => {
			const originalPermit = await PermitUtils.create({
				type: 'self',
				issuer: walletAddress,
				name: 'Test Permit',
			})

			const serialized = PermitUtils.serialize(originalPermit)
			const deserialized = PermitUtils.deserialize(serialized)

			expect(deserialized.name).toBe(originalPermit.name)
			expect(deserialized.type).toBe(originalPermit.type)
			expect(deserialized.issuer).toBe(originalPermit.issuer)
			expect(deserialized.sealingPair.privateKey).toBe(originalPermit.sealingPair.privateKey)
			expect(deserialized.sealingPair.publicKey).toBe(originalPermit.sealingPair.publicKey)
		})
	})

	describe('getPermission', () => {
		it('should extract permission from permit', async () => {
			const permit = await PermitUtils.createAndSign(
				{
					type: 'self',
					issuer: walletAddress,
					name: 'Test Permit',
				},
				walletClient,
				publicClient
			)

			const permission = PermitUtils.getPermission(permit)

			expect(permission.issuer).toBe(permit.issuer)
			expect(permission.sealingKey).toBe(`0x${permit.sealingPair.publicKey}`)
			expect(permission).not.toHaveProperty('name')
			expect(permission).not.toHaveProperty('type')
		})
	})

	describe('getHash', () => {
		it('should generate consistent hash for same permit data', async () => {
			const permit1 = await PermitUtils.create({
				type: 'self',
				issuer: walletAddress,
				name: 'Test Permit',
			})

			const permit2 = await PermitUtils.create({
				type: 'self',
				issuer: walletAddress,
				name: 'Test Permit',
			})

			const hash1 = PermitUtils.getHash(permit1)
			const hash2 = PermitUtils.getHash(permit2)

			expect(hash1).toBe(hash2)
		})
	})

	describe('export', () => {
		it('should export permit data without sensitive fields', async () => {
			const permit = await PermitUtils.create({
				type: 'self',
				issuer: walletAddress,
				name: 'Test Permit',
			})

			const exported = PermitUtils.export(permit)
			const parsed = JSON.parse(exported)

			expect(parsed.name).toBe('Test Permit')
			expect(parsed.issuer).toBe(walletAddress)
			expect(parsed).not.toHaveProperty('sealingPair')
			expect(parsed).not.toHaveProperty('issuerSignature')
		})
	})

	describe('updateName', () => {
		it('should update permit name immutably', async () => {
			const permit = await PermitUtils.create({
				type: 'self',
				issuer: walletAddress,
				name: 'Original Name',
			})

			const updatedPermit = PermitUtils.updateName(permit, 'New Name')

			expect(updatedPermit.name).toBe('New Name')
			expect(permit.name).toBe('Original Name') // Original should be unchanged
			expect(updatedPermit).not.toBe(permit) // Should be a new object
		})
	})

	describe('validation helpers', () => {
		it('should check if permit is expired', async () => {
			const expiredPermit = await PermitUtils.create({
				type: 'self',
				issuer: walletAddress,
				name: 'Test Permit',
				expiration: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
			})

			const validPermit = await PermitUtils.create({
				type: 'self',
				issuer: walletAddress,
				name: 'Test Permit',
				expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
			})

			expect(PermitUtils.isExpired(expiredPermit)).toBe(true)
			expect(PermitUtils.isExpired(validPermit)).toBe(false)
		})

		it('should check if permit is signed', async () => {
			const unsignedPermit = await PermitUtils.create({
				type: 'self',
				issuer: walletAddress,
				name: 'Test Permit',
			})

			const signedPermit = await PermitUtils.sign(unsignedPermit, walletClient, publicClient)

			expect(PermitUtils.isSigned(unsignedPermit)).toBe(false)
			expect(PermitUtils.isSigned(signedPermit)).toBe(true)
		})

		it('should check overall validity', async () => {
			const validPermit = await PermitUtils.create({
				type: 'self',
				issuer: walletAddress,
				name: 'Test Permit',
				expiration: Math.floor(Date.now() / 1000) + 3600,
			})

			const signedPermit = await PermitUtils.sign(validPermit, walletClient, publicClient)

			const validation = PermitUtils.isValid(signedPermit)
			expect(validation.valid).toBe(true)
			expect(validation.error).toBeNull()
		})
	})

	describe('real contract interactions', () => {
		it('should fetch EIP712 domain from real Arbitrum Sepolia contract', async () => {
			// This test uses the real public client to fetch actual contract data
			const domain = await PermitUtils.fetchEIP712Domain(publicClient)

			expect(domain).toBeDefined()
			expect(domain.name).toBeDefined()
			expect(domain.version).toBeDefined()
			expect(domain.chainId).toBeDefined()
			expect(domain.verifyingContract).toBeDefined()
			expect(domain.verifyingContract).toMatch(/^0x[a-fA-F0-9]{40}$/) // Valid Ethereum address
		}, 10000) // 10 second timeout for network call

		it('should check signed domain validity with real contract data', async () => {
			const permit = await PermitUtils.create({
				type: 'self',
				issuer: walletAddress,
				name: 'Test Permit',
			})

			// Sign the permit to get a domain
			const signedPermit = await PermitUtils.sign(permit, walletClient, publicClient)

			// Check if the signed domain is valid against the real contract
			const isValid = await PermitUtils.checkSignedDomainValid(signedPermit, publicClient)

			expect(typeof isValid).toBe('boolean')
		}, 10000) // 10 second timeout for network call
	})
})
