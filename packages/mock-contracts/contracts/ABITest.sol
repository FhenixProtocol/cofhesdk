// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import '@fhenixprotocol/cofhe-contracts/FHE.sol';

contract ABITest {
  euint32 public eNumber;
  uint256 public numberHash;

  euint8 public eUint8;
  euint16 public eUint16;
  euint32 public eUint32;
  euint64 public eUint64;
  euint128 public eUint128;
  ebool public eBool;
  eaddress public eAddress;

  constructor() {
    eUint8 = FHE.asEuint8(1);
    eUint16 = FHE.asEuint16(1);
    eUint32 = FHE.asEuint32(1);
    eUint64 = FHE.asEuint64(1);
    eUint128 = FHE.asEuint128(1);
    eBool = FHE.asEbool(true);
    eAddress = FHE.asEaddress(address(0));
  }

  struct ContainsEncryptedInput {
    uint256 value;
    InEuint32 encryptedInput;
  }

  struct ContainsEncryptedResult {
    uint256 value;
    euint32 encryptedResult;
  }

  // INPUTS

  function fnNoEncryptedInputs(uint8 value) public {}

  function fnEncryptedInput(InEuint32 memory inNumber) public {}

  function fnBlendedInputsIncludingEncryptedInput(uint256 value, InEuint32 memory inNumber) public {}

  function fnAllEncryptedInputs(
    InEuint8 memory inEuint8,
    InEuint16 memory inEuint16,
    InEuint32 memory inEuint32,
    InEuint64 memory inEuint64,
    InEuint128 memory inEuint128,
    InEbool memory inEbool,
    InEaddress memory inEaddress
  ) public {}

  function fnStructContainsEncryptedInput(ContainsEncryptedInput memory containsEncryptedInput) public {}

  function fnArrayContainsEncryptedInput(InEuint32[] memory inEuint32Array) public {}

  function fnTupleContainsEncryptedInput(InEuint32[2] memory inEuint32Array) public {}

  // OUTPUTS

  function fnReturnNoEncrypted() public pure returns (uint256) {
    return 1;
  }

  function fnReturnEncrypted() public view returns (euint32) {
    return eUint32;
  }

  function fnReturnBlendedIncludingEncrypted() public view returns (uint256, euint32) {
    return (1, eUint32);
  }

  function fnReturnEncryptedArray() public view returns (euint32[] memory) {
    euint32[] memory encryptedArray = new euint32[](1);
    encryptedArray[0] = eUint32;
    return encryptedArray;
  }

  function fnReturnEncryptedStruct() public view returns (ContainsEncryptedResult memory) {
    ContainsEncryptedResult memory encryptedResult = ContainsEncryptedResult({ value: 1, encryptedResult: eUint32 });
    return encryptedResult;
  }

  function fnReturnAllEncrypted() public view returns (euint8, euint16, euint32, euint64, euint128, ebool, eaddress) {
    return (eUint8, eUint16, eUint32, eUint64, eUint128, eBool, eAddress);
  }

  // EVENTS

  event EventNoEncryptedInputs(uint8 value);
  event EncryptedValue(euint32 value);
  event BlendedValue(uint256 value, euint32 encryptedValue);
  event EncryptedArray(euint32[] value);
  event EncryptedStruct(ContainsEncryptedResult value);
  event AllEncrypted(euint8, euint16, euint32, euint64, euint128, ebool, eaddress);
}
