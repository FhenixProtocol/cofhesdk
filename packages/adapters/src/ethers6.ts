import {
    createPublicClient, createWalletClient, http, custom, type Chain
  } from 'viem'
  import { privateKeyToAccount, toAccount } from 'viem/accounts'
  import { sepolia } from 'viem/chains'
  import type { Wallet, AbstractSigner } from 'ethers6'
  
  type Ethers6Signer = AbstractSigner | Wallet
  
  export async function Ethers6Adapter(
    signer: Ethers6Signer,
    { chain = sepolia, rpcUrl }: { chain?: Chain; rpcUrl?: string } = {}
  ) {
    // detect provider & transport
    // @ts-ignore – ethers v6 providers have .send
    const provider: any = (signer as any).provider
    const transport = rpcUrl
      ? http(rpcUrl)
      : provider && typeof provider.send === 'function'
        ? custom({ request: ({ method, params }: any) => provider.send(method, params ?? []) })
        : (() => { throw new Error('No RPC URL or EIP-1193 provider') })()
  
    // build a viem Account
    const address = (await signer.getAddress()) as `0x${string}`
    let account:
      | ReturnType<typeof privateKeyToAccount>
      | ReturnType<typeof toAccount>
      | `0x${string}`
  
    if ('privateKey' in signer && typeof (signer as Wallet).privateKey === 'string') {
      // Local (true offline) signing → works with Infura via sendRawTransaction
      account = privateKeyToAccount((signer as Wallet).privateKey as `0x${string}`)  // local account
    } else if (provider && typeof provider.send === 'function') {
      // Injected wallet (MetaMask/Coinbase) → wallet signs via eth_sendTransaction
      account = address // JSON-RPC account (not local signing)
    } else {
      throw new Error('Signer does not expose a private key and no injected wallet is available.')
    }
  
    const publicClient = createPublicClient({ chain, transport })
    const walletClient = createWalletClient({ chain, transport, account })
  
    return { publicClient, walletClient }
  }
  