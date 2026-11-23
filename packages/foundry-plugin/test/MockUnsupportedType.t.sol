// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { CofheTest } from '../contracts/CofheTest.sol';
import { FHE, Impl, euint8 } from '@fhenixprotocol/cofhe-contracts/FHE.sol';
import { FunctionId, Utils } from '@fhenixprotocol/cofhe-contracts/ICofhe.sol';
import { UnsupportedType, DecryptFunctionNotSupported } from '@cofhe/mock-contracts/contracts/MockTaskManager.sol';

/// @notice The mock task manager must reject the types the real TaskManager rejects with `UnsupportedType`,
///         instead of returning a handle that only works locally.
contract MockUnsupportedTypeTest is CofheTest {
  function setUp() public {
    deployMocks();
  }

  function trivialEncrypt(uint8 toType) external returns (bytes32) {
    return Impl.trivialEncrypt(1, toType, 0);
  }

  function cast(bytes32 key, uint8 toType) external returns (bytes32) {
    return Impl.cast(key, toType);
  }

  function random(uint8 uintType) external returns (bytes32) {
    return Impl.random(uintType);
  }

  function _encryptedOne() internal returns (euint8 value) {
    value = FHE.asEuint8(1);
    FHE.allowThis(value);
  }

  function _expectUnsupported(uint256 t) internal {
    vm.expectRevert(abi.encodeWithSelector(UnsupportedType.selector, t));
  }

  function testTrivialEncryptToEuint256Reverts() public {
    _expectUnsupported(Utils.EUINT256_TFHE);
    this.trivialEncrypt(Utils.EUINT256_TFHE);
  }

  function testCastToEuint256Reverts() public {
    euint8 value = _encryptedOne();
    _expectUnsupported(Utils.EUINT256_TFHE);
    this.cast(euint8.unwrap(value), Utils.EUINT256_TFHE);
  }

  function testRandomEuint256Reverts() public {
    _expectUnsupported(Utils.EUINT256_TFHE);
    this.random(Utils.EUINT256_TFHE);
  }

  function testTrivialEncryptUnknownTargetTypeReverts() public {
    uint256[] memory extraInputs = new uint256[](3);
    extraInputs[0] = 1;
    extraInputs[1] = 9;
    _expectUnsupported(9);
    mockTaskManager.createTask(Utils.EUINT8_TFHE, FunctionId.trivialEncrypt, new uint256[](0), extraInputs);
  }

  function testTrivialEncryptTargetTypeAboveUint8RevertsBeforeTheZoneCheck() public {
    uint256[] memory extraInputs = new uint256[](3);
    extraInputs[0] = 1;
    extraInputs[1] = 256 + Utils.EUINT8_TFHE;
    // deployMocks() sets the zone range to [0, 1]; the TaskManager checks the type first
    extraInputs[2] = 2;
    _expectUnsupported(256 + Utils.EUINT8_TFHE);
    mockTaskManager.createTask(Utils.EUINT8_TFHE, FunctionId.trivialEncrypt, new uint256[](0), extraInputs);
  }

  function testCastUnknownTargetTypeReverts() public {
    uint256[] memory inputs = new uint256[](1);
    inputs[0] = uint256(euint8.unwrap(_encryptedOne()));
    uint256[] memory extraInputs = new uint256[](1);
    extraInputs[0] = Utils.EUINT256_TFHE;
    _expectUnsupported(Utils.EUINT256_TFHE);
    mockTaskManager.createTask(Utils.EUINT16_TFHE, FunctionId.cast, inputs, extraInputs);
  }

  function testCreateTaskUnsupportedReturnTypeReverts() public {
    uint256[] memory inputs = new uint256[](2);
    inputs[0] = uint256(euint8.unwrap(_encryptedOne()));
    inputs[1] = uint256(euint8.unwrap(_encryptedOne()));
    _expectUnsupported(Utils.EUINT256_TFHE);
    mockTaskManager.createTask(Utils.EUINT256_TFHE, FunctionId.add, inputs, new uint256[](0));
  }

  function testCreateTaskDecryptReverts() public {
    vm.expectRevert(DecryptFunctionNotSupported.selector);
    mockTaskManager.createTask(Utils.EUINT8_TFHE, FunctionId.decrypt, new uint256[](0), new uint256[](0));
  }

  function testSupportedTypesStillWork() public {
    uint8[7] memory types = [
      Utils.EBOOL_TFHE,
      Utils.EUINT8_TFHE,
      Utils.EUINT16_TFHE,
      Utils.EUINT32_TFHE,
      Utils.EUINT64_TFHE,
      Utils.EUINT128_TFHE,
      Utils.EADDRESS_TFHE
    ];
    euint8 value = _encryptedOne();
    for (uint256 i = 0; i < types.length; i++) {
      this.trivialEncrypt(types[i]);
      this.cast(euint8.unwrap(value), types[i]);
      this.random(types[i]);
    }
  }
}
