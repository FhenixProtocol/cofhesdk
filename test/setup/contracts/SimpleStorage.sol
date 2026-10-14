// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

/**
 * Plain (non-confidential) storage fixture: a minimal write -> read cycle with no FHE
 * machinery involved. Used by tests that exercise generic write/read plumbing — e.g. the
 * react hooks' post-write cache invalidation — where encrypted values would only add noise.
 */
contract SimpleStorage {
  uint256 private value;

  function setValue(uint256 newValue) external {
    value = newValue;
  }

  function getValue() external view returns (uint256) {
    return value;
  }
}
