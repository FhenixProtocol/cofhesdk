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
import {
  ZK_VERIFIER_SIGNER_ADDRESS,
  DECRYPT_RESULT_SIGNER_ADDRESS
} from '@cofhe/mock-contracts/contracts/MockCoFHE.sol';

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
  // Every encryption helper takes the consuming contract explicitly as its last parameter - i.e.
  // the contract that will call `FHE.asEuint*`/`FHE.asEuint*s` with the resulting hashes. The
  // verifier binds this address into the signed digest (cofhe-contracts#77), so a batch signed
  // for one contract cannot be replayed into another. It is a required argument rather than
  // client-level state so that a single test can encrypt for several contracts without a
  // stateful setter to keep track of.

  /// @notice Computes, stores, and signs a single-item encrypted input via the canonical batch
  ///         path (createEncryptedInputsBatch, with a batch of size 1) - the root of all
  ///         encryption helpers on this client, single-item or not.
  function _createSingleEncryptedInput(
    uint8 utype,
    uint256 value,
    address consumingContract
  ) internal onlyConnected returns (uint256 ctHash, bytes memory signature) {
    uint8[] memory utypes = new uint8[](1);
    uint256[] memory values = new uint256[](1);
    utypes[0] = utype;
    values[0] = value;

    (BatchedEncryptedInput[] memory inputs, bytes memory sig) = createEncryptedInputsBatch(
      utypes,
      values,
      consumingContract
    );
    ctHash = inputs[0].ctHash;
    signature = sig;
  }

  /// @notice Creates an encrypted boolean input as hash plus proof, bound to `consumingContract`.
  function createExternalEbool(
    bool value,
    address consumingContract
  ) public returns (externalEbool hash, bytes memory proof) {
    (uint256 ctHash, bytes memory signature) = _createSingleEncryptedInput(
      Utils.EBOOL_TFHE,
      value ? 1 : 0,
      consumingContract
    );
    hash = externalEbool.wrap(bytes32(ctHash));
    proof = signature;
  }

  /// @notice Creates an encrypted uint8 input as hash plus proof, bound to `consumingContract`.
  function createExternalEuint8(
    uint8 value,
    address consumingContract
  ) public returns (externalEuint8 hash, bytes memory proof) {
    (uint256 ctHash, bytes memory signature) = _createSingleEncryptedInput(
      Utils.EUINT8_TFHE,
      value,
      consumingContract
    );
    hash = externalEuint8.wrap(bytes32(ctHash));
    proof = signature;
  }

  /// @notice Creates an encrypted uint16 input as hash plus proof, bound to `consumingContract`.
  function createExternalEuint16(
    uint16 value,
    address consumingContract
  ) public returns (externalEuint16 hash, bytes memory proof) {
    (uint256 ctHash, bytes memory signature) = _createSingleEncryptedInput(
      Utils.EUINT16_TFHE,
      value,
      consumingContract
    );
    hash = externalEuint16.wrap(bytes32(ctHash));
    proof = signature;
  }

  /// @notice Creates an encrypted uint32 input as hash plus proof, bound to `consumingContract`.
  function createExternalEuint32(
    uint32 value,
    address consumingContract
  ) public returns (externalEuint32 hash, bytes memory proof) {
    (uint256 ctHash, bytes memory signature) = _createSingleEncryptedInput(
      Utils.EUINT32_TFHE,
      value,
      consumingContract
    );
    hash = externalEuint32.wrap(bytes32(ctHash));
    proof = signature;
  }

  /// @notice Creates an encrypted uint64 input as hash plus proof, bound to `consumingContract`.
  function createExternalEuint64(
    uint64 value,
    address consumingContract
  ) public returns (externalEuint64 hash, bytes memory proof) {
    (uint256 ctHash, bytes memory signature) = _createSingleEncryptedInput(
      Utils.EUINT64_TFHE,
      value,
      consumingContract
    );
    hash = externalEuint64.wrap(bytes32(ctHash));
    proof = signature;
  }

  /// @notice Creates an encrypted uint128 input as hash plus proof, bound to `consumingContract`.
  function createExternalEuint128(
    uint128 value,
    address consumingContract
  ) public returns (externalEuint128 hash, bytes memory proof) {
    (uint256 ctHash, bytes memory signature) = _createSingleEncryptedInput(
      Utils.EUINT128_TFHE,
      value,
      consumingContract
    );
    hash = externalEuint128.wrap(bytes32(ctHash));
    proof = signature;
  }

  /// @notice Creates an encrypted address input as hash plus proof, bound to `consumingContract`.
  function createExternalEaddress(
    address value,
    address consumingContract
  ) public returns (externalEaddress hash, bytes memory proof) {
    (uint256 ctHash, bytes memory signature) = _createSingleEncryptedInput(
      Utils.EADDRESS_TFHE,
      uint256(uint160(value)),
      consumingContract
    );
    hash = externalEaddress.wrap(bytes32(ctHash));
    proof = signature;
  }

  // =====================
  //   ENCRYPT (BATCH)
  // =====================
  // The canonical batch verification path - a whole batch of inputs authenticated by a single
  // signature over keccak256(h_0 || ... || h_n) (see MockZkVerifierSigner.zkVerifyBatchSign /
  // MockTaskManager.batchVerifyInputs). This is the root of every encryption helper on this
  // client - the single-item createExternalEuintX helpers above are thin wrappers over a batch of
  // size 1, not a separate signing scheme.

  /// @notice Creates a batch of encrypted inputs (mixed utypes allowed) sharing one signature,
  ///         all bound to `consumingContract`.
  function createEncryptedInputsBatch(
    uint8[] memory utypes,
    uint256[] memory values,
    address consumingContract
  ) internal onlyConnected returns (BatchedEncryptedInput[] memory inputs, bytes memory signature) {
    require(utypes.length == values.length, 'CofheClient: length mismatch');
    require(consumingContract != address(0), 'CofheClient: consuming contract must not be the zero address');

    inputs = new BatchedEncryptedInput[](utypes.length);
    for (uint256 i = 0; i < utypes.length; i++) {
      uint256 ctHash = mockZkVerifier.zkVerifyCalcCtHash(values[i], utypes[i], _account, 0, block.chainid);
      mockZkVerifier.insertCtHash(ctHash, values[i]);
      inputs[i] = BatchedEncryptedInput({ ctHash: ctHash, securityZone: 0, utype: utypes[i] });
    }

    signature = mockZkVerifierSigner.zkVerifyBatchSign(inputs, _account, consumingContract);
  }

  /// @notice Creates a batch of encrypted uint32 inputs sharing one signature, all bound to
  ///         `consumingContract`.
  function createEuint32sBatch(
    uint32[] memory values,
    address consumingContract
  ) public returns (externalEuint32[] memory hashes, bytes memory signature) {
    uint8[] memory utypes = new uint8[](values.length);
    uint256[] memory rawValues = new uint256[](values.length);
    for (uint256 i = 0; i < values.length; i++) {
      utypes[i] = Utils.EUINT32_TFHE;
      rawValues[i] = values[i];
    }

    (BatchedEncryptedInput[] memory inputs, bytes memory sig) = createEncryptedInputsBatch(
      utypes,
      rawValues,
      consumingContract
    );

    hashes = new externalEuint32[](inputs.length);
    for (uint256 i = 0; i < inputs.length; i++) {
      hashes[i] = externalEuint32.wrap(bytes32(inputs[i].ctHash));
    }
    signature = sig;
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
  function decryptForView(bytes32 ctHash, Permission memory permission) public view onlyConnected returns (uint256) {
    uint256 ct = uint256(ctHash);

    (bool allowed, string memory error, bytes32 sealedOutput) = mockThresholdNetwork.querySealOutput(
      ct,
      block.chainid,
      permission
    );
    require(allowed, string.concat('CofheClient: decryptForView failed: ', error));

    return mockThresholdNetwork.unseal(sealedOutput, permission.sealingKey);
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
