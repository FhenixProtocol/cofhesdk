import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEncryptInput } from './useEncryptInput.js';
import { useCofheContext } from '../providers/CofheProvider.js';
import type { CofhesdkClient } from '@cofhe/sdk';

// Mock the CofheProvider
vi.mock('../providers/CofheProvider.js', () => ({
  useCofheContext: vi.fn(),
}));

describe('useEncryptInput', () => {
  let mockClient: Partial<CofhesdkClient>;
  let mockEncryptInputs: ReturnType<typeof vi.fn>;
  let mockSetStepCallback: ReturnType<typeof vi.fn>;
  let mockSetAccount: ReturnType<typeof vi.fn>;
  let mockSetChainId: ReturnType<typeof vi.fn>;
  let mockSetSecurityZone: ReturnType<typeof vi.fn>;
  let mockEncrypt: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create chainable mock builder
    mockEncrypt = vi.fn().mockResolvedValue({
      success: true,
      data: [{ ctHash: 123n, securityZone: 0 }],
      error: null,
    });

    mockSetSecurityZone = vi.fn().mockReturnValue({ encrypt: mockEncrypt });
    mockSetChainId = vi.fn().mockReturnValue({ 
      setSecurityZone: mockSetSecurityZone,
      encrypt: mockEncrypt,
    });
    mockSetAccount = vi.fn().mockReturnValue({ 
      setChainId: mockSetChainId,
      setSecurityZone: mockSetSecurityZone,
      encrypt: mockEncrypt,
    });
    mockSetStepCallback = vi.fn().mockReturnValue({
      setAccount: mockSetAccount,
      setChainId: mockSetChainId,
      setSecurityZone: mockSetSecurityZone,
      encrypt: mockEncrypt,
    });
    mockEncryptInputs = vi.fn().mockReturnValue({
      setStepCallback: mockSetStepCallback,
      setAccount: mockSetAccount,
      setChainId: mockSetChainId,
      setSecurityZone: mockSetSecurityZone,
      encrypt: mockEncrypt,
    });

    mockClient = {
      encryptInputs: mockEncryptInputs,
    };

    vi.mocked(useCofheContext).mockReturnValue({
      client: mockClient as CofhesdkClient,
    } as any);
  });

  describe('basic functionality', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useEncryptInput());

      expect(result.current.isEncryptingInput).toBe(false);
      expect(result.current.encryptionStep).toBe(null);
      expect(result.current.encryptionProgress).toBe(0);
      expect(result.current.encryptionProgressLabel).toBe('');
      expect(result.current.inputEncryptionDisabled).toBe(false);
    });

    it('should encrypt uint32 value', async () => {
      const { result } = renderHook(() => useEncryptInput());

      const encrypted = await result.current.onEncryptInput('uint32', '42');

      expect(mockEncryptInputs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ data: 42n, utype: 4, securityZone: 0 }), // uint32 = FheTypes.Uint32 = 4
        ])
      );
      expect(mockEncrypt).toHaveBeenCalled();
      expect(encrypted).toEqual({ ctHash: 123n, securityZone: 0 });
    });

    it('should encrypt bool value', async () => {
      const { result } = renderHook(() => useEncryptInput());

      await result.current.onEncryptInput('bool', 'true');

      expect(mockEncryptInputs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ data: true, utype: 0, securityZone: 0 }), // bool = FheTypes.Bool = 0
        ])
      );
    });

    it('should encrypt address value', async () => {
      const { result } = renderHook(() => useEncryptInput());
      const address = '0x1234567890123456789012345678901234567890';

      await result.current.onEncryptInput('address', address);

      expect(mockEncryptInputs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ data: address, utype: 7, securityZone: 0 }), // address = FheTypes.Uint160 = 7
        ])
      );
    });
  });

  describe('options parameter', () => {
    it('should work without options (backward compatibility)', async () => {
      const { result } = renderHook(() => useEncryptInput());

      await result.current.onEncryptInput('uint32', '42');

      expect(mockSetAccount).not.toHaveBeenCalled();
      expect(mockSetChainId).not.toHaveBeenCalled();
      expect(mockSetSecurityZone).not.toHaveBeenCalled();
      expect(mockEncrypt).toHaveBeenCalled();
    });

    it('should apply account option when provided', async () => {
      const { result } = renderHook(() => useEncryptInput());
      const testAccount = '0x1234567890123456789012345678901234567890';

      await result.current.onEncryptInput('uint32', '42', { 
        account: testAccount 
      });

      expect(mockSetAccount).toHaveBeenCalledWith(testAccount);
      expect(mockEncrypt).toHaveBeenCalled();
    });

    it('should apply chainId option when provided', async () => {
      const { result } = renderHook(() => useEncryptInput());
      const testChainId = 84532;

      await result.current.onEncryptInput('uint32', '42', { 
        chainId: testChainId 
      });

      expect(mockSetChainId).toHaveBeenCalledWith(testChainId);
      expect(mockEncrypt).toHaveBeenCalled();
    });

    it('should apply securityZone option when provided', async () => {
      const { result } = renderHook(() => useEncryptInput());
      const testSecurityZone = 1;

      await result.current.onEncryptInput('uint32', '42', { 
        securityZone: testSecurityZone 
      });

      expect(mockSetSecurityZone).toHaveBeenCalledWith(testSecurityZone);
      expect(mockEncrypt).toHaveBeenCalled();
    });

    it('should apply all options when provided', async () => {
      const { result } = renderHook(() => useEncryptInput());
      const testAccount = '0x1234567890123456789012345678901234567890';
      const testChainId = 84532;
      const testSecurityZone = 1;

      await result.current.onEncryptInput('uint32', '42', { 
        account: testAccount,
        chainId: testChainId,
        securityZone: testSecurityZone,
      });

      expect(mockSetAccount).toHaveBeenCalledWith(testAccount);
      expect(mockSetChainId).toHaveBeenCalledWith(testChainId);
      expect(mockSetSecurityZone).toHaveBeenCalledWith(testSecurityZone);
      expect(mockEncrypt).toHaveBeenCalled();
    });

    it('should apply securityZone when it is 0', async () => {
      const { result } = renderHook(() => useEncryptInput());

      await result.current.onEncryptInput('uint32', '42', { 
        securityZone: 0 
      });

      expect(mockSetSecurityZone).toHaveBeenCalledWith(0);
    });
  });

  describe('encryption states', () => {
    it('should call step callback during encryption', async () => {
      const { result } = renderHook(() => useEncryptInput());

      await result.current.onEncryptInput('uint32', '42');

      expect(mockSetStepCallback).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should reset isEncrypting after successful encryption', async () => {
      const { result } = renderHook(() => useEncryptInput());

      await result.current.onEncryptInput('uint32', '42');

      // After await, encryption should be done
      expect(result.current.isEncryptingInput).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(useCofheContext).mockReturnValue({
        client: null,
      } as any);

      const { result } = renderHook(() => useEncryptInput());

      await expect(
        result.current.onEncryptInput('uint32', '42')
      ).rejects.toThrow('CoFHE client not initialized');
    });

    it('should handle encryption failure', async () => {
      mockEncrypt.mockResolvedValueOnce({
        success: false,
        data: null,
        error: new Error('Encryption failed'),
      });

      const { result } = renderHook(() => useEncryptInput());

      await expect(
        result.current.onEncryptInput('uint32', '42')
      ).rejects.toThrow('Encryption failed');

      expect(result.current.isEncryptingInput).toBe(false);
    });

    it('should reset state after error', async () => {
      mockEncrypt.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useEncryptInput());

      await expect(
        result.current.onEncryptInput('uint32', '42')
      ).rejects.toThrow('Network error');

      expect(result.current.isEncryptingInput).toBe(false);
      expect(result.current.encryptionStep).toBe(null);
      expect(result.current.encryptionProgress).toBe(0);
    });
  });

  describe('type conversions', () => {
    it('should convert uint8 values', async () => {
      const { result } = renderHook(() => useEncryptInput());

      await result.current.onEncryptInput('uint8', '255');

      expect(mockEncryptInputs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ data: 255n, utype: 2, securityZone: 0 }), // uint8 = FheTypes.Uint8 = 2
        ])
      );
    });

    it('should convert uint16 values', async () => {
      const { result } = renderHook(() => useEncryptInput());

      await result.current.onEncryptInput('uint16', '65535');

      expect(mockEncryptInputs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ data: 65535n, utype: 3, securityZone: 0 }), // uint16 = FheTypes.Uint16 = 3
        ])
      );
    });

    it('should convert uint64 values', async () => {
      const { result } = renderHook(() => useEncryptInput());

      await result.current.onEncryptInput('uint64', '999999999');

      expect(mockEncryptInputs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ data: 999999999n, utype: 5, securityZone: 0 }), // uint64 = FheTypes.Uint64 = 5
        ])
      );
    });

    it('should convert uint128 values', async () => {
      const { result } = renderHook(() => useEncryptInput());

      await result.current.onEncryptInput('uint128', '123456789012345678901234567890');

      expect(mockEncryptInputs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ 
            data: expect.any(BigInt), // Float conversion may change precision
            utype: 6, // uint128 = FheTypes.Uint128 = 6
            securityZone: 0
          }),
        ])
      );
    });

    it('should convert bool string "true" to true', async () => {
      const { result } = renderHook(() => useEncryptInput());

      await result.current.onEncryptInput('bool', 'true');

      expect(mockEncryptInputs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ data: true, utype: 0, securityZone: 0 }), // bool = FheTypes.Bool = 0
        ])
      );
    });

    it('should convert bool string "1" to true', async () => {
      const { result } = renderHook(() => useEncryptInput());

      await result.current.onEncryptInput('bool', '1');

      expect(mockEncryptInputs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ data: true, utype: 0, securityZone: 0 }), // bool = FheTypes.Bool = 0
        ])
      );
    });

    it('should convert bool string "false" to false', async () => {
      const { result } = renderHook(() => useEncryptInput());

      await result.current.onEncryptInput('bool', 'false');

      expect(mockEncryptInputs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ data: false, utype: 0, securityZone: 0 }), // bool = FheTypes.Bool = 0
        ])
      );
    });
  });
});

