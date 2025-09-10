import {
  createPublicClient, createWalletClient, http, custom, type Chain
} from 'viem'
import { sepolia } from 'viem/chains'
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'

export async function HardhatSignerAdapter(
  signer: HardhatEthersSigner,
  { chain = sepolia, rpcUrl }: { chain?: Chain; rpcUrl?: string } = {}
) {
  // Get provider from signer
  const provider = signer.provider
  if (!provider) {
    throw new Error('Signer must have a provider')
  }

  // For Hardhat, we use the provider directly (it's already EIP-1193 compatible)
  const transport = rpcUrl 
    ? http(rpcUrl) 
    : custom({
        request: async ({ method, params }: { method: string; params?: unknown[] }) => {
          if ('request' in provider && typeof provider.request === 'function') {
            return await provider.request({ method, params })
          } else if ('send' in provider && typeof provider.send === 'function') {
            return await (provider as { send: (method: string, params?: unknown[]) => Promise<unknown> }).send(method, params || [])
          } else {
            throw new Error('Provider does not support EIP-1193 request method')
          }
        }
      })

  // Get account from signer for local signing
  const address = await signer.getAddress()
  const account = address as `0x${string}`

  const publicClient = createPublicClient({ chain, transport })
  const walletClient = createWalletClient({ chain, transport, account })

  return { publicClient, walletClient }
}
