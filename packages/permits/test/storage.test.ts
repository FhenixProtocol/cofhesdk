/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
	_permitStore,
	getPermit,
	getActivePermit,
	getPermits,
	setPermit,
	removePermit,
	getActivePermitHash,
	setActivePermitHash,
	PermitUtils,
} from '../src/index'

import { createMockPermit } from './utils'

describe('Storage Tests', () => {
	const chainId = '1'
	const account = '0x1234567890123456789012345678901234567890'

	beforeEach(() => {
		_permitStore.setState({ permits: {}, activePermitHash: {} })
	})

	afterEach(() => {
		_permitStore.setState({ permits: {}, activePermitHash: {} })
	})

	describe('Permit Storage', () => {
		it('should store and retrieve permits', async () => {
			const permit = await createMockPermit()
			const hash = PermitUtils.getHash(permit)

			setPermit(chainId, account, permit)
			const retrieved = getPermit(chainId, account, hash)

			expect(retrieved).toBeDefined()
			expect(PermitUtils.serialize(retrieved!)).toEqual(PermitUtils.serialize(permit))
		})

		it('should handle multiple permits per account', async () => {
			const permit1 = await createMockPermit()
			const permit2 = {
				...(await createMockPermit()),
				issuer: '0x0987654321098765432109876543210987654321',
			}

			const hash1 = PermitUtils.getHash(permit1)
			const hash2 = PermitUtils.getHash(permit2)

			setPermit(chainId, account, permit1)
			setPermit(chainId, account, permit2)

			const permits = getPermits(chainId, account)
			expect(Object.keys(permits)).toHaveLength(2)

			expect(PermitUtils.serialize(permits[hash1])).toEqual(PermitUtils.serialize(permit1))
			expect(PermitUtils.serialize(permits[hash2])).toEqual(PermitUtils.serialize(permit2))
		})

		it('should handle active permit hash', async () => {
			const permit = await createMockPermit()
			const hash = PermitUtils.getHash(permit)

			setPermit(chainId, account, permit)
			setActivePermitHash(chainId, account, hash)

			const activeHash = getActivePermitHash(chainId, account)
			expect(activeHash).toBe(hash)

			const activePermit = getActivePermit(chainId, account)
			expect(activePermit).toBeDefined()
			expect(PermitUtils.serialize(activePermit!)).toEqual(PermitUtils.serialize(permit))
		})

		it('should remove permits', async () => {
			const permit = await createMockPermit()
			const hash = PermitUtils.getHash(permit)

			setPermit(chainId, account, permit)
			setActivePermitHash(chainId, account, hash)

			removePermit(chainId, account, hash, true)

			const retrieved = getPermit(chainId, account, hash)
			expect(retrieved).toBeUndefined()

			const activeHash = getActivePermitHash(chainId, account)
			expect(activeHash).toBeUndefined()
		})

		it('should prevent removing last permit without force', async () => {
			const permit = await createMockPermit()
			const hash = PermitUtils.getHash(permit)

			setPermit(chainId, account, permit)
			setActivePermitHash(chainId, account, hash)

			expect(() => {
				removePermit(chainId, account, hash, false)
			}).toThrow('Cannot remove the last permit without force flag')
		})

		it('should switch active permit when removing current active', async () => {
			const permit1 = await createMockPermit()
			const permit2 = {
				...(await createMockPermit()),
				name: 'Second Permit',
				issuer: '0x0987654321098765432109876543210987654321', // Different issuer
			}

			const hash1 = PermitUtils.getHash(permit1)
			const hash2 = PermitUtils.getHash(permit2)

			setPermit(chainId, account, permit1)
			setPermit(chainId, account, permit2)
			setActivePermitHash(chainId, account, hash1)

			removePermit(chainId, account, hash1, false)

			const activeHash = getActivePermitHash(chainId, account)
			expect(activeHash).toBe(hash2)
		})
	})
})
