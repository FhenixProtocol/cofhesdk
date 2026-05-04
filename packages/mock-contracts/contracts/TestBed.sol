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
///      Important concepts:
///      - `eNumber` is an on-chain encrypted handle type (`euint32`). In real CoFHE, this represents a ciphertext.
///      - `numberHash` stores the unwrapped handle (`ctHash`) as a uint256 for easy inspection/assertions.
///      - After every state update we call `FHE.allowThis(...)` and `FHE.allowSender(...)` so the contract
///        and the transaction sender can continue operating on / decrypting the updated handle.
contract TestBed is SimpleTest {}
