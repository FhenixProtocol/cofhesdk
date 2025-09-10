import { defineChain } from '../defineChain.js'

/**
 * Arbitrum Sepolia testnet chain configuration
 */
export const arbSepolia = defineChain({
	id: 421614,
	name: 'Arbitrum Sepolia',
	network: 'arb-sepolia',
	coFheUrl: 'https://testnet-cofhe.fhenix.zone',
	verifierUrl: 'https://testnet-cofhe-vrf.fhenix.zone',
	thresholdNetworkUrl: 'https://testnet-cofhe-tn.fhenix.zone',
	environment: 'TESTNET',
})
