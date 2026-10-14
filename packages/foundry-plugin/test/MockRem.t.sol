// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { CofheTest } from '../contracts/CofheTest.sol';
import { FHE, euint8, euint32, euint128 } from '@fhenixprotocol/cofhe-contracts/FHE.sol';

/// @notice FHE.rem by zero must return the numerator unchanged, like TFHE-rs, instead of reverting.
contract MockRemTest is CofheTest {
  function setUp() public {
    deployMocks();
  }

  function testRem() public {
    expectPlaintext(FHE.rem(FHE.asEuint8(200), FHE.asEuint8(7)), uint8(200 % 7));
    expectPlaintext(FHE.rem(FHE.asEuint32(1_000_003), FHE.asEuint32(1000)), uint32(3));
  }

  function testRemByZeroEuint8() public {
    expectPlaintext(FHE.rem(FHE.asEuint8(240), FHE.asEuint8(0)), uint8(240));
  }

  function testRemByZeroEuint32() public {
    expectPlaintext(FHE.rem(FHE.asEuint32(123_456_789), FHE.asEuint32(0)), uint32(123_456_789));
  }

  function testRemByZeroEuint128() public {
    expectPlaintext(FHE.rem(FHE.asEuint128(type(uint128).max), FHE.asEuint128(0)), type(uint128).max);
  }

  function testRemByZeroFuzz(uint32 x) public {
    expectPlaintext(FHE.rem(FHE.asEuint32(x), FHE.asEuint32(0)), x);
  }
}
