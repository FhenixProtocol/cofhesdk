// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import { CofheTest } from '../contracts/CofheTest.sol';

contract MockReinitializationTest is CofheTest {
  function testDeployMocksCanRunTwice() public {
    deployMocks();
    address firstAcl = address(mockAcl);

    deployMocks();

    assertNotEq(address(mockAcl), firstAcl, 'second deployment did not replace the ACL');
    assertEq(address(mockTaskManager.acl()), address(mockAcl), 'TaskManager did not use the new ACL');
    assertEq(address(mockThresholdNetwork.mockAcl()), address(mockAcl), 'threshold network did not use the new ACL');
    assertEq(
      address(mockThresholdNetwork.mockTaskManager()),
      address(mockTaskManager),
      'threshold network did not use the TaskManager'
    );
  }
}
