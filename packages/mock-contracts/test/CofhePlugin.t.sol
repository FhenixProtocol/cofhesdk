// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { Test } from 'forge-std/Test.sol';
import { CofheTest } from '../contracts/foundry/CofheTest.sol';
import { CofheClient, SharedPermitExport } from '../contracts/foundry/CofheClient.sol';
import { Permission } from '../contracts/Permissioned.sol';
import { ZK_VERIFIER_SIGNER_ADDRESS } from '../contracts/MockCoFHE.sol';
import '@fhenixprotocol/cofhe-contracts/FHE.sol';

/// @dev Helper contract that stores encrypted values and exposes ACL operations.
///      Deployed inside tests to act as the "application contract" that manages ciphertext handles.
contract EncryptedValueStore {
  euint32 public storedEuint32;
  ebool public storedEbool;
  euint8 public storedEuint8;
  euint16 public storedEuint16;
  euint64 public storedEuint64;
  euint128 public storedEuint128;
  eaddress public storedEaddress;

  function storeEuint32(InEuint32 memory input) public {
    storedEuint32 = FHE.asEuint32(input);
    FHE.allowThis(storedEuint32);
    FHE.allowSender(storedEuint32);
  }

  function storeEuint32Trivial(uint32 value) public {
    storedEuint32 = FHE.asEuint32(value);
    FHE.allowThis(storedEuint32);
    FHE.allowSender(storedEuint32);
  }

  function storeEbool(InEbool memory input) public {
    storedEbool = FHE.asEbool(input);
    FHE.allowThis(storedEbool);
    FHE.allowSender(storedEbool);
  }

  function storeEuint8(InEuint8 memory input) public {
    storedEuint8 = FHE.asEuint8(input);
    FHE.allowThis(storedEuint8);
    FHE.allowSender(storedEuint8);
  }

  function storeEuint16(InEuint16 memory input) public {
    storedEuint16 = FHE.asEuint16(input);
    FHE.allowThis(storedEuint16);
    FHE.allowSender(storedEuint16);
  }

  function storeEuint64(InEuint64 memory input) public {
    storedEuint64 = FHE.asEuint64(input);
    FHE.allowThis(storedEuint64);
    FHE.allowSender(storedEuint64);
  }

  function storeEuint128(InEuint128 memory input) public {
    storedEuint128 = FHE.asEuint128(input);
    FHE.allowThis(storedEuint128);
    FHE.allowSender(storedEuint128);
  }

  function storeEaddress(InEaddress memory input) public {
    storedEaddress = FHE.asEaddress(input);
    FHE.allowThis(storedEaddress);
    FHE.allowSender(storedEaddress);
  }

  function allowAccount(address account) public {
    FHE.allow(storedEuint32, account);
  }

  function makeGlobal() public {
    FHE.allowGlobal(storedEuint32);
  }

  function publishResult(uint32 result, bytes memory signature) external {
    FHE.publishDecryptResult(storedEuint32, result, signature);
  }

  function getResult() public view returns (uint32) {
    return FHE.getDecryptResult(storedEuint32);
  }

  function getResultSafe() public view returns (uint32 value, bool decrypted) {
    return FHE.getDecryptResultSafe(storedEuint32);
  }
}

// ============================================================
//                    CofheTestUtils Tests
// ============================================================

contract CofheTestUtilsTest is CofheTest {
  function setUp() public {
    deployMocks();
  }

  // --------------- deployMocks ---------------

  function testDeployMocks_contractsExist() public view {
    assertTrue(mockTaskManager.exists());
    assertTrue(mockAcl.exists());
    assertTrue(mockZkVerifier.exists());
    assertTrue(mockThresholdNetwork.exists());
  }

  function testDeployMocks_contractsLinked() public view {
    assertEq(address(mockTaskManager.acl()), address(mockAcl));
    assertEq(address(mockThresholdNetwork.mockTaskManager()), address(mockTaskManager));
    assertEq(address(mockThresholdNetwork.mockAcl()), address(mockAcl));
  }

  function testDeployMocks_signersFunded() public view {
    assertTrue(ZK_VERIFIER_SIGNER_ADDRESS.balance >= 10 ether);
  }

  // --------------- createCofheClient ---------------

  function testCreateCofheClient_returnsValidClient() public {
    CofheClient client = createCofheClient();
    assertTrue(address(client) != address(0));
  }

  // --------------- getPlaintext / expectPlaintext (basic) ---------------

  function testGetPlaintext_storedValue() public {
    euint32 e = FHE.asEuint32(42);
    assertEq(getPlaintext(e), 42);
  }

  // --------------- getPlaintext ---------------

  function testGetPlaintext_bytes32() public {
    euint32 e = FHE.asEuint32(77);
    assertEq(getPlaintext(euint32.unwrap(e)), 77);
  }

  function testGetPlaintext_ebool() public {
    ebool eTrue = FHE.asEbool(true);
    ebool eFalse = FHE.asEbool(false);
    assertTrue(getPlaintext(eTrue));
    assertFalse(getPlaintext(eFalse));
  }

  function testGetPlaintext_euint8() public {
    euint8 e = FHE.asEuint8(200);
    assertEq(getPlaintext(e), 200);
  }

  function testGetPlaintext_euint16() public {
    euint16 e = FHE.asEuint16(50000);
    assertEq(getPlaintext(e), 50000);
  }

  function testGetPlaintext_euint32() public {
    euint32 e = FHE.asEuint32(123456);
    assertEq(getPlaintext(e), 123456);
  }

  function testGetPlaintext_euint64() public {
    euint64 e = FHE.asEuint64(1e18);
    assertEq(getPlaintext(e), uint64(1e18));
  }

  function testGetPlaintext_euint128() public {
    euint128 e = FHE.asEuint128(type(uint128).max);
    assertEq(getPlaintext(e), type(uint128).max);
  }

  function testGetPlaintext_eaddress() public {
    address target = address(0xBEEF);
    eaddress e = FHE.asEaddress(target);
    assertEq(getPlaintext(e), target);
  }

  function testGetPlaintext_reverts_nonExistent() public {
    vm.expectRevert('CofheTest: plaintext does not exist');
    this.getPlaintext(bytes32(uint256(999999)));
  }

  // --------------- expectPlaintext ---------------

  function testExpectPlaintext_withMessage() public {
    euint32 e = FHE.asEuint32(42);
    expectPlaintext(e, uint32(42), 'euint32 should be 42');
  }

  function testExpectPlaintext_ebool() public {
    ebool e = FHE.asEbool(true);
    expectPlaintext(e, true);
  }

  function testExpectPlaintext_euint8() public {
    euint8 e = FHE.asEuint8(255);
    expectPlaintext(e, uint8(255));
  }

  function testExpectPlaintext_euint16() public {
    euint16 e = FHE.asEuint16(1000);
    expectPlaintext(e, uint16(1000));
  }

  function testExpectPlaintext_euint64() public {
    euint64 e = FHE.asEuint64(1e15);
    expectPlaintext(e, uint64(1e15));
  }

  function testExpectPlaintext_euint128() public {
    euint128 e = FHE.asEuint128(1e30);
    expectPlaintext(e, uint128(1e30));
  }

  function testExpectPlaintext_eaddress() public {
    address target = address(0xCAFE);
    eaddress e = FHE.asEaddress(target);
    expectPlaintext(e, target);
  }

  function testExpectPlaintext_ebool_withMessage() public {
    ebool e = FHE.asEbool(false);
    expectPlaintext(e, false, 'should be false');
  }

  function testExpectPlaintext_eaddress_withMessage() public {
    address target = address(0xDEAD);
    eaddress e = FHE.asEaddress(target);
    expectPlaintext(e, target, 'address mismatch');
  }

  // --------------- enableLogs / disableLogs ---------------

  function testEnableLogs_smokeTest() public {
    enableLogs();
    disableLogs();
  }
}

// ============================================================
//                      CofheClient Tests
// ============================================================

contract CofheClientTest is CofheTest {
  CofheClient private cofheClient;
  EncryptedValueStore private store;

  uint256 private constant ALICE_PKEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
  uint256 private constant BOB_PKEY = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
  uint256 private constant CHARLIE_PKEY = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6;

  function setUp() public {
    deployMocks();
    cofheClient = createCofheClient();
    cofheClient.connect(ALICE_PKEY);
    store = new EncryptedValueStore();
  }

  // --------------- connect / account ---------------

  function testConnect_setsAccount() public view {
    address expected = vm.addr(ALICE_PKEY);
    assertEq(cofheClient.account(), expected);
  }

  function testAccount_revertsWhenNotConnected() public {
    CofheClient unconnected = createCofheClient();
    vm.expectRevert('CofheClient: not connected');
    unconnected.account();
  }

  function testConnect_canReconnect() public {
    cofheClient.connect(BOB_PKEY);
    assertEq(cofheClient.account(), vm.addr(BOB_PKEY));
  }

  // --------------- createIn* ---------------

  function testCreateInEbool_true() public {
    InEbool memory input = cofheClient.createInEbool(true);
    vm.prank(cofheClient.account());
    store.storeEbool(input);
    assertTrue(getPlaintext(store.storedEbool()));
  }

  function testCreateInEbool_false() public {
    InEbool memory input = cofheClient.createInEbool(false);
    vm.prank(cofheClient.account());
    store.storeEbool(input);
    assertFalse(getPlaintext(store.storedEbool()));
  }

  function testCreateInEuint8() public {
    InEuint8 memory input = cofheClient.createInEuint8(42);
    vm.prank(cofheClient.account());
    store.storeEuint8(input);
    assertEq(getPlaintext(store.storedEuint8()), 42);
  }

  function testCreateInEuint16() public {
    InEuint16 memory input = cofheClient.createInEuint16(1234);
    vm.prank(cofheClient.account());
    store.storeEuint16(input);
    assertEq(getPlaintext(store.storedEuint16()), 1234);
  }

  function testCreateInEuint32_fuzz(uint32 n) public {
    InEuint32 memory input = cofheClient.createInEuint32(n);
    vm.prank(cofheClient.account());
    store.storeEuint32(input);
    assertEq(getPlaintext(store.storedEuint32()), n);
  }

  function testCreateInEuint64() public {
    uint64 val = 1e18;
    InEuint64 memory input = cofheClient.createInEuint64(val);
    vm.prank(cofheClient.account());
    store.storeEuint64(input);
    assertEq(getPlaintext(store.storedEuint64()), val);
  }

  function testCreateInEuint128() public {
    uint128 val = type(uint128).max;
    InEuint128 memory input = cofheClient.createInEuint128(val);
    vm.prank(cofheClient.account());
    store.storeEuint128(input);
    assertEq(getPlaintext(store.storedEuint128()), val);
  }

  function testCreateInEaddress() public {
    address target = address(0xBEEFCAFE);
    InEaddress memory input = cofheClient.createInEaddress(target);
    vm.prank(cofheClient.account());
    store.storeEaddress(input);
    assertEq(getPlaintext(store.storedEaddress()), target);
  }

  // --------------- decryptForTx_withoutPermit ---------------

  function testDecryptForTx_withoutPermit() public {
    uint32 plainValue = 42;

    vm.prank(cofheClient.account());
    store.storeEuint32Trivial(plainValue);
    store.makeGlobal();

    bytes32 ctHash = euint32.unwrap(store.storedEuint32());
    (bytes32 ct, uint256 decrypted, bytes memory sig) = cofheClient.decryptForTx_withoutPermit(ctHash);

    assertEq(ct, ctHash);
    assertEq(decrypted, plainValue);
    assertTrue(sig.length > 0);
  }

  function testDecryptForTx_withoutPermit_revertsIfNotGlobal() public {
    vm.prank(cofheClient.account());
    store.storeEuint32Trivial(42);

    bytes32 ctHash = euint32.unwrap(store.storedEuint32());
    vm.expectRevert();
    cofheClient.decryptForTx_withoutPermit(ctHash);
  }

  // --------------- decryptForTx_withPermit ---------------

  function testDecryptForTx_withPermit() public {
    uint32 plainValue = 99;

    vm.prank(cofheClient.account());
    store.storeEuint32Trivial(plainValue);
    store.allowAccount(cofheClient.account());

    Permission memory permit = cofheClient.permit_createSelf();
    bytes32 ctHash = euint32.unwrap(store.storedEuint32());

    (bytes32 ct, uint256 decrypted, bytes memory sig) = cofheClient.decryptForTx_withPermit(ctHash, permit);

    assertEq(ct, ctHash);
    assertEq(decrypted, plainValue);
    assertTrue(sig.length > 0);
  }

  function testDecryptForTx_withPermit_revertsWithoutAllow() public {
    // Store as a different address so Alice is NOT in the ACL
    store.storeEuint32Trivial(99);

    Permission memory permit = cofheClient.permit_createSelf();
    bytes32 ctHash = euint32.unwrap(store.storedEuint32());

    vm.expectRevert();
    cofheClient.decryptForTx_withPermit(ctHash, permit);
  }

  // --------------- publishDecryptResult full flow ---------------

  function testPublishDecryptResult_fullFlow() public {
    uint32 plainValue = 55;

    vm.prank(cofheClient.account());
    store.storeEuint32Trivial(plainValue);
    store.makeGlobal();

    bytes32 ctHash = euint32.unwrap(store.storedEuint32());
    (, uint256 decrypted, bytes memory sig) = cofheClient.decryptForTx_withoutPermit(ctHash);

    store.publishResult(uint32(decrypted), sig);

    assertEq(store.getResult(), plainValue);
  }

  function testPublishDecryptResult_getResultSafe() public {
    uint32 plainValue = 77;

    vm.prank(cofheClient.account());
    store.storeEuint32Trivial(plainValue);
    store.makeGlobal();

    // Before publish, getResultSafe should return not-decrypted
    (uint32 valBefore, bool decryptedBefore) = store.getResultSafe();
    assertFalse(decryptedBefore);
    assertEq(valBefore, 0);

    bytes32 ctHash = euint32.unwrap(store.storedEuint32());
    (, uint256 decrypted, bytes memory sig) = cofheClient.decryptForTx_withoutPermit(ctHash);
    store.publishResult(uint32(decrypted), sig);

    (uint32 valAfter, bool decryptedAfter) = store.getResultSafe();
    assertTrue(decryptedAfter);
    assertEq(valAfter, plainValue);
  }

  // --------------- decryptForView ---------------

  function testDecryptForView() public {
    uint32 plainValue = 123;

    vm.prank(cofheClient.account());
    store.storeEuint32Trivial(plainValue);
    store.allowAccount(cofheClient.account());

    Permission memory permit = cofheClient.permit_createSelf();
    bytes32 ctHash = euint32.unwrap(store.storedEuint32());

    uint256 unsealed = cofheClient.decryptForView(ctHash, permit.sealingKey, permit);
    assertEq(unsealed, plainValue);
  }

  function testDecryptForView_revertsWithoutPermission() public {
    // Store as a different address so Alice is NOT in the ACL
    store.storeEuint32Trivial(123);

    Permission memory permit = cofheClient.permit_createSelf();
    bytes32 ctHash = euint32.unwrap(store.storedEuint32());

    vm.expectRevert();
    cofheClient.decryptForView(ctHash, permit.sealingKey, permit);
  }

  // --------------- permit_createSelf ---------------

  function testPermitCreateSelf_isValid() public {
    Permission memory permit = cofheClient.permit_createSelf();

    assertEq(permit.issuer, cofheClient.account());
    assertEq(permit.recipient, address(0));
    assertTrue(permit.sealingKey != bytes32(0));
    assertTrue(permit.issuerSignature.length > 0);

    bool valid = mockAcl.checkPermitValidity(permit);
    assertTrue(valid);
  }

  // --------------- permit_createShared ---------------

  function testPermitCreateShared_isValid() public {
    address bob = vm.addr(BOB_PKEY);
    Permission memory permit = cofheClient.permit_createShared(bob);

    assertEq(permit.issuer, cofheClient.account());
    assertEq(permit.recipient, bob);
    assertEq(permit.sealingKey, bytes32(0));
    assertTrue(permit.issuerSignature.length > 0);
  }

  // --------------- permit_exportShared / permit_importShared ---------------

  function testPermitExportImportShared() public {
    address bob = vm.addr(BOB_PKEY);

    // Alice creates a shared permit for Bob
    Permission memory alicePermit = cofheClient.permit_createShared(bob);
    SharedPermitExport memory exported = cofheClient.permit_exportShared(alicePermit);

    assertEq(exported.issuer, cofheClient.account());
    assertEq(exported.recipient, bob);

    // Bob imports the shared permit
    CofheClient bobClient = createCofheClient();
    bobClient.connect(BOB_PKEY);

    Permission memory bobPermit = bobClient.permit_importShared(exported);

    assertEq(bobPermit.issuer, cofheClient.account());
    assertEq(bobPermit.recipient, bob);
    assertTrue(bobPermit.sealingKey != bytes32(0));
    assertTrue(bobPermit.recipientSignature.length > 0);

    bool valid = mockAcl.checkPermitValidity(bobPermit);
    assertTrue(valid);
  }

  function testPermitImportShared_recipientMismatch_reverts() public {
    address bob = vm.addr(BOB_PKEY);

    // Alice creates a shared permit for Bob
    Permission memory alicePermit = cofheClient.permit_createShared(bob);
    SharedPermitExport memory exported = cofheClient.permit_exportShared(alicePermit);

    // Charlie tries to import Bob's permit
    CofheClient charlieClient = createCofheClient();
    charlieClient.connect(CHARLIE_PKEY);

    vm.expectRevert('CofheClient: recipient mismatch');
    charlieClient.permit_importShared(exported);
  }

  // --------------- Shared permit decrypt flow (end-to-end) ---------------

  function testPermitSharedDecryptFlow() public {
    uint32 plainValue = 200;
    address alice = cofheClient.account();
    address bob = vm.addr(BOB_PKEY);

    // Alice stores an encrypted value and allows herself
    vm.prank(alice);
    store.storeEuint32Trivial(plainValue);
    store.allowAccount(alice);

    // Alice creates a shared permit for Bob
    Permission memory alicePermit = cofheClient.permit_createShared(bob);
    SharedPermitExport memory exported = cofheClient.permit_exportShared(alicePermit);

    // Bob imports the shared permit
    CofheClient bobClient = createCofheClient();
    bobClient.connect(BOB_PKEY);
    Permission memory bobPermit = bobClient.permit_importShared(exported);

    bytes32 ctHash = euint32.unwrap(store.storedEuint32());

    // Bob uses the shared permit to decrypt Alice's data via decryptForView
    uint256 unsealed = bobClient.decryptForView(ctHash, bobPermit.sealingKey, bobPermit);
    assertEq(unsealed, plainValue);
  }

  // --------------- onlyConnected modifier ---------------

  function testCreateInEuint32_revertsWhenNotConnected() public {
    CofheClient unconnected = createCofheClient();
    vm.expectRevert('CofheClient: not connected');
    unconnected.createInEuint32(42);
  }

  function testDecryptForTx_revertsWhenNotConnected() public {
    CofheClient unconnected = createCofheClient();
    vm.expectRevert('CofheClient: not connected');
    unconnected.decryptForTx_withoutPermit(bytes32(uint256(1)));
  }

  function testDecryptForView_revertsWhenNotConnected() public {
    CofheClient unconnected = createCofheClient();
    Permission memory p;
    vm.expectRevert('CofheClient: not connected');
    unconnected.decryptForView(bytes32(uint256(1)), bytes32(uint256(2)), p);
  }

  function testPermitCreateSelf_revertsWhenNotConnected() public {
    CofheClient unconnected = createCofheClient();
    vm.expectRevert('CofheClient: not connected');
    unconnected.permit_createSelf();
  }
}
