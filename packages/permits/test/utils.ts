import { Permit, SerializedPermit, GenerateSealingKey, PermitUtils } from '../src/index'

// Mock permit for testing
export const createMockPermit = async (): Promise<Permit> => {
	const sealingPair = await GenerateSealingKey()
	const serializedPermit: SerializedPermit = {
		name: 'Test Permit',
		type: 'self',
		issuer: '0x1234567890123456789012345678901234567890',
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
