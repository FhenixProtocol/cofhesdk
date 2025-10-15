// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity >=0.8.25 <0.9.0;

import { Strings } from '@openzeppelin/contracts/utils/Strings.sol';
import { FHE } from '@fhenixprotocol/cofhe-contracts/FHE.sol';
import { FunctionId, Utils } from '@fhenixprotocol/cofhe-contracts/ICofhe.sol';
import { console } from 'hardhat/console.sol';

address constant SIGNER_ADDRESS = 0x6E12D8C87503D4287c294f2Fdef96ACd9DFf6bd2;
uint256 constant SIGNER_PRIVATE_KEY = 49099792800763675079532137679706322989817545357788440619111868498148356080914;

/**
 * @dev Mock implementation of the CoFHE coprocessor, used to test FHE ops in isolation.
 * Is inherited by MockTaskManager.
 *
 * It is responsible for storing a map of ctHash -> value
 * and for performing the operations on the values.
 *
 * It is intended as a 1:1 drop-in replacement for the real CoFHE coprocessor, with the following differences:
 * - AsyncCallbacks are called synchronously (with a mock 1-10 second delay).
 * - Unencrypted values are available onchain via the `mockStorage` map.
 *
 * NOTE: This is not used in production
 */
abstract contract MockCoFHE {
  // Pulled from TMCommon
  uint256 constant uintTypeMask = (type(uint8).max >> 1); // 0x7f - 7 bits reserved for uint type in the one before last byte
  uint256 constant triviallyEncryptedMask = type(uint8).max - uintTypeMask; //0x80  1 bit reserved for isTriviallyEncrypted
  uint256 constant shiftedTypeMask = uintTypeMask << 8; // 0x7f007 bits reserved for uint type in the one before last byte

  bool public logOps = true;

  mapping(uint256 => uint256) public mockStorage;
  mapping(uint256 => bool) public inMockStorage;

  error InputNotInMockStorage(uint256 ctHash);

  // Used internally to check if we missed any operations in the mocks
  error InvalidUnaryOperation(string operation);
  error InvalidTwoInputOperation(string operation);
  error InvalidThreeInputOperation(string operation);

  // OPTIONS

  function setLogOps(bool _logOps) public {
    logOps = _logOps;
  }

  // Utils

  function getUintTypeFromHash(uint256 hash) internal pure returns (uint8) {
    return uint8((hash & shiftedTypeMask) >> 8);
  }

  function getUtypeStringFromHash(uint256 hash) internal pure returns (string memory) {
    uint8 inputType = getUintTypeFromHash(hash);
    if (inputType == Utils.EBOOL_TFHE) return 'ebool';
    if (inputType == Utils.EUINT8_TFHE) return 'euint8';
    if (inputType == Utils.EUINT16_TFHE) return 'euint16';
    if (inputType == Utils.EUINT32_TFHE) return 'euint32';
    if (inputType == Utils.EUINT64_TFHE) return 'euint64';
    if (inputType == Utils.EUINT128_TFHE) return 'euint128';
    if (inputType == Utils.EUINT256_TFHE) return 'euint256';
    if (inputType == Utils.EADDRESS_TFHE) return 'eaddress';
    return 'unknown';
  }

  function getUtypeBits(uint256 hash) internal pure returns (uint256) {
    uint8 inputType = getUintTypeFromHash(hash);
    if (inputType == Utils.EBOOL_TFHE) return 8;
    if (inputType == Utils.EUINT8_TFHE) return 8;
    if (inputType == Utils.EUINT16_TFHE) return 16;
    if (inputType == Utils.EUINT32_TFHE) return 32;
    if (inputType == Utils.EUINT64_TFHE) return 64;
    if (inputType == Utils.EUINT128_TFHE) return 128;
    if (inputType == Utils.EUINT256_TFHE) return 256;
    if (inputType == Utils.EADDRESS_TFHE) return 160;
    return 0;
  }

  function getUtypeMask(uint256 hash) internal pure returns (uint256) {
    uint256 bits = getUtypeBits(hash);
    unchecked {
      return (1 << bits) - 1;
    }
  }

  function removeFirstLetter(string memory str) public pure returns (string memory) {
    bytes memory strBytes = bytes(str);
    if (strBytes.length == 0) return '';
    bytes memory result = new bytes(strBytes.length - 1);
    for (uint i = 1; i < strBytes.length; i++) {
      result[i - 1] = strBytes[i];
    }
    return string(result);
  }

  function getIsBoolTypeFromHash(uint256 hash) internal pure returns (bool) {
    uint8 inputType = getUintTypeFromHash(hash);
    return (inputType ^ Utils.EBOOL_TFHE) == 0;
  }

  function strEq(string memory _a, string memory _b) internal pure returns (bool) {
    return keccak256(abi.encodePacked(_a)) == keccak256(abi.encodePacked(_b));
  }

  function opIs(string memory op, FunctionId fid) internal pure returns (bool) {
    return strEq(op, Utils.functionIdToString(fid));
  }

  function sliceString(string memory str, uint start, uint length) public pure returns (string memory) {
    bytes memory strBytes = bytes(str);
    require(start + length <= strBytes.length, 'Out of bounds');

    bytes memory result = new bytes(length);
    for (uint i = 0; i < length; i++) {
      result[i] = strBytes[start + i];
    }

    return string(result);
  }

  function logCtHash(uint256 ctHash) internal view returns (string memory) {
    string memory hashStr = Strings.toString(ctHash);
    uint256 length = bytes(hashStr).length;
    if (length <= 6) {
      return hashStr;
    }

    bool stored = inMockStorage[ctHash];
    uint256 value = mockStorage[ctHash];
    bool isBool = getIsBoolTypeFromHash(ctHash);

    string memory valueString = isBool ? (value == 1 ? 'true' : 'false') : Strings.toString(value);

    string memory truncated = string.concat(
      getUtypeStringFromHash(ctHash),
      '(',
      sliceString(hashStr, 0, 4),
      '..',
      sliceString(hashStr, length - 4, 4),
      ')[',
      stored ? valueString : 'EMPTY',
      ']'
    );

    return truncated;
  }

  string constant LOG_PREFIX = unicode'├ ';
  string constant LOG_DIVIDER = unicode' | ';

  function padRight(string memory input, uint256 length, bytes1 padChar) internal pure returns (string memory) {
    bytes memory inputBytes = bytes(input);
    if (inputBytes.length >= length) return input;

    bytes memory padded = new bytes(length);
    uint256 i = 0;
    for (; i < inputBytes.length; i++) {
      padded[i] = inputBytes[i];
    }
    for (; i < length; i++) {
      padded[i] = padChar;
    }
    return string(padded);
  }

  function logOperation(string memory operation, string memory inputs, string memory output) internal view {
    if (logOps)
      console.log(string.concat(LOG_PREFIX, padRight(operation, 16, ' '), LOG_DIVIDER, inputs, '  =>  ', output));
  }

  function logAllow(string memory operation, uint256 ctHash, address account) internal view {
    if (logOps)
      console.log(
        string.concat(
          LOG_PREFIX,
          padRight(operation, 16, ' '),
          LOG_DIVIDER,
          logCtHash(ctHash),
          ' -> ',
          Strings.toHexString(account)
        )
      );
  }

  // Storage functions

  function _set(uint256 ctHash, uint256 value, bool log) internal {
    mockStorage[ctHash] = value;
    inMockStorage[ctHash] = true;

    if (log) logOperation('set', '', logCtHash(ctHash));
  }

  function _set(uint256 ctHash, uint256 value) internal {
    uint256 mask = getUtypeMask(ctHash);
    _set(ctHash, value & mask, false);
  }

  function _set(uint256 ctHash, bool value) internal {
    _set(ctHash, value ? 1 : 0);
  }

  function _get(uint256 ctHash) internal view returns (uint256) {
    if (!inMockStorage[ctHash]) revert InputNotInMockStorage(ctHash);

    uint256 mask = getUtypeMask(ctHash);
    return mockStorage[ctHash] & mask;
  }

  // Public functions

  function MOCK_setInEuintKey(uint256 ctHash, uint256 value) public {
    _set(ctHash, value);
  }

  // Mock Log

  function MOCK_logAllow(string memory operation, uint256 ctHash, address account) public view {
    logAllow(operation, ctHash, account);
  }

  // Mock functions

  function MOCK_verifyKeyInStorage(uint256 ctHash) internal view {
    if (!inMockStorage[ctHash]) revert InputNotInMockStorage(ctHash);
  }

  function MOCK_unaryOperation(uint256 ctHash, string memory operation, uint256 input) internal {
    if (opIs(operation, FunctionId.random)) {
      _set(ctHash, uint256(blockhash(block.number - 1)));
      logOperation('FHE.random', '', logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.cast)) {
      _set(ctHash, _get(input));
      logOperation('FHE.cast', logCtHash(input), logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.not)) {
      bool inputIsTruthy = _get(input) == 1;
      _set(ctHash, !inputIsTruthy);
      logOperation('FHE.not', logCtHash(input), logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.square)) {
      unchecked {
        _set(ctHash, _get(input) * _get(input));
      }
      logOperation('FHE.square', string.concat(logCtHash(input), ' * ', logCtHash(input)), logCtHash(ctHash));
      return;
    }
    revert InvalidUnaryOperation(operation);
  }

  function MOCK_twoInputOperation(uint256 ctHash, string memory operation, uint256 input1, uint256 input2) internal {
    if (opIs(operation, FunctionId.sub)) {
      unchecked {
        _set(ctHash, _get(input1) - _get(input2));
      }
      logOperation('FHE.sub', string.concat(logCtHash(input1), ' - ', logCtHash(input2)), logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.add)) {
      unchecked {
        _set(ctHash, _get(input1) + _get(input2));
      }
      logOperation('FHE.add', string.concat(logCtHash(input1), ' + ', logCtHash(input2)), logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.xor)) {
      unchecked {
        _set(ctHash, _get(input1) ^ _get(input2));
      }
      logOperation('FHE.xor', string.concat(logCtHash(input1), ' ^ ', logCtHash(input2)), logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.and)) {
      unchecked {
        _set(ctHash, _get(input1) & _get(input2));
      }
      logOperation('FHE.and', string.concat(logCtHash(input1), ' & ', logCtHash(input2)), logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.or)) {
      unchecked {
        _set(ctHash, _get(input1) | _get(input2));
      }
      logOperation('FHE.or', string.concat(logCtHash(input1), ' | ', logCtHash(input2)), logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.div)) {
      uint256 cleartext2 = _get(input2);
      if (cleartext2 == 0) {
        _set(ctHash, type(uint256).max);
      } else {
        unchecked {
          _set(ctHash, _get(input1) / cleartext2);
        }
      }
      logOperation('FHE.div', string.concat(logCtHash(input1), ' / ', logCtHash(input2)), logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.rem)) {
      unchecked {
        _set(ctHash, _get(input1) % _get(input2));
      }
      logOperation('FHE.rem', string.concat(logCtHash(input1), ' % ', logCtHash(input2)), logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.mul)) {
      unchecked {
        _set(ctHash, _get(input1) * _get(input2));
      }
      logOperation('FHE.mul', string.concat(logCtHash(input1), ' * ', logCtHash(input2)), logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.shl)) {
      unchecked {
        _set(ctHash, _get(input1) << _get(input2));
      }
      logOperation('FHE.shl', string.concat(logCtHash(input1), ' << ', logCtHash(input2)), logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.shr)) {
      unchecked {
        _set(ctHash, _get(input1) >> _get(input2));
      }
      logOperation('FHE.shr', string.concat(logCtHash(input1), ' >> ', logCtHash(input2)), logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.gte)) {
      _set(ctHash, _get(input1) >= _get(input2));
      logOperation('FHE.gte', string.concat(logCtHash(input1), ' >= ', logCtHash(input2)), logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.lte)) {
      _set(ctHash, _get(input1) <= _get(input2));
      logOperation('FHE.lte', string.concat(logCtHash(input1), ' <= ', logCtHash(input2)), logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.lt)) {
      _set(ctHash, _get(input1) < _get(input2));
      logOperation('FHE.lt', string.concat(logCtHash(input1), ' < ', logCtHash(input2)), logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.gt)) {
      _set(ctHash, _get(input1) > _get(input2));
      logOperation('FHE.gt', string.concat(logCtHash(input1), ' > ', logCtHash(input2)), logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.min)) {
      uint256 min;
      unchecked {
        min = _get(input1) < _get(input2) ? _get(input1) : _get(input2);
      }
      _set(ctHash, min);

      logOperation(
        'FHE.min',
        string.concat('min(', logCtHash(input1), ', ', logCtHash(input2), ')'),
        logCtHash(ctHash)
      );
      return;
    }
    if (opIs(operation, FunctionId.max)) {
      uint256 max;
      unchecked {
        max = _get(input1) > _get(input2) ? _get(input1) : _get(input2);
      }
      _set(ctHash, max);

      logOperation(
        'FHE.max',
        string.concat('max(', logCtHash(input1), ', ', logCtHash(input2), ')'),
        logCtHash(ctHash)
      );
      return;
    }
    if (opIs(operation, FunctionId.eq)) {
      _set(ctHash, _get(input1) == _get(input2));

      logOperation('FHE.eq', string.concat(logCtHash(input1), ' == ', logCtHash(input2)), logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.ne)) {
      _set(ctHash, _get(input1) != _get(input2));

      logOperation('FHE.ne', string.concat(logCtHash(input1), ' != ', logCtHash(input2)), logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.rol)) {
      unchecked {
        _set(ctHash, _get(input1) << _get(input2));
      }

      logOperation('FHE.rol', string.concat(logCtHash(input1), ' << ', logCtHash(input2)), logCtHash(ctHash));
      return;
    }
    if (opIs(operation, FunctionId.ror)) {
      unchecked {
        _set(ctHash, _get(input1) >> _get(input2));
      }

      logOperation('FHE.ror', string.concat(logCtHash(input1), ' >> ', logCtHash(input2)), logCtHash(ctHash));
      return;
    }
    revert InvalidTwoInputOperation(operation);
  }

  function MOCK_threeInputOperation(
    uint256 ctHash,
    string memory operation,
    uint256 input1,
    uint256 input2,
    uint256 input3
  ) internal {
    if (opIs(operation, FunctionId.trivialEncrypt)) {
      _set(ctHash, input1);

      logOperation(
        string.concat('FHE.asE', removeFirstLetter(getUtypeStringFromHash(ctHash))),
        string.concat(removeFirstLetter(getUtypeStringFromHash(ctHash)), '(', Strings.toString(input1), ')'),
        logCtHash(ctHash)
      );
      return;
    }
    if (opIs(operation, FunctionId.select)) {
      _set(ctHash, _get(input1) == 1 ? _get(input2) : _get(input3));

      logOperation(
        'FHE.select',
        string.concat(logCtHash(input1), ' ? ', logCtHash(input2), ' : ', logCtHash(input3)),
        logCtHash(ctHash)
      );
      return;
    }
    revert InvalidThreeInputOperation(operation);
  }
}
