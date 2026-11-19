// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { CofheTest } from '../contracts/CofheTest.sol';
import { FHE, euint8 } from '@fhenixprotocol/cofhe-contracts/FHE.sol';
import { FunctionId, Utils } from '@fhenixprotocol/cofhe-contracts/ICofhe.sol';
import { InvalidOperationInputs } from '@cofhe/mock-contracts/contracts/MockTaskManager.sol';

/// @notice The mock task manager must reject plaintext extra inputs for every operation other than
///         trivialEncrypt and cast with `InvalidOperationInputs`, as the real TaskManager does.
contract MockExtraInputsTest is CofheTest {
  function setUp() public {
    deployMocks();
  }

  function _encryptedOne() internal returns (uint256) {
    euint8 value = FHE.asEuint8(1);
    FHE.allowThis(value);
    return uint256(euint8.unwrap(value));
  }

  function _oneExtraInput() internal pure returns (uint256[] memory extraInputs) {
    extraInputs = new uint256[](1);
    extraInputs[0] = 5;
  }

  function testBinaryOperationWithExtraInputReverts() public {
    uint256[] memory inputs = new uint256[](2);
    inputs[0] = _encryptedOne();
    inputs[1] = _encryptedOne();
    vm.expectRevert(abi.encodeWithSelector(InvalidOperationInputs.selector, 'add'));
    mockTaskManager.createTask(Utils.EUINT8_TFHE, FunctionId.add, inputs, _oneExtraInput());
  }

  function testUnaryOperationWithExtraInputReverts() public {
    uint256[] memory inputs = new uint256[](1);
    inputs[0] = _encryptedOne();
    vm.expectRevert(abi.encodeWithSelector(InvalidOperationInputs.selector, 'not'));
    mockTaskManager.createTask(Utils.EUINT8_TFHE, FunctionId.not, inputs, _oneExtraInput());
  }

  function testCastWithTargetTypeStillWorks() public {
    uint256[] memory inputs = new uint256[](1);
    inputs[0] = _encryptedOne();
    uint256[] memory extraInputs = new uint256[](1);
    extraInputs[0] = Utils.EUINT16_TFHE;
    mockTaskManager.createTask(Utils.EUINT16_TFHE, FunctionId.cast, inputs, extraInputs);
  }

  function testOperationWithoutExtraInputsStillWorks() public {
    uint256[] memory inputs = new uint256[](2);
    inputs[0] = _encryptedOne();
    inputs[1] = _encryptedOne();
    mockTaskManager.createTask(Utils.EUINT8_TFHE, FunctionId.add, inputs, new uint256[](0));
  }
}
