// SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

import { EnumerableSet } from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import { ACP, IPermissionCustomIdValidator } from './Permissioned.sol';

/**
 * @notice On-chain hand-off for sharing ACPs — replaces the JSON copy-paste flow.
 *
 * An issuer posts a sharing ACP addressed to a recipient; the recipient reads it
 * from here, fills in their sealing key, signs, and imports it client-side. Shares
 * are indexed globally per recipient — a share is addressed to a person, and any
 * cofhesdk-enabled app may surface it.
 *
 * The registry stores the payload verbatim and stays deliberately dumb:
 *
 *  - The posted ACP carries `sealingKey = 0` and `recipientSignature = ""` — the
 *    recipient supplies both at import, exactly as in the off-chain flow.
 *  - No signature verification on-chain: a share's full validity cannot be checked
 *    before the recipient signs, and the SDK validates everything at import. The
 *    trust the registry adds is `msg.sender == acp.issuer` — a share listed under
 *    a recipient was genuinely posted by its claimed issuer.
 *  - `isShareValid` is the verification hook for other contracts: share exists,
 *    is unexpired, and is not revoked (per the share's own revoker contract).
 *
 * Nothing stored here is sensitive: every field is part of the cleartext share
 * payload by design. Posting on-chain does make the issuer→recipient sharing
 * relationship public. (A future variant may accept an encrypted payload as a
 * parallel entry type; this registry's cleartext entries would be unaffected.)
 *
 * The production counterpart is upgradeable (OZ AccessControl for the upgrader
 * role) and deployed to a fixed address as core infrastructure.
 */
contract ACPShareRegistry {
  using EnumerableSet for EnumerableSet.Bytes32Set;

  /// @notice recipient => ids of shares addressed to them
  mapping(address => EnumerableSet.Bytes32Set) private _shareIdsFor;

  /// @notice share id => stored payload
  mapping(bytes32 => ACP) private _shares;

  event Shared(address indexed recipient, address indexed issuer, bytes32 shareId);
  event ShareRemoved(address indexed recipient, address indexed issuer, bytes32 shareId);

  error NotIssuer();
  error NotIssuerOrRecipient();
  error RecipientMissing();
  error SealingKeyMustBeEmpty();
  error IssuerSignatureMissing();
  error ShareExpired();
  error AlreadyShared();
  error UnknownShare();

  /// @notice Post a sharing ACP for its recipient to pick up.
  /// @dev The share id is the hash of the payload — reposting an identical share reverts.
  function share(ACP calldata acp) external returns (bytes32 shareId) {
    if (msg.sender != acp.issuer) revert NotIssuer();
    if (acp.recipient == address(0)) revert RecipientMissing();
    if (acp.sealingKey != bytes32(0)) revert SealingKeyMustBeEmpty();
    if (acp.issuerSignature.length == 0) revert IssuerSignatureMissing();
    if (acp.expiration < block.timestamp) revert ShareExpired();

    shareId = keccak256(abi.encode(acp));
    // the id commits to the recipient, so a duplicate can only be in this set
    if (!_shareIdsFor[acp.recipient].add(shareId)) revert AlreadyShared();
    _shares[shareId] = acp;

    emit Shared(acp.recipient, acp.issuer, shareId);
  }

  /// @notice Remove a share. The issuer may retract it; the recipient may dismiss it
  ///         (e.g. after importing, or to decline).
  function removeShare(bytes32 shareId) external {
    ACP storage acp = _shares[shareId];
    if (acp.issuer == address(0)) revert UnknownShare();
    if (msg.sender != acp.issuer && msg.sender != acp.recipient) revert NotIssuerOrRecipient();

    address recipient = acp.recipient;
    address issuer = acp.issuer;

    // the id set and the payload map stay in sync — mirror share()'s add() handling
    if (!_shareIdsFor[recipient].remove(shareId)) revert UnknownShare();
    delete _shares[shareId];

    emit ShareRemoved(recipient, issuer, shareId);
  }

  /// @notice Maximum number of live shares returned by `sharesFor` / one `sharesForPage` call.
  /// @dev Caps unbounded iteration so a spam-filled inbox cannot grief callers with O(n) gas.
  uint256 public constant MAX_SHARES_PAGE = 256;

  /// @notice First page of importable shares for `recipient` (unexpired, not revoked).
  /// @dev Equivalent to `sharesForPage(recipient, 0, MAX_SHARES_PAGE)`. Use
  ///      `sharesForCount` + `sharesForPage` to walk larger inboxes safely.
  function sharesFor(address recipient) external view returns (ACP[] memory) {
    return sharesForPage(recipient, 0, MAX_SHARES_PAGE);
  }

  /// @notice Number of importable (live) shares addressed to `recipient`.
  function sharesForCount(address recipient) external view returns (uint256 count) {
    EnumerableSet.Bytes32Set storage ids = _shareIdsFor[recipient];
    uint256 len = ids.length();
    for (uint256 i = 0; i < len; i++) {
      if (_isValid(_shares[ids.at(i)])) count++;
    }
  }

  /// @notice Paginated importable shares for `recipient`, skipping `offset` live entries.
  /// @param limit Max live shares to return; capped at `MAX_SHARES_PAGE`.
  function sharesForPage(
    address recipient,
    uint256 offset,
    uint256 limit
  ) public view returns (ACP[] memory acps) {
    if (limit > MAX_SHARES_PAGE) limit = MAX_SHARES_PAGE;
    if (limit == 0) return acps;

    EnumerableSet.Bytes32Set storage ids = _shareIdsFor[recipient];
    uint256 len = ids.length();
    if (len == 0) return acps;

    acps = new ACP[](limit);
    uint256 skipped = 0;
    uint256 filled = 0;
    for (uint256 i = 0; i < len && filled < limit; i++) {
      ACP storage acp = _shares[ids.at(i)];
      if (!_isValid(acp)) continue;
      if (skipped < offset) {
        skipped++;
        continue;
      }
      acps[filled] = acp;
      filled++;
    }

    if (filled < limit) {
      assembly {
        mstore(acps, filled)
      }
    }
  }

  /// @notice A single share by id (zeroed struct if unknown/removed).
  function getShare(bytes32 shareId) external view returns (ACP memory) {
    return _shares[shareId];
  }

  /// @notice Verification hook for contracts: the share exists, was posted by its
  ///         claimed issuer (guaranteed at posting), is unexpired, and is not
  ///         revoked per its own revoker contract.
  function isShareValid(bytes32 shareId) external view returns (bool) {
    if (_shares[shareId].issuer == address(0)) return false;
    return _isValid(_shares[shareId]);
  }

  /// @dev Unexpired and not revoked. The revoker call mirrors `withPermission`'s
  ///      revocation clause; a reverting revoker fails closed (share invalid).
  function _isValid(ACP storage acp) private view returns (bool) {
    if (acp.expiration < block.timestamp) return false;

    if (acp.revokerData != 0 && acp.revokerContract != address(0)) {
      try IPermissionCustomIdValidator(acp.revokerContract).disabled(acp.issuer, acp.revokerData) returns (
        bool disabled
      ) {
        if (disabled) return false;
      } catch {
        return false;
      }
    }

    return true;
  }
}
