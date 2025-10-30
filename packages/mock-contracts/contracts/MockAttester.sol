// SPDX-License-Identifier: BSD-3-Clause-Clear
// solhint-disable one-contract-per-file

pragma solidity >=0.8.19 <0.9.0;

import { TASK_MANAGER_ADDRESS } from './cofhe/FHE.sol';
import { EncryptedInput, FunctionId } from './cofhe/ICofhe.sol';
import { MockTaskManager } from './MockTaskManager.sol';

contract MockAttester {
  MockTaskManager public mockTaskManager;
  error InvalidAttestationFunction(FunctionId functionId);

  function _attestPlaintextPlaintext(
    uint256 lhsPlaintext,
    uint256 rhsPlaintext,
    FunctionId functionId
  ) internal pure returns (bool) {
    if (functionId == FunctionId.gte) return lhsPlaintext >= rhsPlaintext;
    if (functionId == FunctionId.lte) return lhsPlaintext <= rhsPlaintext;
    if (functionId == FunctionId.lt) return lhsPlaintext < rhsPlaintext;
    if (functionId == FunctionId.gt) return lhsPlaintext > rhsPlaintext;
    if (functionId == FunctionId.eq) return lhsPlaintext == rhsPlaintext;
    if (functionId == FunctionId.ne) return lhsPlaintext != rhsPlaintext;
    revert InvalidAttestationFunction(functionId);
  }

  function attestPlaintextEncrypted(
    uint256 lhsPlaintext,
    uint256 rhsHash,
    FunctionId functionId
  ) public view returns (bool success, bytes memory proof) {
    uint256 rhsPlaintext = mockTaskManager.mockStorage(rhsHash);
    success = _attestPlaintextPlaintext(lhsPlaintext, rhsPlaintext, functionId);
    if (!success) return (false, '');
    return (true, abi.encodePacked(lhsPlaintext, rhsPlaintext, functionId));
  }

  function attestEncryptedEncrypted(
    uint256 lhsHash,
    uint256 rhsHash,
    FunctionId functionId
  ) public view returns (bool success, bytes memory proof) {
    uint256 lhsPlaintext = mockTaskManager.mockStorage(lhsHash);
    uint256 rhsPlaintext = mockTaskManager.mockStorage(rhsHash);
    success = _attestPlaintextPlaintext(lhsPlaintext, rhsPlaintext, functionId);
    if (!success) return (false, '');
    return (true, abi.encodePacked(lhsHash, rhsHash, functionId));
  }

  function validateAttestation(
    uint256 lhs,
    uint256 rhs,
    FunctionId functionId,
    bytes memory proof
  ) public view returns (bool isValid) {
    try mockTaskManager.checkAttestationProof(lhs, rhs, functionId, proof) returns (bool valid) {
      return valid;
    } catch {
      return false;
    }
  }
}
