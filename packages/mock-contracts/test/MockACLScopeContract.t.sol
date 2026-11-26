// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.25;

import { Test } from 'forge-std/Test.sol';
import { MessageHashUtils } from '@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol';
import { MockACL } from '../contracts/MockACL.sol';
import { ACP, ACPUtils, SCOPE_CONTRACT } from '../contracts/Permissioned.sol';

/// Acts as the Task Manager. Grants and the permission check happen inside ONE call,
/// so transient allowances are guaranteed to be visible to the check.
contract TaskManagerHarness {
  MockACL public immutable acl;

  constructor(MockACL acl_) {
    acl = acl_;
  }

  function globalHandle(ACP memory acp, uint256 h) external returns (bool) {
    acl.allowTransient(h, acp.issuer, address(this));
    acl.allowGlobal(h, acp.issuer);
    return acl.isAllowedWithPermission(acp, h);
  }

  function transientConsumer(ACP memory acp, uint256 h, address consumer) external returns (bool) {
    acl.allowTransient(h, acp.issuer, address(this));
    acl.allow(h, acp.issuer, acp.issuer); // persist for the issuer only
    acl.allowTransient(h, consumer, address(this)); // consumer: transient only
    return acl.isAllowedWithPermission(acp, h);
  }

  function persistedConsumer(ACP memory acp, uint256 h, address consumer) external returns (bool) {
    acl.allowTransient(h, acp.issuer, address(this));
    acl.allow(h, acp.issuer, acp.issuer);
    acl.allow(h, consumer, acp.issuer); // consumer: persisted
    return acl.isAllowedWithPermission(acp, h);
  }
}

contract MockACLScopeContractTest is Test {
  MockACL acl;
  TaskManagerHarness tm;
  uint256 constant ISSUER_KEY = 0xA11CE;
  address issuer;
  address constant CONSUMER = address(0xdead);

  uint256 constant H_GLOBAL = 0x1100;
  uint256 constant H_PERSISTED = 0x2200;
  uint256 constant H_TRANSIENT = 0x3300;

  function setUp() public {
    issuer = vm.addr(ISSUER_KEY);
    acl = new MockACL();
    tm = new TaskManagerHarness(acl);
    // the mock setter is unrestricted; the harness plays the Task Manager
    acl.setTaskManager(address(tm));
  }

  function _signedContractScopeAcp() internal view returns (ACP memory acp) {
    address[] memory contracts_ = new address[](1);
    contracts_[0] = CONSUMER;

    acp = ACP({
      issuer: issuer,
      expiration: 1000000000000,
      recipient: address(0),
      revokerData: 0,
      revokerContract: address(0),
      scope: SCOPE_CONTRACT,
      contracts: contracts_,
      handles: new bytes32[](0),
      sealingKey: bytes32(uint256(1)),
      issuerSignature: new bytes(0),
      recipientSignature: new bytes(0)
    });

    (, string memory name, string memory version, uint256 chainId, address verifyingContract, , ) = acl
      .eip712Domain();
    bytes32 domainSeparator = keccak256(
      abi.encode(
        keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
        keccak256(bytes(name)),
        keccak256(bytes(version)),
        chainId,
        verifyingContract
      )
    );
    bytes32 digest = MessageHashUtils.toTypedDataHash(domainSeparator, ACPUtils.issuerSelfHash(acp));
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(ISSUER_KEY, digest);
    acp.issuerSignature = abi.encodePacked(r, s, v);
  }

  /// A globally allowed handle must not satisfy SCOPE_CONTRACT for an unrelated contract.
  function test_contractScope_globalHandleDoesNotMatchUnrelatedContract() public {
    assertFalse(tm.globalHandle(_signedContractScopeAcp(), H_GLOBAL));
  }

  /// A transient-only allowance for the listed contract must not count.
  function test_contractScope_transientAllowanceDoesNotCount() public {
    assertFalse(tm.transientConsumer(_signedContractScopeAcp(), H_TRANSIENT, CONSUMER));
  }

  /// A persisted allowance for the listed contract still grants access.
  function test_contractScope_persistedAllowanceGrantsAccess() public {
    assertTrue(tm.persistedConsumer(_signedContractScopeAcp(), H_PERSISTED, CONSUMER));
  }
}
