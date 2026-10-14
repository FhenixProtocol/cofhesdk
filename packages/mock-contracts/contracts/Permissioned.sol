// solhint-disable func-name-mixedcase
// SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @dev ACP scope discriminator (uint8 on the wire). Exactly one scope mode per ACP:
///   SCOPE_GLOBAL   — access to ALL of `issuer`s encrypted values; `contracts`/`handles` must be empty
///   SCOPE_CONTRACT — access to values readable by any of `contracts`; `handles` must be empty
///   SCOPE_HANDLES  — access to the listed ciphertext `handles` only; `contracts` must be empty
/// Array/scope consistency is validated client-side at creation (no contract-side enforcement).
uint8 constant SCOPE_GLOBAL = 0;
uint8 constant SCOPE_CONTRACT = 1;
uint8 constant SCOPE_HANDLES = 2;

/**
 * @dev ACP (Access Control Permission) — the permission body that must be passed to a
 * contract to allow access to sensitive data.
 *
 * The minimum permission to access a user's own data requires the fields
 * < issuer, expiration, scope, sealingKey, issuerSignature >
 *
 *   ---
 *
 * If not sharing the permission, `issuer` signs a signature using the fields:
 *     < issuer, expiration, recipient, revokerData, revokerContract, scope, contracts, handles, sealingKey >
 * This signature can now be used by `issuer` to access their own encrypted data.
 *
 *   ---
 *
 * Sharing a permission is a two step process: `issuer` completes step 1, and `recipient` completes step 2.
 *
 * 1:
 * `issuer` creates a permission with `recipient` populated with the address of the user to give access to.
 * `issuer` does not include a `sealingKey` in the permission, it will be populated by the `recipient`.
 * `issuer` signs a signature including the fields: (note: `sealingKey` is absent in this signature)
 *     < issuer, expiration, recipient, revokerData, revokerContract, scope, contracts, handles >
 * `issuer` packages the permission data and `issuerSignature` and shares it with `recipient`
 *     ** None of this data is sensitive, and can be shared as cleartext **
 *
 * 2:
 * `recipient` adds their `sealingKey` to the data received from `issuer`
 * `recipient` signs a signature including the fields:
 *     < sealingKey, issuerSignature >
 * `recipient` can now use the completed permission to access `issuer`s encrypted data.
 *
 *   ---
 *
 * Scope: `scope` selects exactly one access mode (see SCOPE_* above). Scopes narrow the
 * issuer's existing ACL access, they never widen it. Scope semantics are enforced by the
 * ACL (`isAllowedWithPermission`); this contract checks structure only.
 *
 *   ---
 *
 * Revocation: `revokerData` and `revokerContract` are optional and can be used together to
 * increase security and control by disabling a permission after it has been created.
 * `revokerData` is an opaque uint256 interpreted by `revokerContract` (the creation
 * timestamp in the default ACPTimestampRevoker). `revokerData = 0` or
 * `revokerContract = address(0)` disables the check (permission not revocable).
 */
struct ACP {
  // (base) User that initially created the permission, target of data fetching
  address issuer;
  // (base) Expiration timestamp
  uint64 expiration;
  // (sharing) The user that this permission will be shared with
  // ** optional, use `address(0)` to disable **
  address recipient;
  // (issuer defined revocation) Opaque data passed to `revokerContract` to check this permission's validity
  // ** optional, use `0` to disable **
  uint256 revokerData;
  // (issuer defined revocation) The contract to query to determine permission validity
  // ** optional, use `address(0)` to disable **
  address revokerContract;
  // (scope) Which access mode this permission grants — one of SCOPE_GLOBAL / SCOPE_CONTRACT / SCOPE_HANDLES
  uint8 scope;
  // (scope) Contracts whose readable values this permission grants access to (SCOPE_CONTRACT only)
  address[] contracts;
  // (scope) Ciphertext handles this permission grants access to (SCOPE_HANDLES only)
  bytes32[] handles;
  // (base) The publicKey of a sealingPair used to re-encrypt `issuer`s confidential data
  //   (non-sharing) Populated by `issuer`
  //   (sharing)     Populated by `recipient`
  bytes32 sealingKey;
  // (base) `signTypedData` signature created by `issuer`.
  // (base) Shared- and Self- permissions differ in signature format: (`sealingKey` absent in shared signature)
  bytes issuerSignature;
  // (sharing) `signTypedData` signature created by `recipient` with format:
  // (sharing) < sealingKey, issuerSignature >
  // ** required for shared permissions **
  bytes recipientSignature;
}

/// @dev Minimum required interface to create a custom permission revoker.
/// Revokers are optional, and provide extra security and control when sharing permissions.
interface IPermissionCustomIdValidator {
  /// @dev Checks whether a permission has been revoked, returning `true` disables the permission.
  function disabled(address issuer, uint256 id) external view returns (bool);
}

contract PermissionedUpgradeable is Initializable, EIP712Upgradeable {
  using ACPUtils for ACP;

  /// @dev Same verifying-contract identity as V2 ("ACL"), domain version bumped for the ACP types.
  function __PermissionedUpgradeable_init() internal onlyInitializing {
    __EIP712_init_unchained("ACL", "2");
  }

  function __PermissionedUpgradeable_init_unchained()
    internal
    onlyInitializing
  {
    __EIP712_init_unchained("ACL", "2");
  }

  /// @dev The EIP-712 domain is defined by code, not by storage.
  ///
  /// `EIP712Upgradeable` persists name/version at initialization time and only
  /// then — an implementation-only upgrade would leave an already-initialized
  /// proxy reporting the V2 domain ("ACL", "1") while hashing the V3 types,
  /// and every signature would fail to verify. Overriding the accessors (which
  /// OZ marks `virtual` for exactly this case) makes the upgrade a pure
  /// implementation swap: no reinitializer, no migration transaction.
  function _EIP712Name() internal view virtual override returns (string memory) {
    return "ACL";
  }

  function _EIP712Version()
    internal
    view
    virtual
    override
    returns (string memory)
  {
    return "2";
  }

  /// @dev Emitted when `acp.expiration` is in the past (< block.timestamp)
  error PermissionInvalid_Expired();

  /// @dev Emitted when `issuerSignature` is malformed or was not signed by `acp.issuer`
  error PermissionInvalid_IssuerSignature();

  /// @dev Emitted when `recipientSignature` is malformed or was not signed by `acp.recipient`
  error PermissionInvalid_RecipientSignature();

  /// @dev Emitted when `revokerContract` returned `true` indicating that this permission has been externally disabled
  error PermissionInvalid_Disabled();

  /// @dev Validates an `acp`s access of sensitive data.
  /// `acp` may be invalid or unauthorized for the following reasons:
  ///    - Expired:                  `acp.expiration` is in the past (< block.timestamp)
  ///    - Issuer signature:         `issuerSignature` is malformed or was not signed by `acp.issuer`
  ///    - Recipient signature:      `recipientSignature` is malformed or was not signed by `acp.recipient`
  ///    - Disabled:                 `revokerContract` returned `true` indicating that this permission has been externally disabled
  /// @param acp ACP struct containing data necessary to validate data access and seal for return.
  ///
  /// NOTE: Functions protected by `withPermission` should return ONLY the sensitive data of `acp.issuer`.
  /// !! Returning data of `msg.sender` will leak sensitive values - `msg.sender` cannot be trusted in view functions !!
  modifier withPermission(ACP memory acp) {
    // Expiration
    if (acp.expiration < block.timestamp)
      revert PermissionInvalid_Expired();

    // Issuer signature
    if (
      !SignatureChecker.isValidSignatureNow(
        acp.issuer,
        _hashTypedDataV4(acp.issuerHash()),
        acp.issuerSignature
      )
    ) revert PermissionInvalid_IssuerSignature();

    // (if applicable) Recipient signature
    if (
      acp.recipient != address(0) &&
      !SignatureChecker.isValidSignatureNow(
        acp.recipient,
        _hashTypedDataV4(acp.recipientHash()),
        acp.recipientSignature
      )
    ) revert PermissionInvalid_RecipientSignature();

    // (if applicable) Externally disabled (revoked)
    if (
      acp.revokerData != 0 &&
      acp.revokerContract != address(0) &&
      IPermissionCustomIdValidator(acp.revokerContract).disabled(
        acp.issuer,
        acp.revokerData
      )
    ) revert PermissionInvalid_Disabled();

    _;
  }

  /// @dev Structure-validity probe (expiration / signatures / revocation).
  function checkPermissionValidity(
    ACP memory acp
  ) public view withPermission(acp) returns (bool) {
    return true;
  }
}

/// @dev Internal utility library to improve the readability of PermissionedUpgradeable.
/// Primarily focused on signature type hashes. Field order must match the struct and the
/// SDK's SignatureTypes exactly — pinned by tests on both sides.
library ACPUtils {
  function issuerHash(ACP memory acp) internal pure returns (bytes32) {
    if (acp.recipient == address(0)) return issuerSelfHash(acp);
    return issuerSharedHash(acp);
  }

  function issuerSelfHash(
    ACP memory acp
  ) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encode(
          keccak256(
            "ACPIssuerSelf(address issuer,uint64 expiration,address recipient,uint256 revokerData,address revokerContract,uint8 scope,address[] contracts,bytes32[] handles,bytes32 sealingKey)"
          ),
          acp.issuer,
          acp.expiration,
          acp.recipient,
          acp.revokerData,
          acp.revokerContract,
          acp.scope,
          keccak256(abi.encodePacked(acp.contracts)),
          keccak256(abi.encodePacked(acp.handles)),
          acp.sealingKey
        )
      );
  }

  function issuerSharedHash(
    ACP memory acp
  ) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encode(
          keccak256(
            "ACPIssuerShared(address issuer,uint64 expiration,address recipient,uint256 revokerData,address revokerContract,uint8 scope,address[] contracts,bytes32[] handles)"
          ),
          acp.issuer,
          acp.expiration,
          acp.recipient,
          acp.revokerData,
          acp.revokerContract,
          acp.scope,
          keccak256(abi.encodePacked(acp.contracts)),
          keccak256(abi.encodePacked(acp.handles))
        )
      );
  }

  function recipientHash(
    ACP memory acp
  ) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encode(
          keccak256("ACPRecipient(bytes32 sealingKey,bytes issuerSignature)"),
          acp.sealingKey,
          keccak256(acp.issuerSignature)
        )
      );
  }
}
