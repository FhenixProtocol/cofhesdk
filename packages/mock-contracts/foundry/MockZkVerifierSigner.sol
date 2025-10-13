// SPDX-License-Identifier: BSD-3-Clause-Clear
// solhint-disable one-contract-per-file

pragma solidity >=0.8.19 <0.9.0;

import {console} from "forge-std/console.sol";
import {SIGNER_PRIVATE_KEY} from "./MockCoFHE.sol";
import {EncryptedInput} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import {Test} from "forge-std/Test.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract MockZkVerifierSigner is Test {
    function zkVerifySignPacked(
        EncryptedInput[] memory inputs,
        address sender
    ) public view returns (EncryptedInput[] memory) {
        EncryptedInput[] memory signedInputs = new EncryptedInput[](
            inputs.length
        );
        for (uint256 i = 0; i < inputs.length; i++) {
            signedInputs[i] = zkVerifySign(inputs[i], sender);
        }
        return signedInputs;
    }

    function zkVerifySign(
        EncryptedInput memory input,
        address sender
    ) public view returns (EncryptedInput memory) {
        bytes memory combined = abi.encodePacked(
            input.ctHash,
            input.utype,
            input.securityZone,
            sender,
            block.chainid
        );

        bytes32 expectedHash = keccak256(combined);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            SIGNER_PRIVATE_KEY,
            expectedHash
        );
        bytes memory signature = abi.encodePacked(r, s, v); // note the order here is different from line above.

        input.signature = signature;
        return input;
    }
}
