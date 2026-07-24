// SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

import { IPermissionCustomIdValidator } from './Permissioned.sol';

/**
 * @notice Default ACP validator — timestamp-based revocation.
 *
 * Implements the unchanged V2 validator interface. Interprets a permission's
 * `validatorId` as its creation timestamp (populated by the SDK at permit
 * creation). Every SDK-created permit points here by default: no upfront
 * contract call is needed — a permit is revocable from birth.
 *
 * `disabled(issuer, id)` truth table:
 *
 *   | condition                   | result | meaning                          |
 *   |-----------------------------|--------|----------------------------------|
 *   | id > block.timestamp        | true   | future-dated permits never       |
 *   |                             |        | validate (closes the revoke-all  |
 *   |                             |        | dodge: a permit dated ahead of a |
 *   |                             |        | mass revocation would survive it)|
 *   | id <= revokeAllAt[issuer]   | true   | mass revocation (inclusive)      |
 *   | revokedSingle[issuer][id]   | true   | targeted revocation              |
 *   | otherwise                   | false  | permit valid                     |
 *
 * Accepted trade-offs (by design, see PermitV3 spec discussion):
 *  - Two permits minted by the same issuer in the same second share an id;
 *    revoking one revokes both. Over-revocation is the fail-safe direction.
 *  - Revocation is permanent — there is no un-revoke.
 *
 * The production counterpart is upgradeable (OZ AccessControl for the
 * upgrader role) and deployed to a fixed address as core infrastructure.
 */
contract TimestampBasedACPValidator is IPermissionCustomIdValidator {
  /// @notice issuer => threshold; permits with id (creation ts) at or before this are revoked
  mapping(address => uint256) public revokeAllAt;

  /// @notice issuer => id => revoked
  mapping(address => mapping(uint256 => bool)) public revokedSingle;

  event RevokedSingle(address indexed issuer, uint256 indexed id);
  event RevokedAll(address indexed issuer, uint256 at);

  /// @notice Revoke a single permit by its id (creation timestamp).
  ///         Only affects permits issued by the caller.
  function revokeSingle(uint256 id) external {
    revokedSingle[msg.sender][id] = true;
    emit RevokedSingle(msg.sender, id);
  }

  /// @notice Revoke every permit the caller created up to now.
  ///         O(1): a single threshold write, regardless of permit count.
  function revokeAllExisting() external {
    revokeAllAt[msg.sender] = block.timestamp;
    emit RevokedAll(msg.sender, block.timestamp);
  }

  /// @dev Called by the ACP verifier during permission validation.
  function disabled(address issuer, uint256 id) external view returns (bool) {
    return id > block.timestamp || id <= revokeAllAt[issuer] || revokedSingle[issuer][id];
  }
}
