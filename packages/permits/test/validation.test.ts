import { describe, it, expect } from 'vitest'
import { ValidationUtils, validatePermitOptions, validatePermit, Permit, PermitOptions } from '../src/index'
import { createMockPermit } from './utils'

describe('Validation Tests', () => {
	describe('validatePermitOptions', () => {
		it('should validate valid permit options', () => {
			const options: PermitOptions = {
				type: 'self',
				issuer: '0x1234567890123456789012345678901234567890',
				name: 'Test Permit',
			}

			const result = validatePermitOptions(options)
			expect(result.success).toBe(true)
			expect(result.data).toBeDefined()
		})

		it('should reject invalid address', () => {
			const options: PermitOptions = {
				type: 'self',
				issuer: 'invalid-address',
				name: 'Test Permit',
			}

			const result = validatePermitOptions(options)
			expect(result.success).toBe(false)
			expect(result.error).toBeDefined()
		})

		it('should reject zero address', () => {
			const options: PermitOptions = {
				type: 'self',
				issuer: '0x0000000000000000000000000000000000000000',
				name: 'Test Permit',
			}

			const result = validatePermitOptions(options)
			expect(result.success).toBe(false)
			expect(result.error).toBeDefined()
		})

		it('should validate sharing permit with recipient', () => {
			const options: PermitOptions = {
				type: 'sharing',
				issuer: '0x1234567890123456789012345678901234567890',
				recipient: '0x0987654321098765432109876543210987654321',
				name: 'Sharing Permit',
			}

			const result = validatePermitOptions(options)
			expect(result.success).toBe(true)
		})

		it('should reject sharing permit without recipient', () => {
			const options: PermitOptions = {
				type: 'sharing',
				issuer: '0x1234567890123456789012345678901234567890',
				recipient: '0x0000000000000000000000000000000000000000',
				name: 'Sharing Permit',
			}

			const result = validatePermitOptions(options)
			expect(result.success).toBe(false)
		})
	})

	describe('validatePermit', () => {
		it('should validate valid permit', async () => {
			const permit = await createMockPermit()
			permit.issuerSignature = '0x1234567890abcdef'

			const result = validatePermit(permit)
			expect(result.success).toBe(true)
		})

		it('should reject permit with missing sealing pair', async () => {
			const permit = { ...(await createMockPermit()), sealingPair: undefined }
			const result = validatePermit(permit as unknown as Permit)
			expect(result.success).toBe(false)
		})
	})

	describe('ValidationUtils', () => {
		describe('isExpired', () => {
			it('should return true for expired permit', async () => {
				const permit = {
					...(await createMockPermit()),
					expiration: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
				}
				expect(ValidationUtils.isExpired(permit)).toBe(true)
			})

			it('should return false for non-expired permit', async () => {
				const permit = {
					...(await createMockPermit()),
					expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
				}
				expect(ValidationUtils.isExpired(permit)).toBe(false)
			})
		})

		describe('isSigned', () => {
			it('should return true for signed self permit', async () => {
				const permit = {
					...(await createMockPermit()),
					type: 'self' as const,
					issuerSignature: '0x1234567890abcdef',
				}
				expect(ValidationUtils.isSigned(permit)).toBe(true)
			})

			it('should return false for unsigned self permit', async () => {
				const permit = {
					...(await createMockPermit()),
					type: 'self' as const,
					issuerSignature: '0x',
				}
				expect(ValidationUtils.isSigned(permit)).toBe(false)
			})

			it('should return true for signed recipient permit', async () => {
				const permit = {
					...(await createMockPermit()),
					type: 'recipient' as const,
					recipientSignature: '0x1234567890abcdef',
				}
				expect(ValidationUtils.isSigned(permit)).toBe(true)
			})

			it('should return false for unsigned recipient permit', async () => {
				const permit = {
					...(await createMockPermit()),
					type: 'recipient' as const,
					recipientSignature: '0x',
				}
				expect(ValidationUtils.isSigned(permit)).toBe(false)
			})
		})

		describe('isValid', () => {
			it('should return valid for valid permit', async () => {
				const permit = {
					...(await createMockPermit()),
					expiration: Math.floor(Date.now() / 1000) + 3600,
					issuerSignature: '0x1234567890abcdef',
				}
				const result = ValidationUtils.isValid(permit)
				expect(result.valid).toBe(true)
				expect(result.error).toBeNull()
			})

			it('should return invalid for expired permit', async () => {
				const permit = {
					...(await createMockPermit()),
					expiration: Math.floor(Date.now() / 1000) - 3600,
					issuerSignature: '0x1234567890abcdef',
				}
				const result = ValidationUtils.isValid(permit)
				expect(result.valid).toBe(false)
				expect(result.error).toBe('expired')
			})

			it('should return invalid for unsigned permit', async () => {
				const permit = {
					...(await createMockPermit()),
					expiration: Math.floor(Date.now() / 1000) + 3600,
					issuerSignature: '0x',
				}
				const result = ValidationUtils.isValid(permit)
				expect(result.valid).toBe(false)
				expect(result.error).toBe('not-signed')
			})
		})
	})
})
