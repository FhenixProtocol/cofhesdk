// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import '@fhenixprotocol/cofhe-contracts/FHE.sol';

/// A small vault holding encrypted values.
contract EvalVault {
  /// Readable by the account that set it.
  euint32 public storedValue;

  /// Readable by anyone.
  euint64 public publicTotal;

  /// Readable by the account that set them.
  euint64 public rangeMin;
  euint64 public rangeMax;
  ebool public enabled;

  /// Stores `values[0]`. The batch must hold exactly one value.
  function setValue(externalEuint32[] memory values, bytes memory signature) external {
    euint32 value = FHE.asEuint32s(values, signature)[0];
    storedValue = value;
    FHE.allowThis(value);
    FHE.allowSender(value);
  }

  /// Stores `values[0]` as the range minimum and `values[1]` as the maximum.
  function setRange(externalEuint64[] memory values, bytes memory signature) external {
    euint64[] memory range = FHE.asEuint64s(values, signature);
    rangeMin = range[0];
    rangeMax = range[1];
    FHE.allowThis(rangeMin);
    FHE.allowSender(rangeMin);
    FHE.allowThis(rangeMax);
    FHE.allowSender(rangeMax);
  }

  /// Stores `values[0]`. The batch must hold exactly one value.
  function setEnabled(externalEbool[] memory values, bytes memory signature) external {
    ebool value = FHE.asEbools(values, signature)[0];
    enabled = value;
    FHE.allowThis(value);
    FHE.allowSender(value);
  }

  /// Publishes the plaintext of `publicTotal`. `signature` is the Threshold Network signature for it.
  function revealTotal(uint64 total, bytes memory signature) external {
    FHE.publishDecryptResult(publicTotal, total, signature);
  }

  /// The published plaintext of `publicTotal`, and whether it has been published.
  function getRevealedTotal() external view returns (uint64 total, bool revealed) {
    return FHE.getDecryptResultSafe(publicTotal);
  }

  /// Operator functions: set a value from a plaintext.
  function seedValue(uint32 value) external {
    storedValue = FHE.asEuint32(value);
    FHE.allowThis(storedValue);
    FHE.allowSender(storedValue);
  }

  function seedPublicTotal(uint64 value) external {
    publicTotal = FHE.asEuint64(value);
    FHE.allowThis(publicTotal);
    FHE.allowPublic(publicTotal);
  }
}
