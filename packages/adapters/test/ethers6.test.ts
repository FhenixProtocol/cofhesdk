import { describe, it, expect, beforeEach } from 'vitest'
import { sepolia } from 'viem/chains'
import { parseEther } from 'viem'
import { Ethers6Adapter } from '../src/ethers6'
import { createMockEIP1193Provider } from './test-utils'
import * as ethers6 from 'ethers6'

describe('Ethers6Adapter', () => {
  const testRpcUrl = 'https://ethereum-sepolia.rpc.subquery.network/public'
  const SEPOLIA_CHAIN_ID = 11155111
  let provider: ethers6.JsonRpcProvider
  let wallet: ethers6.Wallet

  beforeEach(() => {
    // Create common setup for all tests
    provider = new ethers6.JsonRpcProvider(testRpcUrl)
    wallet = new ethers6.Wallet('0x' + '1'.repeat(64), provider)
  })

  it('should work with real JsonRpcProvider and Wallet', async () => {
    
    const result = await Ethers6Adapter(wallet, { rpcUrl: testRpcUrl })
    
    expect(result).toHaveProperty('publicClient')
    expect(result).toHaveProperty('walletClient')
    expect(result.publicClient.chain).toEqual(sepolia)
    expect(result.walletClient.chain).toEqual(sepolia)
  })

  it('should work with BrowserProvider signer', async () => {
    const mockEthereum = createMockEIP1193Provider()
    const browserProvider = new ethers6.BrowserProvider(mockEthereum as any)
    // Create a wallet instead of getting signer from provider
    const wallet = new ethers6.Wallet('0x' + '1'.repeat(64), browserProvider)
    
    const result = await Ethers6Adapter(wallet, { rpcUrl: testRpcUrl })
    
    expect(result).toHaveProperty('publicClient')
    expect(result).toHaveProperty('walletClient')
  })

  it('should work with custom chain', async () => {
    const result = await Ethers6Adapter(wallet, { 
      chain: sepolia,
      rpcUrl: testRpcUrl 
    })
    
    expect(result).toHaveProperty('publicClient')
    expect(result).toHaveProperty('walletClient')
    expect(result.publicClient.chain).toEqual(sepolia)
    expect(result.walletClient.chain).toEqual(sepolia)
  })

  it('should throw error when signer has no provider', async () => {
    const signerWithoutProvider = { provider: null }
    
    await expect(async () => {
      await Ethers6Adapter(signerWithoutProvider as any)
    }).rejects.toThrow('No RPC URL or EIP-1193 provider')
  })

  it('should work with real network call', async () => {
    const result = await Ethers6Adapter(wallet, { rpcUrl: testRpcUrl })
    
    // Test real network call
    const chainId = await result.publicClient.getChainId()
    expect(typeof chainId).toBe('number')
    expect(chainId).toBeGreaterThan(0)
  }, 10000)

  describe('Provider Functions', () => {
    it('should support getChainId', async () => {
      const { publicClient } = await Ethers6Adapter(wallet, { rpcUrl: testRpcUrl })
      
      const chainId = await publicClient.getChainId()
      expect(typeof chainId).toBe('number')
      expect(chainId).toBe(SEPOLIA_CHAIN_ID) // sepolia
    }, 10000)

    it('should support call (contract read)', async () => {
      const { publicClient } = await Ethers6Adapter(wallet, { rpcUrl: testRpcUrl })
      
      // Test eth_call - get ETH balance of zero address
      const balance = await publicClient.getBalance({ 
        address: '0x0000000000000000000000000000000000000000' 
      })
      expect(typeof balance).toBe('bigint')
    }, 10000)

    it('should support request (raw RPC)', async () => {
      const { publicClient } = await Ethers6Adapter(wallet, { rpcUrl: testRpcUrl })
      
      // Test raw RPC request - viem requires both method and params
      const blockNumber = await publicClient.request({ 
        method: 'eth_blockNumber',
        params: []
      }) as string;
      expect(typeof blockNumber).toBe('string')
      expect(blockNumber.startsWith('0x')).toBe(true)
    }, 10000)
  })

  describe('Signer Functions', () => {
    it('should support getAddress', async () => {
      const { walletClient } = await Ethers6Adapter(wallet, { rpcUrl: testRpcUrl })
      
      const addresses = await walletClient.getAddresses()
      expect(Array.isArray(addresses)).toBe(true)
      // Note: For HTTP transport, this might return empty array
      // For EIP-1193 providers, it would return actual addresses
    }, 10000)

    it('should support signTypedData', async () => {
      const { walletClient } = await Ethers6Adapter(wallet)
      
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
      })
      
      expect(typeof signature).toBe('string')
      expect(signature.startsWith('0x')).toBe(true)
    }, 10000)

    it('should support sendTransaction', async () => {
      const { publicClient, walletClient } = await Ethers6Adapter(wallet, {
        chain: sepolia,
        rpcUrl: testRpcUrl, // pass it so both clients use the same HTTP RPC
      })
      
      // Try to send a transaction - this will fail with Infura but we'll catch the error
      try {
        console.log("estimating gas");
        const gas = await publicClient.estimateGas({
          account: wallet.address as `0x${string}`,
          to: '0x0000000000000000000000000000000000000000',
          value: parseEther("0"),
        });
      
        console.log("sending transaction", await wallet.getAddress());
        const hash = await walletClient.sendTransaction({
          to: '0x0000000000000000000000000000000000000000',
          value: parseEther("0"),
          gas,
        });
        console.log("transaction sent", hash);

        // If it succeeds (shouldn't with Infura), verify the format
        expect(typeof hash).toBe('string')
        expect(hash.startsWith('0x')).toBe(true)
        expect(hash.length).toBe(66)
      } catch (error: any) {
        // Expected errors: either insufficient funds (good!) or method not supported
        const isInsufficientFunds = error.message.includes('insufficient funds') || error.message.includes('balance')
        //const isMethodNotSupported = error.message.includes('method')
        
        expect(isInsufficientFunds/* || isMethodNotSupported*/).toBe(true)
        console.log('Expected error (insufficient funds or method not supported):', error.message)
      }
    }, 10000)
  })
})
