// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25 <0.9.0;

import { MockACL } from '../contracts/MockACL.sol';
import { MockTaskManager } from '../contracts/MockTaskManager.sol';
import { MockThresholdNetwork } from '../contracts/MockThresholdNetwork.sol';

contract ReinitializerCaller {
  function reinitializeTaskManager(MockTaskManager target, address newOwner) external returns (bool) {
    (bool success, ) = address(target).call(abi.encodeCall(target.initialize, (newOwner)));
    return success;
  }

  function reinitializeThresholdNetwork(
    MockThresholdNetwork target,
    address taskManager,
    address acl
  ) external returns (bool) {
    (bool success, ) = address(target).call(abi.encodeCall(target.initialize, (taskManager, acl)));
    return success;
  }

  function setAggregator(MockTaskManager target, address aggregator) external {
    target.setAggregator(aggregator);
  }
}

contract MockInitializationTest {
  function testNonOwnerCannotReinitializeTaskManager() public {
    MockTaskManager target = new MockTaskManager();
    target.initialize(address(this));

    ReinitializerCaller caller = new ReinitializerCaller();
    bool success = caller.reinitializeTaskManager(target, address(caller));

    require(!success, 'non-owner reinitialized MockTaskManager');
  }

  function testOwnerCanReinitializeTaskManager() public {
    MockTaskManager target = new MockTaskManager();
    ReinitializerCaller owner = new ReinitializerCaller();
    target.initialize(address(owner));

    bool success = owner.reinitializeTaskManager(target, address(owner));
    require(success, 'owner could not reinitialize MockTaskManager');

    owner.setAggregator(target, address(0xBEEF));
    require(target.aggregator() == address(0xBEEF), 'owner lost privileges after reinitialization');
  }

  function testNonOwnerCannotReinitializeThresholdNetwork() public {
    MockTaskManager taskManager = new MockTaskManager();
    MockACL acl = new MockACL();
    MockThresholdNetwork target = new MockThresholdNetwork();
    target.initialize(address(taskManager), address(acl));

    ReinitializerCaller caller = new ReinitializerCaller();
    bool success = caller.reinitializeThresholdNetwork(target, address(0xCAFE), address(0xBEEF));

    require(!success, 'non-owner reinitialized MockThresholdNetwork');
    require(address(target.mockTaskManager()) == address(taskManager), 'task manager changed');
    require(address(target.mockAcl()) == address(acl), 'ACL changed');
  }

  function testOwnerCanReinitializeThresholdNetwork() public {
    MockThresholdNetwork target = new MockThresholdNetwork();
    target.initialize(address(0xCAFE), address(0xBEEF));

    target.initialize(address(0xDEAD), address(0xF00D));

    require(address(target.mockTaskManager()) == address(0xDEAD), 'task manager was not updated');
    require(address(target.mockAcl()) == address(0xF00D), 'ACL was not updated');
  }
}
