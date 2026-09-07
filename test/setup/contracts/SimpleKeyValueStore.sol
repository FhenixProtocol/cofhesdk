// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

/**
 * Plural sibling of SimpleStorage: a plain uint256 => uint256 mapping, so tests can read a
 * dynamic-length batch (one getItem per key) with no FHE machinery involved. Used by the react
 * hooks' batch-read invalidation tests (useCofheReadContracts).
 */
contract SimpleKeyValueStore {
  mapping(uint256 => uint256) private items;

  function setItem(uint256 key, uint256 newValue) external {
    items[key] = newValue;
  }

  function getItem(uint256 key) external view returns (uint256) {
    return items[key];
  }
}
