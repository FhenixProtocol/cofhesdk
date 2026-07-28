// solhint-disable func-name-mixedcase
// SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @dev ACP scope discriminator (uint8 on the wire). Exactly one scope mode per ACP:
///   SCOPE_GLOBAL   — access to ALL of `issuer`s encrypted values; `contracts`/`handles` must be empty
///   SCOPE_CONTRACT — access to values readable by any of `contracts`; `handles` must be empty
///   SCOPE_HANDLES  — access to the listed ciphertext `handles` only; `contracts` must be empty
/// Array/scope consistency is validated client-side at creation (no contract-side enforcement).
uint8 constant SCOPE_GLOBAL = 0;
uint8 constant SCOPE_CONTRACT = 1;
uint8 constant SCOPE_HANDLES = 2;

/**
 * @dev ACP (Access Control Permission) — the V3 permission struct.
 *
 * Signing flows are identical to V2 (self / two-step sharing) with the
 * `ACPIssuerSelf` / `ACPIssuerShared` / `ACPRecipient` EIP-712 types under
 * domain version "2".
 *
 * Revocation: `revokerData` is an opaque uint256 interpreted by
 * `revokerContract` (creation timestamp in the default ACPTimestampRevoker).
 * `revokerData = 0` or `revokerContract = address(0)` disables the check
 * (permission not revocable).
 */
struct ACP {
    address issuer;
    uint64 expiration;
    address recipient;
    uint256 revokerData;
    address revokerContract;
    uint8 scope;
    address[] contracts;
    uint256[] handles;
    bytes32 sealingKey;
    bytes issuerSignature;
    bytes recipientSignature;
}

/// @dev Minimum required interface to create a custom permission revoker.
/// Revokers are optional and provide control to disable a permission after creation.
interface IPermissionCustomIdValidator {
    /// @dev Returning `true` disables the permission.
    function disabled(address issuer, uint256 id) external view returns (bool);
}

contract MockPermissioned is EIP712 {
    using ACPUtils for ACP;

    /// @dev Same verifying-contract identity as V2 ("ACL"), domain version bumped for V3 types.
    constructor() EIP712("ACL", "2") {}

    error PermissionInvalid_Expired();
    error PermissionInvalid_IssuerSignature();
    error PermissionInvalid_RecipientSignature();
    error PermissionInvalid_Disabled();

    /// @dev Validates an ACP's structure: expiration, signatures, revocation.
    /// Identical check order and semantics to V2 `withPermission`.
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

        // (if applicable) Externally disabled (revoked)
        if (
            permission.revokerData != 0 &&
            permission.revokerContract != address(0) &&
            IPermissionCustomIdValidator(permission.revokerContract).disabled(
                permission.issuer,
                permission.revokerData
            )
        ) revert PermissionInvalid_Disabled();

        _;
    }

    /// @dev Structure-validity probe (expiration / signatures / revocation).
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

/// @dev Signature type hashes for ACP. Field order must match the struct and the
/// SDK's SignatureTypes exactly — pinned by tests on both sides.
library ACPUtils {
    function issuerHash(ACP memory permission) internal pure returns (bytes32) {
        if (permission.recipient == address(0)) return issuerSelfHash(permission);
        return issuerSharedHash(permission);
    }

    function issuerSelfHash(ACP memory permission) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    keccak256(
                        "ACPIssuerSelf(address issuer,uint64 expiration,address recipient,uint256 revokerData,address revokerContract,uint8 scope,address[] contracts,uint256[] handles,bytes32 sealingKey)"
                    ),
                    permission.issuer,
                    permission.expiration,
                    permission.recipient,
                    permission.revokerData,
                    permission.revokerContract,
                    permission.scope,
                    keccak256(abi.encodePacked(permission.contracts)),
                    keccak256(abi.encodePacked(permission.handles)),
                    permission.sealingKey
                )
            );
    }

    function issuerSharedHash(ACP memory permission) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    keccak256(
                        "ACPIssuerShared(address issuer,uint64 expiration,address recipient,uint256 revokerData,address revokerContract,uint8 scope,address[] contracts,uint256[] handles)"
                    ),
                    permission.issuer,
                    permission.expiration,
                    permission.recipient,
                    permission.revokerData,
                    permission.revokerContract,
                    permission.scope,
                    keccak256(abi.encodePacked(permission.contracts)),
                    keccak256(abi.encodePacked(permission.handles))
                )
            );
    }

    function recipientHash(ACP memory permission) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    keccak256("ACPRecipient(bytes32 sealingKey,bytes issuerSignature)"),
                    permission.sealingKey,
                    keccak256(permission.issuerSignature)
                )
            );
    }
}
