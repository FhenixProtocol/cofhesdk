import type { PublicClient, WalletClient } from 'viem'

export interface AdapterResult {
	publicClient: PublicClient
	walletClient: WalletClient
}
