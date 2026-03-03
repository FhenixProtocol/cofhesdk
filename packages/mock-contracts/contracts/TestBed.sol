// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import '@fhenixprotocol/cofhe-contracts/FHE.sol';

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
contract TestBed {
  euint32 public eNumber;
  bytes32 public numberHash;

  /// @notice Marker used by deploy scripts/tests to confirm the contract is deployed.
  function exists() public pure returns (bool) {
    return true;
  }

  /// @notice Sets `eNumber` from an encrypted input struct.
  /// @dev Typically used when testing client-side encryption flows.
  function setNumber(InEuint32 memory inNumber) public {
    eNumber = FHE.asEuint32(inNumber);
    numberHash = euint32.unwrap(eNumber);
    FHE.allowThis(eNumber);
    FHE.allowSender(eNumber);
  }

  /// @notice Convenience setter that casts a plaintext value into an encrypted handle.
  /// @dev Useful for quick smoke tests that don't need pre-encryption.
  function setNumberTrivial(uint32 inNumber) public {
    eNumber = FHE.asEuint32(inNumber);
    numberHash = euint32.unwrap(eNumber);
    FHE.allowThis(eNumber);
    FHE.allowSender(eNumber);
  }

  /// @notice Increments `eNumber` by 1 using FHE arithmetic.
  function increment() public {
    eNumber = FHE.add(eNumber, FHE.asEuint32(1));
    FHE.allowThis(eNumber);
    FHE.allowSender(eNumber);
  }

  /// @notice Adds an encrypted input to `eNumber`.
  function add(InEuint32 memory inNumber) public {
    eNumber = FHE.add(eNumber, FHE.asEuint32(inNumber));

    FHE.allowThis(eNumber);
    FHE.allowSender(eNumber);
  }

  /// @notice Subtracts an encrypted input from `eNumber`, clamped to 0 to avoid underflow.
  function sub(InEuint32 memory inNumber) public {
    euint32 inAsEuint32 = FHE.asEuint32(inNumber);
    euint32 eSubOrZero = FHE.select(FHE.lte(inAsEuint32, eNumber), inAsEuint32, FHE.asEuint32(0));
    eNumber = FHE.sub(eNumber, eSubOrZero);
    FHE.allowThis(eNumber);
    FHE.allowSender(eNumber);
  }

  /// @notice Multiplies `eNumber` by an encrypted input.
  function mul(InEuint32 memory inNumber) public {
    eNumber = FHE.mul(eNumber, FHE.asEuint32(inNumber));
    FHE.allowThis(eNumber);
    FHE.allowSender(eNumber);
  }

  /// @notice Requests decryption of `eNumber`.
  /// @dev In real CoFHE this is asynchronous; in mocks it is simulated.
  function decrypt() public {
    FHE.decrypt(eNumber);
  }

  /// @notice Reads a decryption result (reverts if not ready depending on implementation).
  function getDecryptResult(euint32 input1) public view returns (uint32) {
    return FHE.getDecryptResult(input1);
  }

  /// @notice Reads a decryption result safely, returning a readiness flag.
  function getDecryptResultSafe(euint32 input1) public view returns (uint32 value, bool decrypted) {
    return FHE.getDecryptResultSafe(input1);
  }

  /// @notice Publishes a decrypt result for an encrypted handle.
  function publishDecryptResult(euint32 input, uint32 result, bytes memory signature) external {
    FHE.publishDecryptResult(input, result, signature);
  }
}
