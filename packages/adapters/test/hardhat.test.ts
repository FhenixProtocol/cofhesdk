import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { hardhat } from 'viem/chains'
import { parseEther } from 'viem'
import { HardhatSignerAdapter } from '../src/hardhat'
import * as ethers6 from 'ethers6'
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { hardhatNode } from './hardhat-node'

describe('HardhatSignerAdapter', () => {
  const testRpcUrl = 'http://127.0.0.1:8545' // Default Hardhat node URL
  const HARDHAT_CHAIN_ID = 31337 // Hardhat local network
  let provider: ethers6.JsonRpcProvider
  let wallet: ethers6.Wallet
  let hardhatSigner: HardhatEthersSigner

  beforeAll(async () => {
    // Start Hardhat node before running tests
    await hardhatNode.start()
  }, 60000) // 60 second timeout for node startup

  afterAll(async () => {
    // Immediate cleanup - no waiting
    console.log('Starting cleanup...')
    if ((hardhatNode as any).process) {
      try {
        (hardhatNode as any).process.kill('SIGKILL')
        ;(hardhatNode as any).process = null
        ;(hardhatNode as any).isReady = false
      } catch (e) {
        console.log('Kill error:', e)
      }
    }
    
    // Force port cleanup
    try {
      const { spawn } = await import('child_process')
      const killCmd = spawn('sh', ['-c', 'lsof -ti :8545 | xargs -r kill -9'], { stdio: 'ignore' })
      setTimeout(() => killCmd.kill('SIGKILL'), 1000) // Kill the kill command after 1s
    } catch (e) {
      console.log('Port cleanup error:', e)
    }
    
    console.log('Cleanup done')
  }, 3000) // 3 second timeout

  beforeEach(() => {
    // Create real Hardhat setup - using Hardhat's default account private key
    provider = new ethers6.JsonRpcProvider(testRpcUrl)
    // Use Hardhat's first default account private key
    wallet = new ethers6.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider)
    
    // For testing, we cast the wallet as HardhatEthersSigner since they're compatible for our purposes
    hardhatSigner = wallet as unknown as HardhatEthersSigner
  })

  it('should work with Hardhat signer', async () => {
    const result = await HardhatSignerAdapter(hardhatSigner, { chain: hardhat, rpcUrl: testRpcUrl })
    
    expect(result).toHaveProperty('publicClient')
    expect(result).toHaveProperty('walletClient')
    expect(result.publicClient.chain).toEqual(hardhat)
    expect(result.walletClient.chain).toEqual(hardhat)
  })

  it('should work with custom chain', async () => {
    const result = await HardhatSignerAdapter(hardhatSigner, { 
      chain: hardhat,
      rpcUrl: testRpcUrl 
    })
    
    expect(result).toHaveProperty('publicClient')
    expect(result).toHaveProperty('walletClient')
    expect(result.publicClient.chain).toEqual(hardhat)
    expect(result.walletClient.chain).toEqual(hardhat)
  })

  it('should throw error when signer has no provider', async () => {
    const signerWithoutProvider = { provider: null }
    
    await expect(async () => {
      await HardhatSignerAdapter(signerWithoutProvider as any)
    }).rejects.toThrow('Signer must have a provider')
  })

  describe('Provider Functions', () => {
    it('should support getChainId', async () => {
      const { publicClient } = await HardhatSignerAdapter(hardhatSigner, { chain: hardhat, rpcUrl: testRpcUrl })
      
      const chainId = await publicClient.getChainId()
      expect(typeof chainId).toBe('number')
      expect(chainId).toBe(HARDHAT_CHAIN_ID) // Hardhat local network
    })

    it('should support call (contract read)', async () => {
      const { publicClient } = await HardhatSignerAdapter(hardhatSigner, { chain: hardhat, rpcUrl: testRpcUrl })
      
      // Test eth_call via getBalance
      const balance = await publicClient.getBalance({ 
        address: '0x0000000000000000000000000000000000000000' 
      })
      expect(typeof balance).toBe('bigint')
    })

    it('should support request (raw RPC)', async () => {
      const { publicClient } = await HardhatSignerAdapter(hardhatSigner, { chain: hardhat, rpcUrl: testRpcUrl })
      
      // Test raw RPC request
      const blockNumber = await publicClient.request({ 
        method: 'eth_blockNumber',
        params: []
      }) as string
      expect(typeof blockNumber).toBe('string')
      expect(blockNumber.startsWith('0x')).toBe(true)
    })
  })

  describe('Signer Functions', () => {
    it('should support getAddress', async () => {
      const { walletClient } = await HardhatSignerAdapter(hardhatSigner, { chain: hardhat, rpcUrl: testRpcUrl })
      
      const addresses = await walletClient.getAddresses()
      expect(Array.isArray(addresses)).toBe(true)
    })

    it('should support signTypedData', async () => {
      const { walletClient } = await HardhatSignerAdapter(hardhatSigner, { chain: hardhat, rpcUrl: testRpcUrl })
      
      const domain = {
        name: 'Test',
        version: '1',
        chainId: HARDHAT_CHAIN_ID,
        verifyingContract: '0x0000000000000000000000000000000000000000' as const,
      }
      
      const types = {
        Message: [{ name: 'content', type: 'string' }],
      }
      
      const message = { content: 'Hello World' }
      
      const signature = await walletClient.signTypedData({
        account: wallet.address as `0x${string}`,
        domain,
        types,
        primaryType: 'Message',
        message,
      })
      
      expect(typeof signature).toBe('string')
      expect(signature.startsWith('0x')).toBe(true)
    })

    it('should support sendTransaction', async () => {
      const { walletClient } = await HardhatSignerAdapter(hardhatSigner, { chain: hardhat, rpcUrl: testRpcUrl })
      
      const hash = await walletClient.sendTransaction({
        account: wallet.address as `0x${string}`,
        to: '0x0000000000000000000000000000000000000000' as `0x${string}`,
        value: parseEther("0"),
      })
      
      // Should succeed with Hardhat local network (has funds)
      expect(typeof hash).toBe('string')
      expect(hash.startsWith('0x')).toBe(true)
      expect(hash.length).toBe(66)
    })
  })
})