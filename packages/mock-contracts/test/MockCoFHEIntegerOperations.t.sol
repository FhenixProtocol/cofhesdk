// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity >=0.8.25 <0.9.0;

import { Test } from 'forge-std/Test.sol';
import { FunctionId, Utils } from '@fhenixprotocol/cofhe-contracts/ICofhe.sol';
import { MockCoFHE } from '../contracts/MockCoFHE.sol';

contract MockCoFHEHarness is MockCoFHE {
  function setValue(uint256 ctHash, uint256 value) external {
    _set(ctHash, value);
  }

  function runNot(uint256 output, uint256 input) external {
    MOCK_unaryOperation(output, Utils.functionIdToString(FunctionId.not), input);
  }

  function runRol(uint256 output, uint256 lhs, uint256 rhs) external {
    MOCK_twoInputOperation(output, Utils.functionIdToString(FunctionId.rol), lhs, rhs);
  }

  function runRor(uint256 output, uint256 lhs, uint256 rhs) external {
    MOCK_twoInputOperation(output, Utils.functionIdToString(FunctionId.ror), lhs, rhs);
  }
}

contract MockCoFHEIntegerOperationsTest is Test {
  MockCoFHEHarness private mock;
  uint256 private nonce;

  function setUp() public {
    mock = new MockCoFHEHarness();
    mock.setLogOps(false);
  }

  function testNotPreservesBooleanSemantics() public {
    uint256 input = _handle(Utils.EBOOL_TFHE);
    uint256 output = _handle(Utils.EBOOL_TFHE);

    mock.setValue(input, 1);
    mock.runNot(output, input);
    assertEq(mock.mockStorage(output), 0);

    input = _handle(Utils.EBOOL_TFHE);
    output = _handle(Utils.EBOOL_TFHE);
    mock.setValue(input, 0);
    mock.runNot(output, input);
    assertEq(mock.mockStorage(output), 1);
  }

  function testNotUsesIntegerWidth() public {
    for (uint256 i = 0; i < 6; i++) {
      (uint8 utype, uint256 bits) = _integerType(i);
      uint256 input = _handle(utype);
      uint256 output = _handle(utype);
      uint256 mask = bits == 256 ? type(uint256).max : (uint256(1) << bits) - 1;

      mock.setValue(input, 2);
      mock.runNot(output, input);

      assertEq(mock.mockStorage(output), mask ^ 2, string.concat('not width ', vm.toString(bits)));
    }
  }

  function testRotateLeftWrapsAndNormalizesCount() public {
    for (uint256 i = 0; i < 6; i++) {
      (uint8 utype, uint256 bits) = _integerType(i);
      uint256 highAndLowBits = (uint256(1) << (bits - 1)) | 1;

      assertEq(_rol(utype, highAndLowBits, 0), highAndLowBits);
      assertEq(_rol(utype, highAndLowBits, bits), highAndLowBits);
      assertEq(_rol(utype, highAndLowBits, bits + 1), 3, string.concat('rol width ', vm.toString(bits)));
    }
  }

  function testRotateRightWrapsAndNormalizesCount() public {
    for (uint256 i = 0; i < 6; i++) {
      (uint8 utype, uint256 bits) = _integerType(i);
      uint256 highBit = uint256(1) << (bits - 1);

      assertEq(_ror(utype, 1, 0), 1);
      assertEq(_ror(utype, 1, bits), 1);
      assertEq(_ror(utype, 1, bits + 1), highBit, string.concat('ror width ', vm.toString(bits)));
    }
  }

  function _rol(uint8 utype, uint256 value, uint256 count) private returns (uint256) {
    uint256 lhs = _handle(utype);
    uint256 rhs = _handle(utype);
    uint256 output = _handle(utype);
    mock.setValue(lhs, value);
    mock.setValue(rhs, count);
    mock.runRol(output, lhs, rhs);
    return mock.mockStorage(output);
  }

  function _ror(uint8 utype, uint256 value, uint256 count) private returns (uint256) {
    uint256 lhs = _handle(utype);
    uint256 rhs = _handle(utype);
    uint256 output = _handle(utype);
    mock.setValue(lhs, value);
    mock.setValue(rhs, count);
    mock.runRor(output, lhs, rhs);
    return mock.mockStorage(output);
  }

  function _handle(uint8 utype) private returns (uint256) {
    nonce++;
    return (nonce << 16) | (uint256(utype) << 8);
  }

  function _integerType(uint256 index) private pure returns (uint8 utype, uint256 bits) {
    if (index == 0) return (Utils.EUINT8_TFHE, 8);
    if (index == 1) return (Utils.EUINT16_TFHE, 16);
    if (index == 2) return (Utils.EUINT32_TFHE, 32);
    if (index == 3) return (Utils.EUINT64_TFHE, 64);
    if (index == 4) return (Utils.EUINT128_TFHE, 128);
    return (Utils.EUINT256_TFHE, 256);
  }
}
