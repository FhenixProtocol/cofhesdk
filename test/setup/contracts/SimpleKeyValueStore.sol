// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

/**
 * Plural sibling of SimpleStorage: a plain uint256 => uint256 mapping, so tests can read a
 * dynamic-length batch (one getItem per key) with no FHE machinery involved. Used by the react
 * hooks' batch-read invalidation tests (useCofheReadContracts). Emits ItemSet so tests can also
 * exercise receipt-dependent invalidation (targets derived from the mined logs).
 */
contract SimpleKeyValueStore {
  mapping(uint256 => uint256) private items;

  event ItemSet(uint256 indexed key, uint256 newValue);

  function setItem(uint256 key, uint256 newValue) external {
    items[key] = newValue;
    emit ItemSet(key, newValue);
  }

  function getItem(uint256 key) external view returns (uint256) {
    return items[key];
  }
}
