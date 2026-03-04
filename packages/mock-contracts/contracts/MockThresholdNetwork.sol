// SPDX-License-Identifier: BSD-3-Clause-Clear
// solhint-disable one-contract-per-file

// NOTE: This file was renamed from `MockQueryDecrypter.sol` to `MockThresholdNetwork.sol`
// to better reflect that it mocks threshold-network-style decryption/sealing behavior
// in local/testing environments.

pragma solidity >=0.8.19 <0.9.0;

import { MockACL } from './MockACL.sol';
import { MockTaskManager } from './MockTaskManager.sol';
import { Permission, MockPermissioned } from './Permissioned.sol';

contract MockThresholdNetwork {
  MockTaskManager public mockTaskManager;
  MockACL public mockAcl;

  error NotAllowed();
  error SealingKeyMissing();
  error SealingKeyInvalid();

  function initialize(address _taskManager, address _acl) public {
    mockTaskManager = MockTaskManager(_taskManager);
    mockAcl = MockACL(_acl);
  }

  // EXISTENCE

  function exists() public pure returns (bool) {
    return true;
  }

  // BODY

  function queryDecrypt(
    uint256 ctHash,
    uint256,
    Permission memory permission
  ) public view returns (bool allowed, string memory error, uint256) {
    bool isAllowed;
    try mockAcl.isAllowedWithPermission(permission, ctHash) returns (bool _isAllowed) {
      isAllowed = _isAllowed;
    } catch Error(string memory reason) {
      // Handle string error messages
      return (false, reason, 0);
    } catch Panic(uint /*errorCode*/) {
      // Handle panic errors
      return (false, 'Panic', 0);
    } catch (bytes memory lowLevelData) {
      return (false, decodeLowLevelReversion(lowLevelData), 0);
    }

    if (!isAllowed) return (false, 'NotAllowed', 0);

    return (true, '', mockTaskManager.mockStorage(ctHash));
  }

  function seal(uint256 input, bytes32 key) public pure returns (bytes32) {
    return bytes32(input) ^ key;
  }

  function unseal(bytes32 hashed, bytes32 key) public pure returns (uint256) {
    return uint256(hashed ^ key);
  }

  // changed function name from 'testQueryDecrypt'
  // Foundry was trying to run fuzz tests on it
  function mockQueryDecrypt(
    uint256 ctHash,
    uint256,
    address issuer
  ) public view returns (bool allowed, string memory error, uint256) {
    bool isAllowed;
    try mockAcl.isAllowed(ctHash, issuer) returns (bool _isAllowed) {
      isAllowed = _isAllowed;
    } catch Error(string memory reason) {
      // Handle string error messages
      return (false, reason, 0);
    } catch Panic(uint /*errorCode*/) {
      // Handle panic errors
      return (false, 'Panic', 0);
    } catch (bytes memory lowLevelData) {
      return (false, decodeLowLevelReversion(lowLevelData), 0);
    }

    if (!isAllowed) return (false, 'NotAllowed', 0);

    uint256 value = mockTaskManager.mockStorage(ctHash);
    return (true, '', value);
  }

  function querySealOutput(
    uint256 ctHash,
    uint256,
    Permission memory permission
  ) public view returns (bool allowed, string memory error, bytes32) {
    if (permission.sealingKey == bytes32(0)) revert SealingKeyMissing();

    bool isAllowed;
    try mockAcl.isAllowedWithPermission(permission, ctHash) returns (bool _isAllowed) {
      isAllowed = _isAllowed;
    } catch Error(string memory reason) {
      // Handle string error messages
      return (false, reason, bytes32(0));
    } catch Panic(uint /*errorCode*/) {
      // Handle panic errors
      return (false, 'Panic', bytes32(0));
    } catch (bytes memory lowLevelData) {
      return (false, decodeLowLevelReversion(lowLevelData), bytes32(0));
    }

    if (!isAllowed) return (false, 'NotAllowed', bytes32(0));

    uint256 value = mockTaskManager.mockStorage(ctHash);
    return (true, '', seal(value, permission.sealingKey));
  }

  // DECRYPT FOR TX

  function _isAllowedWithPermit(
    uint256 ctHash,
    Permission memory permission
  ) internal view returns (bool isAllowed, string memory error) {
    try mockTaskManager.isAllowedWithPermission(permission, ctHash) returns (bool _isAllowed) {
      isAllowed = _isAllowed;
    } catch Error(string memory reason) {
      return (false, reason);
    } catch Panic(uint /*errorCode*/) {
      return (false, 'Panic');
    } catch (bytes memory lowLevelData) {
      return (false, decodeLowLevelReversion(lowLevelData));
    }

    if (!isAllowed) return (false, 'NotAllowed');
    return (true, '');
  }

  function _isAllowedWithoutPermit(uint256 ctHash) internal view returns (bool isAllowed, string memory error) {
    try mockAcl.globalAllowed(ctHash) returns (bool _isAllowed) {
      isAllowed = _isAllowed;
    } catch Error(string memory reason) {
      return (false, reason);
    } catch Panic(uint /*errorCode*/) {
      return (false, 'Panic');
    } catch (bytes memory lowLevelData) {
      return (false, decodeLowLevelReversion(lowLevelData));
    }

    if (!isAllowed) return (false, 'NotAllowed');
    return (true, '');
  }

  /// @notice Decrypt a ciphertext for a transaction using a permit.
  function decryptForTxWithPermit(
    uint256 ctHash,
    Permission memory permission
  ) public view returns (bool allowed, string memory error, uint256 decryptedValue) {
    if (permission.issuer == address(0)) {
      return (false, 'PermissionMissing', 0);
    }

    (bool isAllowed, string memory err) = _isAllowedWithPermit(ctHash, permission);
    if (!isAllowed) return (false, err, 0);

    uint256 value = mockTaskManager.mockStorage(ctHash);
    return (true, '', value);
  }

  /// @notice Decrypt a ciphertext for a transaction using global allowance (no permit).
  function decryptForTxWithoutPermit(
    uint256 ctHash
  ) public view returns (bool allowed, string memory error, uint256 decryptedValue) {
    (bool isAllowed, string memory err) = _isAllowedWithoutPermit(ctHash);
    if (!isAllowed) return (false, err, 0);

    uint256 value = mockTaskManager.mockStorage(ctHash);
    return (true, '', value);
  }

  // UTIL

  function decodeLowLevelReversion(bytes memory data) public pure returns (string memory error) {
    bytes4 selector = bytes4(data);
    if (selector == MockPermissioned.PermissionInvalid_Expired.selector) {
      return 'PermissionInvalid_Expired';
    }
    if (selector == MockPermissioned.PermissionInvalid_IssuerSignature.selector) {
      return 'PermissionInvalid_IssuerSignature';
    }
    if (selector == MockPermissioned.PermissionInvalid_RecipientSignature.selector) {
      return 'PermissionInvalid_RecipientSignature';
    }
    if (selector == MockPermissioned.PermissionInvalid_Disabled.selector) {
      return 'PermissionInvalid_Disabled';
    }
    // Handle other errors
    return 'Low Level Error';
  }
}
