// solhint-disable func-name-mixedcase
// SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IPermissionCustomIdValidator} from "./Permissioned.sol";

/**
 * @dev ACP (Access Control Permission) — the V3 permission struct ("Permit V3").
 *
 * Evolves the V2 `Permission` (see Permissioned.sol) with scope granularity:
 *
 *   - `global`    permission grants access to ALL of `issuer`s encrypted values (V2 behavior)
 *   - `contracts` permission grants access to `issuer`s values allowed for one of these contracts
 *                 (ACL-side check: intersection over existing `persistedAllowedPairs`)
 *   - `handles`   permission grants access to these specific ciphertext handles
 *
 * Scope semantics are enforced by the ACL (`isAllowedWithPermission`), NOT by this
 * verifier. This contract verifies structure: expiration, signatures, revocation.
 *
 * The signing flows are identical to V2 (self / two-step sharing), with new
 * `ACPIssuerSelf` / `ACPIssuerShared` / `ACPRecipient` EIP-712 types and the
 * domain version bumped to "2".
 *
 * Revocation: `validatorId` + `validatorContract` are unchanged from V2 — the id is
 * an opaque uint256 interpreted by the validator implementation. The default
 * validator (deployed as core infrastructure) interprets it as the permit's
 * creation timestamp, enabling O(1) revoke-all. `validatorId = 0` or
 * `validatorContract = address(0)` disables the check (permission not revocable).
 */
struct ACP {
    // (base) User that initially created the permission, target of data fetching
    address issuer;
    // (base) Expiration timestamp
    uint64 expiration;
    // (sharing) The user that this permission will be shared with
    // ** optional, use `address(0)` to disable **
    address recipient;
    // (issuer defined validation) An id used to query a contract to check this permissions validity.
    // Opaque to this verifier; interpreted by `validatorContract` (creation timestamp in the default validator)
    // ** optional, use `0` to disable **
    uint256 validatorId;
    // (issuer defined validation) The contract to query to determine permission validity
    // ** optional, use `address(0)` to disable **
    address validatorContract;
    // (scope) Grants access to all of `issuer`s encrypted values (V2 behavior)
    bool global;
    // (scope) Grants access to `issuer`s values readable by any of these contracts
    address[] contracts;
    // (scope) Grants access to these specific ciphertext handles
    uint256[] handles;
    // (base) The publicKey of a sealingPair used to re-encrypt `issuer`s confidential data
    //   (non-sharing) Populated by `issuer`
    //   (sharing)     Populated by `recipient`
    bytes32 sealingKey;
    // (base) `signTypedData` signature created by `issuer`.
    // (base) Shared- and Self- permissions differ in signature format: (`sealingKey` absent in shared signature)
    //   (non-sharing) < issuer, expiration, recipient, validatorId, validatorContract, global, contracts, handles, sealingKey >
    //   (sharing)     < issuer, expiration, recipient, validatorId, validatorContract, global, contracts, handles >
    bytes issuerSignature;
    // (sharing) `signTypedData` signature created by `recipient` with format:
    // (sharing) < sealingKey, issuerSignature >
    // ** required for shared permits **
    bytes recipientSignature;
}

contract MockACP is EIP712 {
    using ACPUtils for ACP;

    /// @dev Same verifying-contract identity as V2 ("ACL"), domain version bumped for the V3 types.
    constructor() EIP712("ACL", "2") {}

    /// @dev Emitted when `permission.expiration` is in the past (< block.timestamp)
    error PermissionInvalid_Expired();

    /// @dev Emitted when `issuerSignature` is malformed or was not signed by `permission.issuer`
    error PermissionInvalid_IssuerSignature();

    /// @dev Emitted when `recipientSignature` is malformed or was not signed by `permission.recipient`
    error PermissionInvalid_RecipientSignature();

    /// @dev Emitted when `validatorContract` indicated that this permission has been externally disabled
    error PermissionInvalid_Disabled();

    /// @dev Validates a `permission`s access of sensitive data.
    /// `permission` may be invalid or unauthorized for the following reasons:
    ///    - Expired:                  `permission.expiration` is in the past (< block.timestamp)
    ///    - Issuer signature:         `issuerSignature` is malformed or was not signed by `permission.issuer`
    ///    - Recipient signature:      `recipientSignature` is malformed or was not signed by `permission.recipient`
    ///    - Disabled:                 `validatorContract` returned `true` from `disabled()` — permission externally revoked
    ///
    /// NOTE: identical check order and semantics to V2 `withPermission`; only the
    /// struct hashing (ACPUtils) differs. The validator call-site is unchanged.
    ///
    /// NOTE: Functions protected by `withPermission` should return ONLY the sensitive data of `permission.issuer`.
    /// !! Returning data of `msg.sender` will leak sensitive values - `msg.sender` cannot be trusted in view functions !!
    modifier withPermission(ACP memory permission) {
        // Expiration
        if (permission.expiration < block.timestamp)
            revert PermissionInvalid_Expired();

        // Issuer signature
        if (
            !SignatureChecker.isValidSignatureNow(
                permission.issuer,
                _hashTypedDataV4(permission.issuerHash()),
                permission.issuerSignature
            )
        ) revert PermissionInvalid_IssuerSignature();

        // (if applicable) Recipient signature
        if (
            permission.recipient != address(0) &&
            !SignatureChecker.isValidSignatureNow(
                permission.recipient,
                _hashTypedDataV4(permission.recipientHash()),
                permission.recipientSignature
            )
        ) revert PermissionInvalid_RecipientSignature();

        // (if applicable) Externally disabled
        if (
            permission.validatorId != 0 &&
            permission.validatorContract != address(0) &&
            IPermissionCustomIdValidator(permission.validatorContract).disabled(
                permission.issuer,
                permission.validatorId
            )
        ) revert PermissionInvalid_Disabled();

        _;
    }

    /// @dev Structure-validity probe, mirrors `ACL.checkPermitValidity`.
    /// Scope checks (global/contracts/handles vs a handle) are the ACL's job and
    /// are exercised against MockACL in a separate increment.
    function checkPermissionValidity(
        ACP memory permission
    ) public view withPermission(permission) returns (bool) {
        return true;
    }

    function hashTypedDataV4(
        bytes32 structHash
    ) public view virtual returns (bytes32) {
        return _hashTypedDataV4(structHash);
    }
}

/// @dev Internal utility library to improve the readability of MockACP
/// Primarily focused on signature type hashes
library ACPUtils {
    /// @dev EIP-712: dynamic arrays are hashed as keccak256 of the concatenated
    /// 32-byte-encoded elements — which is what `abi.encodePacked` produces for arrays.
    function issuerHash(
        ACP memory permission
    ) internal pure returns (bytes32) {
        if (permission.recipient == address(0))
            return issuerSelfHash(permission);
        return issuerSharedHash(permission);
    }

    function issuerSelfHash(
        ACP memory permission
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    keccak256(
                        "ACPIssuerSelf(address issuer,uint64 expiration,address recipient,uint256 validatorId,address validatorContract,bool global,address[] contracts,uint256[] handles,bytes32 sealingKey)"
                    ),
                    permission.issuer,
                    permission.expiration,
                    permission.recipient,
                    permission.validatorId,
                    permission.validatorContract,
                    permission.global,
                    keccak256(abi.encodePacked(permission.contracts)),
                    keccak256(abi.encodePacked(permission.handles)),
                    permission.sealingKey
                )
            );
    }

    function issuerSharedHash(
        ACP memory permission
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    keccak256(
                        "ACPIssuerShared(address issuer,uint64 expiration,address recipient,uint256 validatorId,address validatorContract,bool global,address[] contracts,uint256[] handles)"
                    ),
                    permission.issuer,
                    permission.expiration,
                    permission.recipient,
                    permission.validatorId,
                    permission.validatorContract,
                    permission.global,
                    keccak256(abi.encodePacked(permission.contracts)),
                    keccak256(abi.encodePacked(permission.handles))
                )
            );
    }

    function recipientHash(
        ACP memory permission
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    keccak256(
                        "ACPRecipient(bytes32 sealingKey,bytes issuerSignature)"
                    ),
                    permission.sealingKey,
                    keccak256(permission.issuerSignature)
                )
            );
    }
}
