import { vi } from 'vitest'
import type { EIP1193Provider } from 'viem'

/**
 * Mock EIP-1193 provider for testing
 */
export function createMockEIP1193Provider(): EIP1193Provider {
  const mockProvider = {
    request: vi.fn().mockImplementation(async ({ method, params }) => {
      switch (method) {
        case 'eth_chainId':
          return '0x2aa36a7' // Sepolia chainId
        case 'eth_accounts':
          return ['0x742d35Cc6634C0532925a3b8D0Ea4E686C9b8A']
        case 'eth_getBalance':
          return '0x1bc16d674ec80000' // 2 ETH
        case 'eth_blockNumber':
          return '0x12345'
        case 'eth_gasPrice':
          return '0x9184e72a000' // 10 gwei
        case 'personal_sign':
        case 'eth_sign':
          return '0x' + 'a'.repeat(130) // Mock signature
        case 'eth_signTypedData_v4':
          return '0x' + 'a'.repeat(130) // Mock typed data signature
        case 'eth_sendTransaction':
          return '0x' + 'b'.repeat(64) // Mock transaction hash
        default:
          throw new Error(`Unsupported method: ${method}`)
      }
    }),
    on: vi.fn(),
    removeListener: vi.fn(),
    // Add additional EIP-1193 properties
    send: vi.fn(),
    sendAsync: vi.fn(),
    isMetaMask: false,
    isConnected: vi.fn().mockReturnValue(true),
  }

  // Add bind method that viem expects and bind all methods
  const boundProvider = {
    ...mockProvider,
    request: mockProvider.request.bind(mockProvider),
    on: mockProvider.on.bind(mockProvider),
    removeListener: mockProvider.removeListener.bind(mockProvider),
    bind: function() { return this },
  }

  return boundProvider as any
}

/**
 * Mock Ethers v5 provider
 */
export function createMockEthers5Provider() {
  const mockProvider = {
    provider: createMockEIP1193Provider(),
    send: vi.fn(),
    getNetwork: vi.fn().mockResolvedValue({ chainId: 1, name: 'homestead' }),
    getBalance: vi.fn().mockResolvedValue('2000000000000000000'),
    getBlockNumber: vi.fn().mockResolvedValue(12345),
    connection: { url: 'https://mainnet.infura.io/v3/test' },
  }
  return mockProvider
}

/**
 * Mock Ethers v5 signer
 */
export function createMockEthers5Signer() {
  return {
    provider: createMockEthers5Provider(),
    getAddress: vi.fn().mockResolvedValue('0x742d35Cc6634C0532925a3b8D0Ea4E686C9b8A'),
    signMessage: vi.fn().mockResolvedValue('0x' + 'a'.repeat(130)),
    sendTransaction: vi.fn().mockResolvedValue({
      hash: '0x' + 'b'.repeat(64),
      wait: vi.fn().mockResolvedValue({ status: 1 }),
    }),
  }
}

/**
 * Mock Ethers v6 provider
 */
export function createMockEthers6Provider() {
  const mockProvider = {
    provider: createMockEIP1193Provider(),
    send: vi.fn(),
    getNetwork: vi.fn().mockResolvedValue({ chainId: 1n, name: 'homestead' }),
    getBalance: vi.fn().mockResolvedValue(2000000000000000000n),
    getBlockNumber: vi.fn().mockResolvedValue(12345),
    _getConnection: vi.fn().mockReturnValue({ url: 'https://mainnet.infura.io/v3/test' }),
  }
  return mockProvider
}

/**
 * Mock Ethers v6 signer
 */
export function createMockEthers6Signer() {
  return {
    provider: createMockEthers6Provider(),
    getAddress: vi.fn().mockResolvedValue('0x742d35Cc6634C0532925a3b8D0Ea4E686C9b8A'),
    signMessage: vi.fn().mockResolvedValue('0x' + 'a'.repeat(130)),
    sendTransaction: vi.fn().mockResolvedValue({
      hash: '0x' + 'b'.repeat(64),
      wait: vi.fn().mockResolvedValue({ status: 1 }),
    }),
  }
}

/**
 * Mock Hardhat signer
 */
export function createMockHardhatSigner() {
  return {
    provider: {
      send: vi.fn(),
      request: createMockEIP1193Provider().request,
      on: vi.fn(),
      removeListener: vi.fn(),
    },
    getAddress: vi.fn().mockResolvedValue('0x742d35Cc6634C0532925a3b8D0Ea4E686C9b8A'),
    signMessage: vi.fn().mockResolvedValue('0x' + 'a'.repeat(130)),
    sendTransaction: vi.fn().mockResolvedValue({
      hash: '0x' + 'b'.repeat(64),
      wait: vi.fn().mockResolvedValue({ status: 1 }),
    }),
  }
}

/**
 * Mock Wagmi clients
 */
export function createMockWagmiClients() {
  const publicClient = {
    chain: { id: 1, name: 'Ethereum' },
    transport: { type: 'http', url: 'https://mainnet.infura.io/v3/test' },
    getChainId: vi.fn().mockResolvedValue(1),
    getBlockNumber: vi.fn().mockResolvedValue(12345n),
    getBalance: vi.fn().mockResolvedValue(2000000000000000000n),
    request: createMockEIP1193Provider().request,
  }

  const walletClient = {
    chain: { id: 1, name: 'Ethereum' },
    transport: { type: 'custom' },
    account: {
      address: '0x742d35Cc6634C0532925a3b8D0Ea4E686C9b8A',
      type: 'json-rpc',
    },
    getAddresses: vi.fn().mockResolvedValue(['0x742d35Cc6634C0532925a3b8D0Ea4E686C9b8A']),
    signMessage: vi.fn().mockResolvedValue('0x' + 'a'.repeat(130)),
    sendTransaction: vi.fn().mockResolvedValue('0x' + 'b'.repeat(64)),
    request: createMockEIP1193Provider().request,
  }

  return { publicClient, walletClient }
}
