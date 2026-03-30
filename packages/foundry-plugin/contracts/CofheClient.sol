// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { Test } from 'forge-std/Test.sol';
import { MessageHashUtils } from '@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol';
import '@fhenixprotocol/cofhe-contracts/FHE.sol';
import { MockTaskManager } from '@cofhe/mock-contracts/contracts/MockTaskManager.sol';
import { MockACL } from '@cofhe/mock-contracts/contracts/MockACL.sol';
import { MockZkVerifier } from '@cofhe/mock-contracts/contracts/MockZkVerifier.sol';
import { MockZkVerifierSigner } from './MockZkVerifierSigner.sol';
import { MockThresholdNetwork } from '@cofhe/mock-contracts/contracts/MockThresholdNetwork.sol';
import { MockThresholdNetworkSigner } from './MockThresholdNetworkSigner.sol';
import { Permission, PermissionUtils } from '@cofhe/mock-contracts/contracts/Permissioned.sol';
import { ZK_VERIFIER_SIGNER_ADDRESS, DECRYPT_RESULT_SIGNER_ADDRESS } from '@cofhe/mock-contracts/contracts/MockCoFHE.sol';

/// @notice Portable representation of the issuer's half of a shared permit, safe to transmit as cleartext.
struct SharedPermitExport {
  address issuer;
  uint64 expiration;
  address recipient;
  uint256 validatorId;
  address validatorContract;
  bytes issuerSignature;
}

/// @notice SDK-like client for Foundry tests. Mirrors the JS SDK's `createCofheClient` pattern.
/// @dev    Must be deployed via `CofheTestUtils.createCofheClient()` after `deployMocks()`.
///         Call `connect(pkey)` before using any other function.
contract CofheClient is Test {
  // Keep in sync with `packages/sdk/core/consts.ts`
  address constant ZK_VERIFIER_ADDRESS = 0x0000000000000000000000000000000000005001;
  address constant THRESHOLD_NETWORK_ADDRESS = 0x0000000000000000000000000000000000005002;

  MockTaskManager public mockTaskManager;
  MockACL public mockAcl;
  MockZkVerifier public mockZkVerifier;
  MockZkVerifierSigner public mockZkVerifierSigner;
  MockThresholdNetwork public mockThresholdNetwork;
  MockThresholdNetworkSigner public mockThresholdNetworkSigner;

  uint256 private _pkey;
  address private _account;
  bool private _connected;

  constructor() {
    mockTaskManager = MockTaskManager(TASK_MANAGER_ADDRESS);
    mockAcl = MockACL(address(mockTaskManager.acl()));
    mockZkVerifier = MockZkVerifier(ZK_VERIFIER_ADDRESS);
    mockZkVerifierSigner = MockZkVerifierSigner(ZK_VERIFIER_SIGNER_ADDRESS);
    mockThresholdNetwork = MockThresholdNetwork(THRESHOLD_NETWORK_ADDRESS);
    mockThresholdNetworkSigner = MockThresholdNetworkSigner(DECRYPT_RESULT_SIGNER_ADDRESS);
  }

  modifier onlyConnected() {
    require(_connected, 'CofheClient: not connected');
    _;
  }

  /// @notice Returns the address derived from the connected private key.
  function account() public view onlyConnected returns (address) {
    return _account;
  }

  /// @notice Stores the private key, derives the account address, and marks the client as connected.
  function connect(uint256 pkey) public {
    _pkey = pkey;
    _account = vm.addr(pkey);
    _connected = true;
  }

  // =====================
  //       ENCRYPT
  // =====================

  /// @notice Creates a signed encrypted input for the connected account (security zone 0).
  function createEncryptedInput(
    uint8 utype,
    uint256 value
  ) internal onlyConnected returns (EncryptedInput memory input) {
    input = mockZkVerifier.zkVerify(value, utype, _account, 0, block.chainid);
    input = mockZkVerifierSigner.zkVerifySign(input, _account);
  }

  /// @notice Creates an encrypted boolean input.
  function createInEbool(bool value) public returns (InEbool memory) {
    return abi.decode(abi.encode(createEncryptedInput(Utils.EBOOL_TFHE, value ? 1 : 0)), (InEbool));
  }

  /// @notice Creates an encrypted uint8 input.
  function createInEuint8(uint8 value) public returns (InEuint8 memory) {
    return abi.decode(abi.encode(createEncryptedInput(Utils.EUINT8_TFHE, value)), (InEuint8));
  }

  /// @notice Creates an encrypted uint16 input.
  function createInEuint16(uint16 value) public returns (InEuint16 memory) {
    return abi.decode(abi.encode(createEncryptedInput(Utils.EUINT16_TFHE, value)), (InEuint16));
  }

  /// @notice Creates an encrypted uint32 input.
  function createInEuint32(uint32 value) public returns (InEuint32 memory) {
    return abi.decode(abi.encode(createEncryptedInput(Utils.EUINT32_TFHE, value)), (InEuint32));
  }

  /// @notice Creates an encrypted uint64 input.
  function createInEuint64(uint64 value) public returns (InEuint64 memory) {
    return abi.decode(abi.encode(createEncryptedInput(Utils.EUINT64_TFHE, value)), (InEuint64));
  }

  /// @notice Creates an encrypted uint128 input.
  function createInEuint128(uint128 value) public returns (InEuint128 memory) {
    return abi.decode(abi.encode(createEncryptedInput(Utils.EUINT128_TFHE, value)), (InEuint128));
  }

  /// @notice Creates an encrypted address input.
  function createInEaddress(address value) public returns (InEaddress memory) {
    return abi.decode(abi.encode(createEncryptedInput(Utils.EADDRESS_TFHE, uint256(uint160(value)))), (InEaddress));
  }

  // =====================
  //    DECRYPT FOR TX
  // =====================

  /// @notice Decrypts a globally-allowed ciphertext and returns the plaintext with a publishable signature.
  function decryptForTx_withoutPermit(
    bytes32 ctHash
  ) public view onlyConnected returns (bytes32, uint256, bytes memory) {
    uint256 ct = uint256(ctHash);

    (bool allowed, string memory error, uint256 decryptedValue) = mockThresholdNetwork.decryptForTxWithoutPermit(ct);
    require(allowed, string.concat('CofheClient: decryptForTx failed: ', error));

    bytes memory signature = mockThresholdNetworkSigner.signDecryptResult(ct, decryptedValue);
    return (ctHash, decryptedValue, signature);
  }

  /// @notice Decrypts a ciphertext using a permit and returns the plaintext with a publishable signature.
  function decryptForTx_withPermit(
    bytes32 ctHash,
    Permission memory permission
  ) public view onlyConnected returns (bytes32, uint256, bytes memory) {
    uint256 ct = uint256(ctHash);

    (bool allowed, string memory error, uint256 decryptedValue) = mockThresholdNetwork.decryptForTxWithPermit(
      ct,
      permission
    );
    require(allowed, string.concat('CofheClient: decryptForTx failed: ', error));

    bytes memory signature = mockThresholdNetworkSigner.signDecryptResult(ct, decryptedValue);
    return (ctHash, decryptedValue, signature);
  }

  // =====================
  //   DECRYPT FOR VIEW
  // =====================

  /// @notice Decrypts a ciphertext for off-chain reading by sealing/unsealing with the permit's sealing key.
  function decryptForView(
    bytes32 ctHash,
    bytes32 sealingKey,
    Permission memory permission
  ) public view onlyConnected returns (uint256) {
    uint256 ct = uint256(ctHash);

    (bool allowed, string memory error, bytes32 sealedOutput) = mockThresholdNetwork.querySealOutput(
      ct,
      block.chainid,
      permission
    );
    require(allowed, string.concat('CofheClient: decryptForView failed: ', error));

    return mockThresholdNetwork.unseal(sealedOutput, sealingKey);
  }

  // =====================
  //      PERMITS
  // =====================

  bytes32 private constant PERMISSION_TYPE_HASH =
    keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');

  function permissionDomainSeparator() internal view returns (bytes32) {
    string memory name;
    string memory version;
    uint256 chainId;
    address verifyingContract;

    (, name, version, chainId, verifyingContract, , ) = mockAcl.eip712Domain();

    return
      keccak256(
        abi.encode(PERMISSION_TYPE_HASH, keccak256(bytes(name)), keccak256(bytes(version)), chainId, verifyingContract)
      );
  }

  /// @notice Wraps a struct hash into a full EIP-712 typed data hash using the ACL's domain separator.
  function permissionHashTypedDataV4(bytes32 structHash) public view returns (bytes32) {
    return MessageHashUtils.toTypedDataHash(permissionDomainSeparator(), structHash);
  }

  function _signPermission(bytes32 structHash, uint256 pkey) internal pure returns (bytes memory signature) {
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(pkey, structHash);
    return abi.encodePacked(r, s, v);
  }

  function _signIssuerSelf(Permission memory permission, uint256 pkey) internal view returns (Permission memory) {
    bytes32 permissionHash = PermissionUtils.issuerSelfHash(permission);
    bytes32 structHash = permissionHashTypedDataV4(permissionHash);
    permission.issuerSignature = _signPermission(structHash, pkey);
    return permission;
  }

  function _signIssuerShared(Permission memory permission, uint256 pkey) internal view returns (Permission memory) {
    bytes32 permissionHash = PermissionUtils.issuerSharedHash(permission);
    bytes32 structHash = permissionHashTypedDataV4(permissionHash);
    permission.issuerSignature = _signPermission(structHash, pkey);
    return permission;
  }

  function _signRecipient(Permission memory permission, uint256 pkey) internal view returns (Permission memory) {
    bytes32 permissionHash = PermissionUtils.recipientHash(permission);
    bytes32 structHash = permissionHashTypedDataV4(permissionHash);
    permission.recipientSignature = _signPermission(structHash, pkey);
    return permission;
  }

  /// @notice Returns a blank Permission with default field values.
  function createBasePermission() public pure returns (Permission memory permission) {
    permission = Permission({
      issuer: address(0),
      expiration: 1000000000000,
      recipient: address(0),
      validatorId: 0,
      validatorContract: address(0),
      sealingKey: bytes32(0),
      issuerSignature: new bytes(0),
      recipientSignature: new bytes(0)
    });
  }

  /// @notice Derives a deterministic sealing key from a seed.
  function createSealingKey(uint256 seed) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(seed));
  }

  /// @notice Creates a self-permit for the connected account, signed with the stored private key.
  function permit_createSelf() public view onlyConnected returns (Permission memory permission) {
    permission = createBasePermission();
    permission.issuer = _account;
    permission.sealingKey = createSealingKey(uint256(uint160(_account)));
    permission = _signIssuerSelf(permission, _pkey);
  }

  /// @notice Creates the issuer side of a shared permit. The result has no sealingKey (added by recipient on import).
  function permit_createShared(address recipient) public view onlyConnected returns (Permission memory permission) {
    permission = createBasePermission();
    permission.issuer = _account;
    permission.recipient = recipient;
    permission = _signIssuerShared(permission, _pkey);
  }

  /// @notice Exports a shared permit, stripping sensitive/recipient-specific fields.
  function permit_exportShared(Permission memory permission) public pure returns (SharedPermitExport memory exported) {
    exported = SharedPermitExport({
      issuer: permission.issuer,
      expiration: permission.expiration,
      recipient: permission.recipient,
      validatorId: permission.validatorId,
      validatorContract: permission.validatorContract,
      issuerSignature: permission.issuerSignature
    });
  }

  /// @notice Imports a shared permit export, adds the recipient's sealing key and signature.
  function permit_importShared(
    SharedPermitExport memory data
  ) public view onlyConnected returns (Permission memory permission) {
    require(data.recipient == _account, 'CofheClient: recipient mismatch');

    permission = Permission({
      issuer: data.issuer,
      expiration: data.expiration,
      recipient: data.recipient,
      validatorId: data.validatorId,
      validatorContract: data.validatorContract,
      sealingKey: createSealingKey(uint256(uint160(_account))),
      issuerSignature: data.issuerSignature,
      recipientSignature: new bytes(0)
    });
    permission = _signRecipient(permission, _pkey);
  }
}
