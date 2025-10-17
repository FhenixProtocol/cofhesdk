import { describe, it, expect } from 'vitest';
import {
  ValidationUtils,
  validateSelfPermitOptions,
  validateSharingPermitOptions,
  validateImportPermitOptions,
  validateSelfPermit,
  validateSharingPermit,
  validateImportPermit,
  type Permit,
  type CreateSelfPermitOptions,
  type CreateSharingPermitOptions,
  type ImportSharedPermitOptions,
} from './index.js';
import { createMockPermit } from './test-utils.js';

describe('Validation Tests', () => {
  describe('validateSelfPermitOptions', () => {
    it('should validate valid self permit options', () => {
      const options: CreateSelfPermitOptions = {
        type: 'self',
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Bob's address
        name: 'Test Permit',
      };

      const result = validateSelfPermitOptions(options);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should reject invalid address', () => {
      const options: CreateSelfPermitOptions = {
        type: 'self',
        issuer: 'invalid-address',
        name: 'Test Permit',
      };

      const result = validateSelfPermitOptions(options);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject zero address', () => {
      const options: CreateSelfPermitOptions = {
        type: 'self',
        issuer: '0x0000000000000000000000000000000000000000',
        name: 'Test Permit',
      };

      const result = validateSelfPermitOptions(options);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateSharingPermitOptions', () => {
    it('should validate valid sharing permit options', () => {
      const options: CreateSharingPermitOptions = {
        type: 'sharing',
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Bob's address
        recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Alice's address
        name: 'Sharing Permit',
      };

      const result = validateSharingPermitOptions(options);
      expect(result.success).toBe(true);
    });

    it('should reject sharing permit with zero recipient', () => {
      const options: CreateSharingPermitOptions = {
        type: 'sharing',
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Bob's address
        recipient: '0x0000000000000000000000000000000000000000',
        name: 'Sharing Permit',
      };

      const result = validateSharingPermitOptions(options);
      expect(result.success).toBe(false);
    });

    it('should reject sharing permit with invalid recipient', () => {
      const options: CreateSharingPermitOptions = {
        type: 'sharing',
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Bob's address
        recipient: 'invalid-address',
        name: 'Sharing Permit',
      };

      const result = validateSharingPermitOptions(options);
      expect(result.success).toBe(false);
    });
  });

  describe('validateImportPermitOptions', () => {
    it('should validate valid import permit options', () => {
      const options: ImportSharedPermitOptions = {
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Bob's address
        recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Alice's address
        issuerSignature: '0x1234567890abcdef',
        name: 'Import Permit',
      };

      const result = validateImportPermitOptions(options);
      expect(result.success).toBe(true);
    });

    it('should reject import permit with empty signature', () => {
      const options: ImportSharedPermitOptions = {
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Bob's address
        recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Alice's address
        issuerSignature: '0x',
        name: 'Import Permit',
      };

      const result = validateImportPermitOptions(options);
      expect(result.success).toBe(false);
    });

    it('should reject import permit with invalid signature', () => {
      const options: ImportSharedPermitOptions = {
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Bob's address
        recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Alice's address
        issuerSignature: '0x',
        name: 'Import Permit',
      };

      const result = validateImportPermitOptions(options);
      expect(result.success).toBe(false);
    });
  });

  describe('validateSelfPermit', () => {
    it('should validate valid self permit', async () => {
      const permit = await createMockPermit();
      permit.type = 'self';
      permit.issuerSignature = '0x1234567890abcdef';

      const result = validateSelfPermit(permit);
      expect(result.success).toBe(true);
    });

    it('should reject self permit with missing sealing pair', async () => {
      const permit = { ...(await createMockPermit()), sealingPair: undefined };
      permit.type = 'self';
      const result = validateSelfPermit(permit as unknown as Permit);
      expect(result.success).toBe(false);
    });
  });

  describe('validateSharingPermit', () => {
    it('should validate valid sharing permit', async () => {
      const permit = await createMockPermit();
      permit.type = 'sharing';
      permit.issuerSignature = '0x1234567890abcdef';
      permit.recipient = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // Alice's address

      const result = validateSharingPermit(permit);
      expect(result.success).toBe(true);
    });

    it('should reject sharing permit with zero recipient', async () => {
      const permit = await createMockPermit();
      permit.type = 'sharing';
      permit.issuerSignature = '0x1234567890abcdef';
      permit.recipient = '0x0000000000000000000000000000000000000000';

      const result = validateSharingPermit(permit);
      expect(result.success).toBe(false);
    });
  });

  describe('validateImportPermit', () => {
    it('should validate valid import permit', async () => {
      const permit = await createMockPermit();
      permit.type = 'recipient';
      permit.issuerSignature = '0x1234567890abcdef';
      permit.recipient = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // Alice's address
      permit.recipientSignature = '0xabcdef1234567890';

      const result = validateImportPermit(permit);
      expect(result.success).toBe(true);
    });

    it('should reject import permit with empty recipient signature', async () => {
      const permit = await createMockPermit();
      permit.type = 'recipient';
      permit.issuerSignature = '0x1234567890abcdef';
      permit.recipient = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // Alice's address
      permit.recipientSignature = '0x';

      const result = validateImportPermit(permit);
      expect(result.success).toBe(false);
    });
  });

  describe('ValidationUtils', () => {
    describe('isExpired', () => {
      it('should return true for expired permit', async () => {
        const permit = {
          ...(await createMockPermit()),
          expiration: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        };
        expect(ValidationUtils.isExpired(permit)).toBe(true);
      });

      it('should return false for non-expired permit', async () => {
        const permit = {
          ...(await createMockPermit()),
          expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        };
        expect(ValidationUtils.isExpired(permit)).toBe(false);
      });
    });

    describe('isSigned', () => {
      it('should return true for signed self permit', async () => {
        const permit = {
          ...(await createMockPermit()),
          type: 'self' as const,
          issuerSignature: '0x1234567890abcdef' as `0x${string}`,
        };
        expect(ValidationUtils.isSigned(permit)).toBe(true);
      });

      it('should return false for unsigned self permit', async () => {
        const permit = {
          ...(await createMockPermit()),
          type: 'self' as const,
          issuerSignature: '0x' as `0x${string}`,
        };
        expect(ValidationUtils.isSigned(permit)).toBe(false);
      });

      it('should return true for signed recipient permit', async () => {
        const permit = {
          ...(await createMockPermit()),
          type: 'recipient' as const,
          recipientSignature: '0x1234567890abcdef' as `0x${string}`,
        };
        expect(ValidationUtils.isSigned(permit)).toBe(true);
      });

      it('should return false for unsigned recipient permit', async () => {
        const permit = {
          ...(await createMockPermit()),
          type: 'recipient' as const,
          recipientSignature: '0x' as `0x${string}`,
        };
        expect(ValidationUtils.isSigned(permit)).toBe(false);
      });
    });

    describe('isValid', () => {
      it('should return valid for valid permit', async () => {
        const permit = {
          ...(await createMockPermit()),
          expiration: Math.floor(Date.now() / 1000) + 3600,
          issuerSignature: '0x1234567890abcdef' as `0x${string}`,
        };
        const result = ValidationUtils.isValid(permit);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });

      it('should return invalid for expired permit', async () => {
        const permit = {
          ...(await createMockPermit()),
          expiration: Math.floor(Date.now() / 1000) - 3600,
          issuerSignature: '0x1234567890abcdef' as `0x${string}`,
        };
        const result = ValidationUtils.isValid(permit);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('expired');
      });

      it('should return invalid for unsigned permit', async () => {
        const permit = {
          ...(await createMockPermit()),
          expiration: Math.floor(Date.now() / 1000) + 3600,
          issuerSignature: '0x' as `0x${string}`,
        };
        const result = ValidationUtils.isValid(permit);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('not-signed');
      });
    });
  });
});
