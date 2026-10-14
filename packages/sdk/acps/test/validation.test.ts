import { describe, it, expect } from 'vitest';
import {
  ValidationUtils,
  validateSelfACPOptions,
  validateSharingACPOptions,
  validateImportACPOptions,
  validateSelfACP,
  validateSharingACP,
  validateImportACP,
  type ACP,
  type CreateSelfACPOptions,
  type CreateSharingACPOptions,
  type ImportSharedACPOptions,
} from '../index.js';
import { createMockACP } from '../test-utils.js';

describe('Validation Tests', () => {
  describe('validateSelfACPOptions', () => {
    it('should validate valid self acp options', () => {
      const options: CreateSelfACPOptions = {
        type: 'self',
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Bob's address
        name: 'Test ACP',
      };

      expect(() => validateSelfACPOptions(options)).not.toThrow();
      const result = validateSelfACPOptions(options);
      expect(result).toBeDefined();
    });

    it('should reject invalid address', () => {
      const options: CreateSelfACPOptions = {
        type: 'self',
        issuer: 'invalid-address',
        name: 'Test ACP',
      };

      expect(() => validateSelfACPOptions(options)).toThrow();
    });

    it('should reject zero address', () => {
      const options: CreateSelfACPOptions = {
        type: 'self',
        issuer: '0x0000000000000000000000000000000000000000',
        name: 'Test ACP',
      };

      expect(() => validateSelfACPOptions(options)).toThrow();
    });
  });

  describe('validateSharingACPOptions', () => {
    it('should validate valid sharing acp options', () => {
      const options: CreateSharingACPOptions = {
        type: 'sharing',
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Bob's address
        recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Alice's address
        name: 'Sharing ACP',
      };

      expect(() => validateSharingACPOptions(options)).not.toThrow();
    });

    it('should reject sharing acp with zero recipient', () => {
      const options: CreateSharingACPOptions = {
        type: 'sharing',
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Bob's address
        recipient: '0x0000000000000000000000000000000000000000',
        name: 'Sharing ACP',
      };

      expect(() => validateSharingACPOptions(options)).toThrow();
    });

    it('should reject sharing acp with invalid recipient', () => {
      const options: CreateSharingACPOptions = {
        type: 'sharing',
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Bob's address
        recipient: 'invalid-address',
        name: 'Sharing ACP',
      };

      expect(() => validateSharingACPOptions(options)).toThrow();
    });
  });

  describe('validateImportACPOptions', () => {
    it('should validate valid import acp options', () => {
      const options: ImportSharedACPOptions = {
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Bob's address
        expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Alice's address
        issuerSignature: '0x1234567890abcdef',
        name: 'Import ACP',
      };

      expect(() => validateImportACPOptions(options)).not.toThrow();
    });

    it('should reject import acp with missing expiration', () => {
      const options = {
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Bob's address
        recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Alice's address
        issuerSignature: '0x1234567890abcdef',
        name: 'Import ACP',
      };
      expect(() => validateImportACPOptions(options)).toThrow();
    });

    it('should reject import acp with empty signature', () => {
      const options: ImportSharedACPOptions = {
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Bob's address
        expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Alice's address
        issuerSignature: '0x',
        name: 'Import ACP',
      };

      expect(() => validateImportACPOptions(options)).toThrow();
    });

    it('should reject import acp with invalid signature', () => {
      const options: ImportSharedACPOptions = {
        issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Bob's address
        expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Alice's address
        issuerSignature: '0x',
        name: 'Import ACP',
      };

      expect(() => validateImportACPOptions(options)).toThrow();
    });
  });

  describe('validateSelfACP', () => {
    it('should validate valid self acp', async () => {
      const acp = await createMockACP();
      acp.type = 'self';
      acp.issuerSignature = '0x1234567890abcdef';

      expect(() => validateSelfACP(acp)).not.toThrow();
    });

    it('should reject self acp with missing sealing pair', async () => {
      const acp = { ...(await createMockACP()), sealingPrivateKey: undefined };
      acp.type = 'self';
      expect(() => validateSelfACP(acp as unknown as ACP)).toThrow();
    });
  });

  describe('validateSharingACP', () => {
    it('should validate valid sharing acp', async () => {
      const acp = await createMockACP();
      acp.type = 'sharing';
      acp.issuerSignature = '0x1234567890abcdef';
      acp.recipient = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // Alice's address

      expect(() => validateSharingACP(acp)).not.toThrow();
    });

    it('should reject sharing acp with zero recipient', async () => {
      const acp = await createMockACP();
      acp.type = 'sharing';
      acp.issuerSignature = '0x1234567890abcdef';
      acp.recipient = '0x0000000000000000000000000000000000000000';

      expect(() => validateSharingACP(acp)).toThrow();
    });
  });

  describe('validateImportACP', () => {
    it('should validate valid import acp', async () => {
      const acp = await createMockACP();
      acp.type = 'recipient';
      acp.issuerSignature = '0x1234567890abcdef';
      acp.recipient = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // Alice's address
      acp.recipientSignature = '0xabcdef1234567890';

      expect(() => validateImportACP(acp)).not.toThrow();
    });

    it('should reject import acp with empty recipient signature', async () => {
      const acp = await createMockACP();
      acp.type = 'recipient';
      acp.issuerSignature = '0x1234567890abcdef';
      acp.recipient = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // Alice's address
      acp.recipientSignature = '0x';

      expect(() => validateImportACP(acp)).toThrow();
    });
  });

  describe('ValidationUtils', () => {
    describe('isExpired', () => {
      it('should return true for expired acp', async () => {
        const acp = {
          ...(await createMockACP()),
          expiration: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        };
        expect(ValidationUtils.isExpired(acp)).toBe(true);
      });

      it('should return false for non-expired acp', async () => {
        const acp = {
          ...(await createMockACP()),
          expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        };
        expect(ValidationUtils.isExpired(acp)).toBe(false);
      });
    });

    describe('isSigned', () => {
      it('should return true for signed self acp', async () => {
        const acp = {
          ...(await createMockACP()),
          type: 'self' as const,
          issuerSignature: '0x1234567890abcdef' as `0x${string}`,
        };
        expect(ValidationUtils.isSigned(acp)).toBe(true);
      });

      it('should return false for unsigned self acp', async () => {
        const acp = {
          ...(await createMockACP()),
          type: 'self' as const,
          issuerSignature: '0x' as `0x${string}`,
        };
        expect(ValidationUtils.isSigned(acp)).toBe(false);
      });

      it('should return true for signed recipient acp', async () => {
        const acp = {
          ...(await createMockACP()),
          type: 'recipient' as const,
          recipientSignature: '0x1234567890abcdef' as `0x${string}`,
        };
        expect(ValidationUtils.isSigned(acp)).toBe(true);
      });

      it('should return false for unsigned recipient acp', async () => {
        const acp = {
          ...(await createMockACP()),
          type: 'recipient' as const,
          recipientSignature: '0x' as `0x${string}`,
        };
        expect(ValidationUtils.isSigned(acp)).toBe(false);
      });
    });

    describe('isSignedAndNotExpired', () => {
      it('should return valid for valid acp', async () => {
        const acp = {
          ...(await createMockACP()),
          expiration: Math.floor(Date.now() / 1000) + 3600,
          issuerSignature: '0x1234567890abcdef' as `0x${string}`,
        };
        const result = ValidationUtils.isSignedAndNotExpired(acp);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });

      it('should return invalid for expired acp', async () => {
        const acp = {
          ...(await createMockACP()),
          expiration: Math.floor(Date.now() / 1000) - 3600,
          issuerSignature: '0x1234567890abcdef' as `0x${string}`,
        };
        const result = ValidationUtils.isSignedAndNotExpired(acp);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('expired');
      });

      it('should return invalid for unsigned acp', async () => {
        const acp = {
          ...(await createMockACP()),
          expiration: Math.floor(Date.now() / 1000) + 3600,
          issuerSignature: '0x' as `0x${string}`,
        };
        const result = ValidationUtils.isSignedAndNotExpired(acp);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('not-signed');
      });
    });

    describe('assertSignedAndNotExpired', () => {
      it('should not throw for valid acp', async () => {
        const acp = {
          ...(await createMockACP()),
          expiration: Math.floor(Date.now() / 1000) + 3600,
          issuerSignature: '0x1234567890abcdef' as `0x${string}`,
        };
        expect(() => ValidationUtils.assertSignedAndNotExpired(acp)).not.toThrow();
      });

      it('should throw for expired acp', async () => {
        const acp = {
          ...(await createMockACP()),
          expiration: Math.floor(Date.now() / 1000) - 3600,
          issuerSignature: '0x1234567890abcdef' as `0x${string}`,
        };
        expect(() => ValidationUtils.assertSignedAndNotExpired(acp)).toThrow('ACP is expired');
      });

      it('should throw for unsigned acp', async () => {
        const acp = {
          ...(await createMockACP()),
          expiration: Math.floor(Date.now() / 1000) + 3600,
          issuerSignature: '0x' as `0x${string}`,
        };
        expect(() => ValidationUtils.assertSignedAndNotExpired(acp)).toThrow('ACP is not signed');
      });
    });

    describe('isValid', () => {
      it('should return invalid-schema for schema-invalid acp', async () => {
        const acp = {
          ...(await createMockACP()),
          type: 'self' as const,
          expiration: Math.floor(Date.now() / 1000) + 3600,
          issuerSignature: '0x1234567890abcdef' as `0x${string}`,
          // Self acps must have recipient == zeroAddress per schema.
          recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as `0x${string}`,
        };

        const result = ValidationUtils.isValid(acp as unknown as ACP);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('invalid-schema');
      });

      it('should return expired for expired but otherwise schema-valid acp', async () => {
        const acp = {
          ...(await createMockACP()),
          type: 'self' as const,
          expiration: Math.floor(Date.now() / 1000) - 3600,
          issuerSignature: '0x1234567890abcdef' as `0x${string}`,
          recipient: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          recipientSignature: '0x' as `0x${string}`,
        };

        const result = ValidationUtils.isValid(acp as unknown as ACP);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('expired');
      });

      it('should return valid for schema-valid, signed, non-expired acp', async () => {
        const acp = {
          ...(await createMockACP()),
          type: 'self' as const,
          expiration: Math.floor(Date.now() / 1000) + 3600,
          issuerSignature: '0x1234567890abcdef' as `0x${string}`,
          recipient: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          recipientSignature: '0x' as `0x${string}`,
        };

        const result = ValidationUtils.isValid(acp as unknown as ACP);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });
    });
  });
});
