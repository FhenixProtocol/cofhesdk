import { Permit, SerializedPermit, GenerateSealingKey, PermitUtils } from '../src/index'

// Mock permit for testing - using Bob's address as issuer
export const createMockPermit = async (): Promise<Permit> => {
	const sealingPair = await GenerateSealingKey()
	const serializedPermit: SerializedPermit = {
		name: 'Test Permit',
		type: 'self',
		issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Bob's address
		expiration: 1000000000000,
		recipient: '0x0000000000000000000000000000000000000000',
		validatorId: 0,
		validatorContract: '0x0000000000000000000000000000000000000000',
		sealingPair: sealingPair.serialize(),
		issuerSignature: '0x',
		recipientSignature: '0x',
		_signedDomain: undefined,
	}
	return PermitUtils.deserialize(serializedPermit)
}
