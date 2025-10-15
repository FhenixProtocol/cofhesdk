import { describe, it, expect } from 'vitest'
import * as adapters from './index.js'

describe('Index Exports', () => {
  it('should export main adapter functions', () => {
    expect(typeof adapters.Ethers5Adapter).toBe('function')
    expect(typeof adapters.Ethers6Adapter).toBe('function')
    expect(typeof adapters.WagmiAdapter).toBe('function')
    expect(typeof adapters.HardhatSignerAdapter).toBe('function')
  })

  it('should have the expected simple adapters', () => {
    const expectedAdapters = [
      'Ethers5Adapter',
      'Ethers6Adapter', 
      'WagmiAdapter',
      'HardhatSignerAdapter'
    ]

    expectedAdapters.forEach(adapterName => {
      expect(adapters).toHaveProperty(adapterName)
      expect(typeof (adapters as any)[adapterName]).toBe('function')
    })
  })
})
