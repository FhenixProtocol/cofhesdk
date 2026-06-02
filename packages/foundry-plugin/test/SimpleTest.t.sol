// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { Test } from 'forge-std/Test.sol';
import { SimpleTest } from '@cofhe/test-setup/contracts/SimpleTest.sol';
import { CofheTest } from '../contracts/CofheTest.sol';
import { CofheClient } from '../contracts/CofheClient.sol';
import { FHE, InEuint32, euint8, euint128, externalEuint32 } from '@fhenixprotocol/cofhe-contracts/FHE.sol';

/// @title SimpleTest Foundry Tests
/// @notice Foundry-native smoke tests for the CoFHE mock environment and FHE Solidity surface.
contract SimpleTestTest is CofheTest {
  SimpleTest private simpleTest;
  CofheClient private cofheClient;

  uint256 private constant USER_PKEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

  function setUp() public {
    deployMocks();
    cofheClient = createCofheClient();
    cofheClient.connect(USER_PKEY);
    simpleTest = new SimpleTest();
  }

  /// @notice Fuzz test: create an encrypted input and set it as state.
  function testSetNumberFuzz(uint32 n) public {
    InEuint32 memory number = cofheClient.createInEuint32(n);

    vm.prank(cofheClient.account());
    simpleTest.setValue(number);

    expectPlaintext(simpleTest.getValue(), n);
  }

  /// @notice Hash plus proof: set an encrypted value and validate it.
  function testSetValueHashPlusProof(uint32 n) public {
    (externalEuint32 hash, bytes memory proof) = cofheClient.createInEuint32_asHashPlusProof(n);
    vm.prank(cofheClient.account());
    simpleTest.setValueHashPlusProof(hash, proof);
    expectPlaintext(simpleTest.getValue(), n);
  }

  /// @notice Validates that mock arithmetic matches EVM uint8 wraparound behavior.
  function testOverflow() public {
    euint8 a = FHE.asEuint8(240);
    euint8 b = FHE.asEuint8(240);
    euint8 c = FHE.add(a, b);

    expectPlaintext(c, uint8((240 + 240) % 256));
  }

  /// @notice Validates division by zero behavior in the mock implementation.
  function testDivideByZero() public {
    euint8 a = FHE.asEuint8(240);
    euint8 b = FHE.asEuint8(0);
    euint8 c = FHE.div(a, b);

    expectPlaintext(c, type(uint8).max);
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

    expectPlaintext(euint128.unwrap(c), expected);
  }
}
