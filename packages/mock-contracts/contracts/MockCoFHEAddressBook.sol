// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity >=0.8.19 <0.9.0;

import { ICoFHEAddressBook } from '@fhenixprotocol/cofhe-contracts/ICofhe.sol';

/**
 * @title  MockCoFHEAddressBook
 * @notice Mock of the CoFHEAddressBook: maps a TaskManager id to the TaskManager that FHE.sol
 *         releases pinned to that id talk to. Deployed to `COFHE_ADDRESS_BOOK` (from FHE.sol)
 *         with `hardhat_setCode` / `deployCodeTo`, so no constructor or initializer runs.
 * @dev    The production book is an Ownable2Step UUPS proxy; setters here are unrestricted.
 */
contract MockCoFHEAddressBook is ICoFHEAddressBook {
  mapping(uint256 id => address tm) private taskManagers;

  /// @notice          Emitted when an id is set or unset (`current == address(0)`).
  /// @param id        TaskManager id.
  /// @param previous  Address the id resolved to before, zero if it was unset.
  /// @param current   Address the id resolves to now, zero if it was unset.
  event TaskManagerSet(uint256 indexed id, address indexed previous, address indexed current);

  /// @notice     Returned when an id resolves to nothing.
  /// @param id   TaskManager id.
  error TaskManagerNotSet(uint256 id);

  /// @notice Returned when setting an id to the zero address.
  error InvalidAddress();

  function exists() public pure returns (bool) {
    return true;
  }

  /// @notice     Resolves an id to its TaskManager.
  /// @param id   TaskManager id.
  /// @return tm  The TaskManager address; reverts with {TaskManagerNotSet} when unset.
  function getTm(uint256 id) external view returns (address tm) {
    tm = taskManagers[id];
    if (tm == address(0)) {
      revert TaskManagerNotSet(id);
    }
  }

  /// @notice     Points an id at a TaskManager, replacing any previous target.
  /// @param id   TaskManager id.
  /// @param tm   TaskManager address.
  function setTm(uint256 id, address tm) external {
    if (tm == address(0)) {
      revert InvalidAddress();
    }
    emit TaskManagerSet(id, taskManagers[id], tm);
    taskManagers[id] = tm;
  }

  /// @notice     Retires an id: every FHE.sol build pinned to it reverts from then on.
  /// @param id   TaskManager id.
  function unsetTm(uint256 id) external {
    address previous = taskManagers[id];
    if (previous == address(0)) {
      revert TaskManagerNotSet(id);
    }
    emit TaskManagerSet(id, previous, address(0));
    delete taskManagers[id];
  }
}
