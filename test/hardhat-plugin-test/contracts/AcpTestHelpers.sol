// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Pulls MockACP into this package's compilation so tests can deploy it directly.
// MockACP is not yet part of the plugin's fixed-address mock set — it moves there
// once MockACL consumes the V3 struct.
import {MockACP} from '@cofhe/mock-contracts/contracts/ACP.sol';
import {IPermissionCustomIdValidator} from '@cofhe/mock-contracts/contracts/Permissioned.sol';

/// @dev Configurable validator stub — `disabled()` returns whatever it is told to.
contract StubValidator is IPermissionCustomIdValidator {
  bool public ret;

  function set(bool ret_) external {
    ret = ret_;
  }

  function disabled(address, uint256) external view returns (bool) {
    return ret;
  }
}

/// @dev Validator stub that always reverts — a broken/hostile validator must
/// invalidate the permission (fail-closed), never validate it.
contract RevertingValidator is IPermissionCustomIdValidator {
  function disabled(address, uint256) external pure returns (bool) {
    revert('validator broken');
  }
}
