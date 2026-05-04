// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { SimpleTest } from '@cofhe/test-setup/contracts/SimpleTest.sol';

/// @title TestBed
/// @notice Minimal contract used to smoke-test CoFHE/FHE flows (mocks + permissions + decrypt plumbing).
/// @dev This contract is intentionally simple and is primarily a convenience for Hardhat-based local
///      development: the Hardhat plugin can deploy it automatically when `deployTestBed` is enabled.
///
///      In Foundry flows, nothing deploys or depends on this contract automatically — tests must
///      instantiate it explicitly (this repository includes such Foundry tests). You may deploy/use it
///      in `forge test` if you want a known-good reference target.
///
///      TestBed inherits the shared `SimpleTest` fixture from the test-setup package, so its callable surface
///      is defined there. In practice, tests use helpers such as `setValue(...)`, `setValueTrivial(...)`,
///      `getValue()`, and `getValueHash()` through this fixed-address wrapper.
contract TestBed is SimpleTest {}
