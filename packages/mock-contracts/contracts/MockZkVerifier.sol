// SPDX-License-Identifier: BSD-3-Clause-Clear
// solhint-disable one-contract-per-file

pragma solidity >=0.8.19 <0.9.0;

import {TASK_MANAGER_ADDRESS} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {EncryptedInput} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import {TaskManager} from "./MockTaskManager.sol";

contract MockZkVerifier {
    // TMCommon
    uint256 constant hashMaskForMetadata = type(uint256).max - type(uint16).max; // 2 bytes reserved for metadata
    uint256 constant uintTypeMask = (type(uint8).max >> 1); // 0x7f - 7 bits reserved for uint type in the one before last byte
    uint256 constant triviallyEncryptedMask = type(uint8).max - uintTypeMask; //0x80  1 bit reserved for isTriviallyEncrypted

    // Specific
    uint256 salt = 0;
    error InvalidInputs();

    // EXISTENCE

    function exists() public pure returns (bool) {
        return true;
    }

    // HASHING

    function getByteForTrivialAndType(
        bool isTrivial,
        uint8 uintType
    ) internal pure returns (uint256) {
        /// @dev first bit for isTriviallyEncrypted
        /// @dev last 7 bits for uintType

        return
            uint256(
                ((isTrivial ? triviallyEncryptedMask : 0x00) |
                    (uintType & uintTypeMask))
            );
    }

    function _appendMetadata(
        uint256 preCtHash,
        uint8 securityZone,
        uint8 uintType,
        bool isTrivial
    ) internal pure returns (uint256 result) {
        result = preCtHash & hashMaskForMetadata;
        uint256 metadata = (getByteForTrivialAndType(isTrivial, uintType) <<
            8) | (uint256(uint8(int8(securityZone)))); /// @dev 8 bits for type, 8 bits for securityZone
        result = result | metadata;
    }

    function uint256ToBytes32(
        uint256 value
    ) internal pure returns (bytes memory) {
        bytes memory result = new bytes(32);
        assembly {
            mstore(add(result, 32), value)
        }
        return result;
    }

    function _calcPlaceholderKey(
        address user,
        uint8 utype,
        uint8 securityZone,
        uint256 input
    ) internal view returns (uint256) {
        bytes memory combined = bytes.concat(uint256ToBytes32(input));
        combined = bytes.concat(
            combined,
            uint256ToBytes32(uint256(uint160(user)))
        );
        combined = bytes.concat(combined, keccak256(abi.encodePacked(salt)));

        // Calculate Keccak256 hash
        bytes32 ctHash = keccak256(combined);

        return _appendMetadata(uint256(ctHash), securityZone, utype, false);
    }

    // CORE

    function zkVerifyCalcCtHashesPacked(
        uint256[] memory values,
        uint8[] memory utypes,
        address user,
        uint8 securityZone,
        uint256 chainId
    ) public view returns (uint256[] memory ctHashes) {
        if (utypes.length != values.length) {
            revert InvalidInputs();
        }

        ctHashes = new uint256[](utypes.length);

        for (uint256 i = 0; i < utypes.length; i++) {
            ctHashes[i] = zkVerifyCalcCtHash(
                values[i],
                utypes[i],
                user,
                securityZone,
                chainId
            );
        }
    }

    function zkVerifyCalcCtHash(
        uint256 value,
        uint8 utype,
        address user,
        uint8 securityZone,
        uint256
    ) public view returns (uint256 ctHash) {
        ctHash = _calcPlaceholderKey(user, utype, securityZone, value);
    }

    function insertPackedCtHashes(
        uint256[] memory ctHashes,
        uint256[] memory values
    ) public {
        for (uint256 i = 0; i < ctHashes.length; i++) {
            insertCtHash(ctHashes[i], values[i]);
        }
    }

    function insertCtHash(uint256 ctHash, uint256 value) public {
        TaskManager(TASK_MANAGER_ADDRESS).MOCK_setInEuintKey(ctHash, value);
        salt += 1;
    }

    function zkVerifyPacked(
        uint256[] memory values,
        uint8[] memory utypes,
        address user,
        uint8 securityZone,
        uint256 chainId
    ) public returns (EncryptedInput[] memory inputs) {
        if (utypes.length != values.length) {
            revert InvalidInputs();
        }

        inputs = new EncryptedInput[](utypes.length);

        for (uint256 i = 0; i < utypes.length; i++) {
            inputs[i] = zkVerify(
                values[i],
                utypes[i],
                user,
                securityZone,
                chainId
            );
        }
    }

    function zkVerify(
        uint256 value,
        uint8 utype,
        address user,
        uint8 securityZone,
        uint256
    ) public returns (EncryptedInput memory) {
        uint256 ctHash = _calcPlaceholderKey(user, utype, securityZone, value);
        insertCtHash(ctHash, value);
        return
            EncryptedInput({
                ctHash: ctHash,
                securityZone: securityZone,
                utype: utype,
                signature: hex""
            });
    }
}
