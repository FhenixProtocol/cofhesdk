// solhint-disable func-name-mixedcase
// SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

import { SignatureChecker } from '@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol';
import { EIP712 } from '@openzeppelin/contracts/utils/cryptography/EIP712.sol';

/**
 * TEST FIXTURE — the released (pre-ACP) permit verification, verbatim from the
 * V2 mock Permissioned.sol: EIP712("ACL","1") domain, `Permission` struct,
 * PermissionedV2* typehashes, and the `withPermission` signature checks.
 *
 * Used by the backward-compat e2e to prove that permits signed by the SDK's
 * legacy-v2 engine are accepted by a chain still running the V2 ACL. Only the
 * contract/library/interface identifiers are renamed (Legacy* prefix) to avoid
 * artifact-name clashes with the current mocks — the verification logic and
 * type strings are untouched.
 */
struct Permission {
  address issuer;
  uint64 expiration;
  address recipient;
  uint256 validatorId;
  address validatorContract;
  bytes32 sealingKey;
  bytes issuerSignature;
  bytes recipientSignature;
}

interface ILegacyPermissionValidatorV2 {
  function disabled(address issuer, uint256 id) external view returns (bool);
}

contract LegacyMockPermissionedV2 is EIP712 {
  using LegacyPermissionUtilsV2 for Permission;

  constructor() EIP712('ACL', '1') {}

  error PermissionInvalid_Expired();
  error PermissionInvalid_IssuerSignature();
  error PermissionInvalid_RecipientSignature();
  error PermissionInvalid_Disabled();

  modifier withPermission(Permission memory permission) {
    // Expiration
    if (permission.expiration < block.timestamp) revert PermissionInvalid_Expired();

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
      ILegacyPermissionValidatorV2(permission.validatorContract).disabled(permission.issuer, permission.validatorId)
    ) revert PermissionInvalid_Disabled();

    _;
  }
}

/// @dev The V2 ACL surface the SDK talks to: domain source + validity check.
contract LegacyMockACLV2 is LegacyMockPermissionedV2 {
  function exists() public pure returns (bool) {
    return true;
  }

  function checkPermitValidity(Permission memory permission) public view withPermission(permission) returns (bool) {
    return true;
  }
}

library LegacyPermissionUtilsV2 {
  function issuerHash(Permission memory permission) internal pure returns (bytes32) {
    if (permission.recipient == address(0)) return issuerSelfHash(permission);
    return issuerSharedHash(permission);
  }

  function issuerSelfHash(Permission memory permission) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encode(
          keccak256(
            'PermissionedV2IssuerSelf(address issuer,uint64 expiration,address recipient,uint256 validatorId,address validatorContract,bytes32 sealingKey)'
          ),
          permission.issuer,
          permission.expiration,
          permission.recipient,
          permission.validatorId,
          permission.validatorContract,
          permission.sealingKey
        )
      );
  }

  function issuerSharedHash(Permission memory permission) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encode(
          keccak256(
            'PermissionedV2IssuerShared(address issuer,uint64 expiration,address recipient,uint256 validatorId,address validatorContract)'
          ),
          permission.issuer,
          permission.expiration,
          permission.recipient,
          permission.validatorId,
          permission.validatorContract
        )
      );
  }

  function recipientHash(Permission memory permission) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encode(
          keccak256('PermissionedV2Recipient(bytes32 sealingKey,bytes issuerSignature)'),
          permission.sealingKey,
          keccak256(permission.issuerSignature)
        )
      );
  }
}
