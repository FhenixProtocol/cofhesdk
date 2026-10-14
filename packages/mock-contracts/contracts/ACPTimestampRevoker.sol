// SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

import { IPermissionCustomIdValidator } from './Permissioned.sol';

/**
 * @notice Default ACP revoker — timestamp-based revocation.
 *
 * Implements the unchanged revoker interface. Interprets a permission's
 * `revokerData` as its creation timestamp (populated by the SDK at acp
 * creation). Every SDK-created acp points here by default: no upfront
 * contract call is needed — an ACP is revocable from birth.
 *
 * `disabled(issuer, id)` truth table:
 *
 *   | condition                   | result | meaning                          |
 *   |-----------------------------|--------|----------------------------------|
 *   | id > block.timestamp        | true   | future-dated acps never       |
 *   |                             |        | validate (closes the revoke-all  |
 *   |                             |        | dodge: an ACP dated ahead of a|
 *   |                             |        | mass revocation would survive it)|
 *   | id <= revokeAllAt[issuer]   | true   | mass revocation (inclusive)      |
 *   | revokedSingle[issuer][id]   | true   | targeted revocation              |
 *   | otherwise                   | false  | acp valid                     |
 *
 * Accepted trade-offs (by design, see ACPV3 spec discussion):
 *  - Two acps minted by the same issuer in the same second share an id;
 *    revoking one revokes both. Over-revocation is the fail-safe direction.
 *  - Revocation is permanent — there is no un-revoke.
 *
 * The production counterpart is upgradeable (OZ AccessControl for the
 * upgrader role) and deployed to a fixed address as core infrastructure.
 */
contract ACPTimestampRevoker is IPermissionCustomIdValidator {
  /// @notice issuer => threshold; acps with id (creation ts) at or before this are revoked
  mapping(address => uint256) public revokeAllAt;

  /// @notice issuer => id => revoked
  mapping(address => mapping(uint256 => bool)) public revokedSingle;

  event RevokedSingle(address indexed issuer, uint256 indexed id);
  event RevokedAll(address indexed issuer, uint256 at);

  /// @notice Revoke a single acp by its id (creation timestamp).
  ///         Only affects acps issued by the caller.
  function revokeSingle(uint256 id) external {
    revokedSingle[msg.sender][id] = true;
    emit RevokedSingle(msg.sender, id);
  }

  /// @notice Revoke every acp the caller created up to now.
  ///         O(1): a single threshold write, regardless of acp count.
  function revokeAllExisting() external {
    revokeAllAt[msg.sender] = block.timestamp;
    emit RevokedAll(msg.sender, block.timestamp);
  }

  /// @dev Called by the ACL during permission validation.
  function disabled(address issuer, uint256 id) external view returns (bool) {
    return id > block.timestamp || id <= revokeAllAt[issuer] || revokedSingle[issuer][id];
  }
}
