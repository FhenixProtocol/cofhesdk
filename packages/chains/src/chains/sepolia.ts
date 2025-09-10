import { defineChain } from '../defineChain.js'

/**
 * Sepolia testnet chain configuration
 */
export const sepolia = defineChain({
	id: 11155111,
	name: 'Sepolia',
	network: 'sepolia',
	coFheUrl: 'https://testnet-cofhe.fhenix.zone',
	verifierUrl: 'https://testnet-cofhe-vrf.fhenix.zone',
	thresholdNetworkUrl: 'https://testnet-cofhe-tn.fhenix.zone',
	environment: 'TESTNET',
})
