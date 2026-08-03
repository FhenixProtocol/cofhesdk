// SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

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
  /// @notice recipient => ids of shares addressed to them
  mapping(address => bytes32[]) private _shareIdsFor;

  /// @notice share id => stored payload
  mapping(bytes32 => ACP) private _shares;

  /// @notice share id => index+1 in the recipient's id list (0 = not present)
  mapping(bytes32 => uint256) private _sharePos;

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
    if (_sharePos[shareId] != 0) revert AlreadyShared();

    _shares[shareId] = acp;
    _shareIdsFor[acp.recipient].push(shareId);
    _sharePos[shareId] = _shareIdsFor[acp.recipient].length;

    emit Shared(acp.recipient, acp.issuer, shareId);
  }

  /// @notice Remove a share. The issuer may retract it; the recipient may dismiss it
  ///         (e.g. after importing, or to decline).
  function removeShare(bytes32 shareId) external {
    uint256 pos = _sharePos[shareId];
    if (pos == 0) revert UnknownShare();

    ACP storage acp = _shares[shareId];
    if (msg.sender != acp.issuer && msg.sender != acp.recipient) revert NotIssuerOrRecipient();

    address recipient = acp.recipient;
    address issuer = acp.issuer;

    // swap-and-pop the recipient's id list
    bytes32[] storage ids = _shareIdsFor[recipient];
    uint256 idx = pos - 1;
    uint256 lastIdx = ids.length - 1;
    if (idx != lastIdx) {
      bytes32 movedId = ids[lastIdx];
      ids[idx] = movedId;
      _sharePos[movedId] = pos;
    }
    ids.pop();
    delete _sharePos[shareId];
    delete _shares[shareId];

    emit ShareRemoved(recipient, issuer, shareId);
  }

  /// @notice All importable shares addressed to `recipient`: unexpired and not revoked.
  ///         Dead entries stay in storage until removed but are filtered here.
  function sharesFor(address recipient) external view returns (ACP[] memory acps) {
    bytes32[] storage ids = _shareIdsFor[recipient];

    uint256 live = 0;
    for (uint256 i = 0; i < ids.length; i++) {
      if (_isValid(_shares[ids[i]])) live++;
    }

    acps = new ACP[](live);
    uint256 j = 0;
    for (uint256 i = 0; i < ids.length; i++) {
      ACP storage acp = _shares[ids[i]];
      if (_isValid(acp)) {
        acps[j] = acp;
        j++;
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
    if (_sharePos[shareId] == 0) return false;
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
