// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { Test } from 'forge-std/Test.sol';
import { TestBed } from '../contracts/TestBed.sol';
import { CoFheTest } from '../contracts/foundry/CoFheTest.sol';
import { FHE, InEuint32, euint8, euint128 } from '@fhenixprotocol/cofhe-contracts/FHE.sol';

/// @title TestBed Foundry Tests
/// @notice Foundry-native smoke tests for the CoFHE mock environment and FHE Solidity surface.
/// @dev This repo deploys `TestBed` inside Foundry tests as a known-good reference contract.
///      Downstream Foundry users are not required to use `TestBed`; they can deploy/test their own
///      contracts while inheriting from `CoFheTest` to get helper methods like `createInEuint32(...)`
///      and `assertHashValue(...)`.
contract TestBedTest is Test, CoFheTest {
  TestBed private testbed;

  address private user = makeAddr('user');

  /// @notice Deploys a fresh TestBed instance for each test.
  function setUp() public {
    // optional ... enable verbose logging from fhe mocks
    // setLog(true);

    testbed = new TestBed();
  }

  /// @notice Fuzz test: create an encrypted input and set it as state.
  function testSetNumberFuzz(uint32 n) public {
    InEuint32 memory number = createInEuint32(n, user);

    //must be the user who sends transaction
    //or else invalid permissions from fhe allow
    vm.prank(user);
    testbed.setNumber(number);

    assertHashValue(testbed.eNumber(), n);
  }

  /// @notice Validates that mock arithmetic matches EVM uint8 wraparound behavior.
  function testOverflow() public {
    euint8 a = FHE.asEuint8(240);
    euint8 b = FHE.asEuint8(240);
    euint8 c = FHE.add(a, b);

    assertHashValue(uint256(euint8.unwrap(c)), (240 + 240) % 256);
  }

  /// @notice Validates division by zero behavior in the mock implementation.
  function testDivideByZero() public {
    euint8 a = FHE.asEuint8(240);
    euint8 b = FHE.asEuint8(0);
    euint8 c = FHE.div(a, b);

    assertHashValue(uint256(euint8.unwrap(c)), type(uint8).max);
  }

  /// @notice Validates 128-bit addition semantics used by the mock implementation.
  function test128BitsNoOverflow() public {
    euint128 a = FHE.asEuint128(type(uint128).max);
    euint128 b = FHE.asEuint128(type(uint128).max);
    euint128 c = FHE.add(a, b);

    uint256 expected;
    unchecked {
      expected = type(uint128).max + type(uint128).max;
    }

    assertHashValue(uint256(euint128.unwrap(c)), expected);
  }
}
