// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25 <0.9.0;

import { PermissionedUpgradeable } from './Permissioned.sol';

/**
 * @notice The ACL's ACP checks, taken unchanged from cofhe-contracts (`PermissionedUpgradeable`
 * in Permissioned.sol), on a contract deployed directly rather than behind a proxy. The EIP-712
 * domain ("ACL", "2") is defined by code there, so it needs no initialization.
 */
contract MockPermissioned is PermissionedUpgradeable {
  /// @dev Exposed for tests that build typed-data digests.
  function hashTypedDataV4(bytes32 structHash) public view virtual returns (bytes32) {
    return _hashTypedDataV4(structHash);
  }
}
