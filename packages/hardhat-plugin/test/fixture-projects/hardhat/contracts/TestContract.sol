// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

contract TestContract {
  uint256 public value;

  constructor(uint256 _value) {
    value = _value;
  }

  function setValue(uint256 _value) public {
    value = _value;
  }

  function getValue() public view returns (uint256) {
    return value;
  }
}
