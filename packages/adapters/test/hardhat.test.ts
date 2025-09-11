import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { parseEther } from 'viem'
import { hardhat } from 'viem/chains'
import { HardhatSignerAdapter } from '../src/hardhat'
import hre from 'hardhat'
import '@nomicfoundation/hardhat-ethers'
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { hardhatNode } from './hardhat-node'

describe('HardhatSignerAdapter', () => {
  const HARDHAT_CHAIN_ID = 31337 // Hardhat local network
  let signer: HardhatEthersSigner

  beforeAll(async () => {
    // Start Hardhat node before running tests
    // await hardhatNode.start()
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

  beforeEach(async () => {
    // Use real Hardhat runtime environment
    const [firstSigner] = await hre.ethers.getSigners()
    signer = firstSigner
  })

  it('should work with Hardhat signer', async () => {
    const result = await HardhatSignerAdapter(signer)
    
    expect(result).toHaveProperty('publicClient')
    expect(result).toHaveProperty('walletClient')
    expect(result.publicClient).toBeDefined()
    expect(result.walletClient).toBeDefined()
  })

  it('should work without configuration', async () => {
    const result = await HardhatSignerAdapter(signer)
    
    expect(result).toHaveProperty('publicClient')
    expect(result).toHaveProperty('walletClient')
    expect(result.publicClient).toBeDefined()
    expect(result.walletClient).toBeDefined()
  })

  it('should throw error when signer has no provider', async () => {
    const signerWithoutProvider = { provider: null }
    
    await expect(async () => {
      await HardhatSignerAdapter(signerWithoutProvider as any)
    }).rejects.toThrow('Signer must have a provider')
  })

  describe('Provider Functions', () => {
    it('should support getChainId', async () => {
      const { publicClient } = await HardhatSignerAdapter(signer)
      
      const chainId = await publicClient.getChainId()
      expect(typeof chainId).toBe('number')
      expect(chainId).toBe(HARDHAT_CHAIN_ID) // Hardhat local network
    })

    it('should support call (contract read)', async () => {
      const { publicClient } = await HardhatSignerAdapter(signer)
      
      // Test eth_call via getBalance
      const balance = await publicClient.getBalance({ 
        address: '0x0000000000000000000000000000000000000000' 
      })
      expect(typeof balance).toBe('bigint')
    })

    it('should support request (raw RPC)', async () => {
      const { publicClient } = await HardhatSignerAdapter(signer)
      
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
      const { walletClient } = await HardhatSignerAdapter(signer)
      
      const addresses = await walletClient.getAddresses()
      expect(Array.isArray(addresses)).toBe(true)
    })

    it('should support signTypedData', async () => {
      const { walletClient } = await HardhatSignerAdapter(signer)
      
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
        account: await signer.getAddress() as `0x${string}`,
        domain,
        types,
        primaryType: 'Message',
        message,
      })
      
      expect(typeof signature).toBe('string')
      expect(signature.startsWith('0x')).toBe(true)
    })

    it('should support sendTransaction', async () => {
      const { walletClient } = await HardhatSignerAdapter(signer)
      
      const hash = await walletClient.sendTransaction({
        account: await signer.getAddress() as `0x${string}`,
        to: '0x0000000000000000000000000000000000000000' as `0x${string}`,
        value: parseEther("0"),
        chain: hardhat, // Provide chain directly in the call
      })
      
      // Should succeed with Hardhat local network (has funds)
      expect(typeof hash).toBe('string')
      expect(hash.startsWith('0x')).toBe(true)
      expect(hash.length).toBe(66)
    })
  })
})