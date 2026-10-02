// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import { CofheTest } from '../contracts/CofheTest.sol';
import { ACP } from '@cofhe/mock-contracts/contracts/Permissioned.sol';
import { ACPShareRegistry } from '@cofhe/mock-contracts/contracts/ACPShareRegistry.sol';

/// @notice The share registry the mocks deploy is cofhe-contracts' own, behind a proxy and wired into the ACL.
contract ACPShareRegistryTest is CofheTest {
  address private constant ISSUER = address(0xB0B);
  address private constant RECIPIENT = address(0xA11CE);

  function setUp() public {
    deployMocks();
  }

  function sampleAcp() private pure returns (ACP memory acp) {
    acp.issuer = ISSUER;
    acp.expiration = 4102444800;
    acp.recipient = RECIPIENT;
    acp.scope = 2;
    acp.handles = new bytes32[](1);
    acp.handles[0] = keccak256('handle');
    acp.issuerSignature = hex'11';
  }

  function testServedByTheAcl() public view {
    assertEq(mockAcl.shareRegistry(), address(acpShareRegistry));
  }

  function testInitializedBehindTheProxy() public {
    assertTrue(acpShareRegistry.hasRole(acpShareRegistry.UPGRADER_ROLE(), address(this)));
    vm.expectRevert();
    acpShareRegistry.initialize(address(this));
  }

  function testSharesAndLists() public {
    ACP memory acp = sampleAcp();
    vm.prank(ISSUER);
    bytes32 shareId = acpShareRegistry.share(acp, hex'03');

    assertEq(shareId, keccak256(abi.encode(acp)));
    (bytes32[] memory ids, ACPShareRegistry.ShareHead[] memory heads) = acpShareRegistry.sharesFor(RECIPIENT);
    assertEq(ids.length, 1);
    assertEq(ids[0], shareId);
    assertEq(heads[0].issuer, ISSUER);
    assertEq(heads[0].blockNumber, block.number);
    assertTrue(acpShareRegistry.isShareValid(shareId));
  }
}
