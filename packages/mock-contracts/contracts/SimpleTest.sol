// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { SimpleTest as SharedSimpleTest } from '@cofhe/test-setup/contracts/SimpleTest.sol';

/// @title SimpleTest
/// @notice Fixed-address wrapper around the shared SimpleTest fixture used by mock deployments.
/// @dev This wrapper exists so the mock-contracts package can expose a stable artifact and fixed address
///      for Hardhat-based mock deployments while reusing the shared implementation from test-setup.
contract SimpleTest is SharedSimpleTest {}