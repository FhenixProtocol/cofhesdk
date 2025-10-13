// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {TaskManager} from "./MockTaskManager.sol";
import {ACL} from "./ACL.sol";
import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {MockZkVerifier} from "./MockZkVerifier.sol";
import {MockZkVerifierSigner} from "./MockZkVerifierSigner.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Permission, PermissionUtils} from "./Permissioned.sol";
import {MockQueryDecrypter} from "./MockQueryDecrypter.sol";
import {SIGNER_ADDRESS} from "./MockCoFHE.sol";

abstract contract CoFheTest is Test {
    TaskManager public taskManager;
    MockZkVerifier public zkVerifier;
    MockZkVerifierSigner public zkVerifierSigner;
    ACL public acl;
    MockQueryDecrypter public queryDecrypter;

    address constant QUERY_DECRYPTER_ADDRESS = address(512);
    address constant ZK_VERIFIER_ADDRESS = address(256);
    address constant ZK_VERIFIER_SIGNER_ADDRESS = address(257);
    address constant public ACL_ADDRESS = 0xa6Ea4b5291d044D93b73b3CFf3109A1128663E8B;

    bool private _log = false;

    address public constant TM_ADMIN = address(128);

    constructor() {
        etchFhenixMocks();
    }

    function setLog(bool log) internal {
        _log = log;
    }

    // SETUP

    function etchFhenixMocks() internal {
        // Override chain id (uncomment to enable)
        // vm.chainId(421614); // Arb Sepolia
        // vm.chainId(31337); // Anvil
        vm.chainId(420105); // Localfhenix host 1

        // TASK MANAGER
        deployCodeTo("MockTaskManager.sol:TaskManager", TASK_MANAGER_ADDRESS);
        taskManager = TaskManager(TASK_MANAGER_ADDRESS);
        taskManager.initialize(TM_ADMIN);
        vm.label(address(taskManager), "TaskManager(Mock)");

        vm.startPrank(TM_ADMIN);
        taskManager.setSecurityZoneMin(0);
        taskManager.setSecurityZoneMax(1);
        taskManager.setVerifierSigner(SIGNER_ADDRESS);
        vm.stopPrank();

        // ACL
        deployCodeTo(
            "ACL.sol:ACL",
            abi.encode(TM_ADMIN),
            ACL_ADDRESS
        );

        acl = ACL(ACL_ADDRESS);
        vm.label(address(acl), "ACL");

        vm.prank(TM_ADMIN);
        taskManager.setACLContract(address(acl));

        // ZK VERIFIER

        deployCodeTo("MockZkVerifier.sol:MockZkVerifier", ZK_VERIFIER_ADDRESS);
        zkVerifier = MockZkVerifier(ZK_VERIFIER_ADDRESS);
        vm.label(address(zkVerifier), "MockZkVerifier");

        deployCodeTo(
            "MockZkVerifierSigner.sol:MockZkVerifierSigner",
            ZK_VERIFIER_SIGNER_ADDRESS
        );
        zkVerifierSigner = MockZkVerifierSigner(ZK_VERIFIER_SIGNER_ADDRESS);
        vm.label(address(zkVerifierSigner), "MockZkVerifierSigner");

        // QUERY DECRYPTER

        deployCodeTo(
            "MockQueryDecrypter.sol:MockQueryDecrypter",
            QUERY_DECRYPTER_ADDRESS
        );
        queryDecrypter = MockQueryDecrypter(QUERY_DECRYPTER_ADDRESS);
        vm.label(address(queryDecrypter), "MockQueryDecrypter");
        queryDecrypter.initialize(TASK_MANAGER_ADDRESS, address(acl));

        // SET LOG OPS

        taskManager.setLogOps(_log);
    }

    // EXPOSED FUNCTIONS

    /**
     * @notice              Returns the value of a given encrypted value from the mocked task manager.
     * @param ctHash        Hash of the encrypted value.
     * @return              Value of the encrypted value.
     */
    function mockStorage(uint256 ctHash) public view returns (uint256) {
        return taskManager.mockStorage(ctHash);
    }

    /**
     * @notice              Returns whether a given encrypted value is in the mocked task manager.
     * @param ctHash        Hash of the encrypted value.
     * @return              Whether the encrypted value is in the mocked task manager.
     */
    function inMockStorage(uint256 ctHash) public view returns (bool) {
        return taskManager.inMockStorage(ctHash);
    }

    // ASSERTIONS

    // Hash

    /**
     * @notice              Asserts that the value of a given encrypted value is equal to the expected value.
     * @param ctHash        Hash of the encrypted value.
     * @param value         Expected value.
     */
    function assertHashValue(uint256 ctHash, uint256 value) public view {
        assertEq(taskManager.inMockStorage(ctHash), true);
        assertEq(taskManager.mockStorage(ctHash), value);
    }
    function assertHashValue(
        uint256 ctHash,
        uint256 value,
        string memory message
    ) public view {
        assertEq(taskManager.inMockStorage(ctHash), true, message);
        assertEq(taskManager.mockStorage(ctHash), value, message);
    }

    // Encrypted types (no message)

    function assertHashValue(ebool eValue, bool value) public view {
        assertHashValue(ebool.unwrap(eValue), value ? 1 : 0);
    }
    function assertHashValue(euint8 eValue, uint8 value) public view {
        assertHashValue(euint8.unwrap(eValue), value);
    }
    function assertHashValue(euint16 eValue, uint16 value) public view {
        assertHashValue(euint16.unwrap(eValue), value);
    }
    function assertHashValue(euint32 eValue, uint32 value) public view {
        assertHashValue(euint32.unwrap(eValue), value);
    }
    function assertHashValue(euint64 eValue, uint64 value) public view {
        assertHashValue(euint64.unwrap(eValue), value);
    }
    function assertHashValue(euint128 eValue, uint128 value) public view {
        assertHashValue(euint128.unwrap(eValue), value);
    }
    function assertHashValue(eaddress eValue, address value) public view {
        assertHashValue(eaddress.unwrap(eValue), uint256(uint160(value)));
    }

    // Encrypted types (with message)

    function assertHashValue(
        ebool eValue,
        bool value,
        string memory message
    ) public view {
        assertHashValue(ebool.unwrap(eValue), value ? 1 : 0, message);
    }
    function assertHashValue(
        euint8 eValue,
        uint8 value,
        string memory message
    ) public view {
        assertHashValue(euint8.unwrap(eValue), value, message);
    }
    function assertHashValue(
        euint16 eValue,
        uint16 value,
        string memory message
    ) public view {
        assertHashValue(euint16.unwrap(eValue), value, message);
    }
    function assertHashValue(
        euint32 eValue,
        uint32 value,
        string memory message
    ) public view {
        assertHashValue(euint32.unwrap(eValue), value, message);
    }
    function assertHashValue(
        euint64 eValue,
        uint64 value,
        string memory message
    ) public view {
        assertHashValue(euint64.unwrap(eValue), value, message);
    }
    function assertHashValue(
        euint128 eValue,
        uint128 value,
        string memory message
    ) public view {
        assertHashValue(euint128.unwrap(eValue), value, message);
    }
    function assertHashValue(
        eaddress eValue,
        address value,
        string memory message
    ) public view {
        assertHashValue(
            eaddress.unwrap(eValue),
            uint256(uint160(value)),
            message
        );
    }

    // UTILS

    // struct EncryptedInput {
    // uint256 ctHash;
    // uint8 securityZone;
    // uint8 utype;
    // bytes signature;
    // }

    function createEncryptedInput(
        uint8 utype,
        uint256 value,
        uint8 securityZone,
        address sender
    ) internal returns (EncryptedInput memory input) {
        // Create input
        input = zkVerifier.zkVerify(
            value,
            utype,
            sender,
            securityZone,
            block.chainid
        );

        input = zkVerifierSigner.zkVerifySign(input, sender);
    }

    // Derived functions that use the generic create

    /**
     * @notice              Creates an InEbool to be used as FHE input. Value is stored in MockCoFHE contract, hash is a pointer to that value.
     * @param value         Value to encrypt.
     * @param securityZone  Security zone of the encrypted value.
     * @return              InEbool.
     */
    function createInEbool(
        bool value,
        uint8 securityZone,
        address sender
    ) public returns (InEbool memory) {
        return
            abi.decode(
                abi.encode(
                    createEncryptedInput(
                        Utils.EBOOL_TFHE,
                        value ? 1 : 0,
                        securityZone,
                        sender
                    )
                ),
                (InEbool)
            );
    }

    /**
     * @notice              Creates an InEuint8 to be used as FHE input. Value is stored in MockCoFHE contract, hash is a pointer to that value.
     * @param value         Value to encrypt.
     * @param securityZone  Security zone of the encrypted value.
     * @return              InEuint8.
     */
    function createInEuint8(
        uint8 value,
        uint8 securityZone,
        address sender
    ) public returns (InEuint8 memory) {
        return
            abi.decode(
                abi.encode(
                    createEncryptedInput(
                        Utils.EUINT8_TFHE,
                        value,
                        securityZone,
                        sender
                    )
                ),
                (InEuint8)
            );
    }

    /**
     * @notice              Creates an InEuint16 to be used as FHE input. Value is stored in MockCoFHE contract, hash is a pointer to that value.
     * @param value         Value to encrypt.
     * @param securityZone  Security zone of the encrypted value.
     * @return              InEuint16.
     */
    function createInEuint16(
        uint16 value,
        uint8 securityZone,
        address sender
    ) public returns (InEuint16 memory) {
        return
            abi.decode(
                abi.encode(
                    createEncryptedInput(
                        Utils.EUINT16_TFHE,
                        value,
                        securityZone,
                        sender
                    )
                ),
                (InEuint16)
            );
    }

    /**
     * @notice              Creates an InEuint32 to be used as FHE input. Value is stored in MockCoFHE contract, hash is a pointer to that value.
     * @param value         Value to encrypt.
     * @param securityZone  Security zone of the encrypted value.
     * @return              InEuint32.
     */
    function createInEuint32(
        uint32 value,
        uint8 securityZone,
        address sender
    ) public returns (InEuint32 memory) {
        return
            abi.decode(
                abi.encode(
                    createEncryptedInput(
                        Utils.EUINT32_TFHE,
                        value,
                        securityZone,
                        sender
                    )
                ),
                (InEuint32)
            );
    }

    /**
     * @notice              Creates an InEuint64 to be used as FHE input. Value is stored in MockCoFHE contract, hash is a pointer to that value.
     * @param value         Value to encrypt.
     * @param securityZone  Security zone of the encrypted value.
     * @return              InEuint64.
     */
    function createInEuint64(
        uint64 value,
        uint8 securityZone,
        address sender
    ) public returns (InEuint64 memory) {
        return
            abi.decode(
                abi.encode(
                    createEncryptedInput(
                        Utils.EUINT64_TFHE,
                        value,
                        securityZone,
                        sender
                    )
                ),
                (InEuint64)
            );
    }

    /**
     * @notice              Creates an InEuint128 to be used as FHE input. Value is stored in MockCoFHE contract, hash is a pointer to that value.
     * @param value         Value to encrypt.
     * @param securityZone  Security zone of the encrypted value.
     * @return              InEuint128.
     */
    function createInEuint128(
        uint128 value,
        uint8 securityZone,
        address sender
    ) public returns (InEuint128 memory) {
        return
            abi.decode(
                abi.encode(
                    createEncryptedInput(
                        Utils.EUINT128_TFHE,
                        value,
                        securityZone,
                        sender
                    )
                ),
                (InEuint128)
            );
    }

    /**
     * @notice              Creates an InEuint256 to be used as FHE input. Value is stored in MockCoFHE contract, hash is a pointer to that value.
     * @param value         Value to encrypt.
     * @param securityZone  Security zone of the encrypted value.
     * @return              InEuint256.
     */
    function createInEuint256(
        uint256 value,
        uint8 securityZone,
        address sender
    ) public returns (InEuint256 memory) {
        return
            abi.decode(
                abi.encode(
                    createEncryptedInput(
                        Utils.EUINT256_TFHE,
                        value,
                        securityZone,
                        sender
                    )
                ),
                (InEuint256)
            );
    }

    /**
     * @notice              Creates an InEaddress to be used as FHE input. Value is stored in MockCoFHE contract, hash is a pointer to that value.
     * @param value         Value to encrypt.
     * @param securityZone  Security zone of the encrypted value.
     * @return              InEaddress.
     */
    function createInEaddress(
        address value,
        uint8 securityZone,
        address sender
    ) public returns (InEaddress memory) {
        return
            abi.decode(
                abi.encode(
                    createEncryptedInput(
                        Utils.EADDRESS_TFHE,
                        uint256(uint160(value)),
                        securityZone,
                        sender
                    )
                ),
                (InEaddress)
            );
    }

    // Overloads with default securityZone=0 for backward compatibility

    function createInEbool(
        bool value,
        address sender
    ) public returns (InEbool memory) {
        return createInEbool(value, 0, sender);
    }

    function createInEuint8(
        uint8 value,
        address sender
    ) public returns (InEuint8 memory) {
        return createInEuint8(value, 0, sender);
    }

    function createInEuint16(
        uint16 value,
        address sender
    ) public returns (InEuint16 memory) {
        return createInEuint16(value, 0, sender);
    }

    function createInEuint32(
        uint32 value,
        address sender
    ) public returns (InEuint32 memory) {
        return createInEuint32(value, 0, sender);
    }

    function createInEuint64(
        uint64 value,
        address sender
    ) public returns (InEuint64 memory) {
        return createInEuint64(value, 0, sender);
    }

    function createInEuint128(
        uint128 value,
        address sender
    ) public returns (InEuint128 memory) {
        return createInEuint128(value, 0, sender);
    }

    function createInEuint256(
        uint256 value,
        address sender
    ) public returns (InEuint256 memory) {
        return createInEuint256(value, 0, sender);
    }

    function createInEaddress(
        address value,
        address sender
    ) public returns (InEaddress memory) {
        return createInEaddress(value, 0, sender);
    }

    // PERMISSIONS

    bytes32 private constant PERMISSION_TYPE_HASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );

    function permissionDomainSeparator() internal view returns (bytes32) {
        string memory name;
        string memory version;
        uint256 chainId;
        address verifyingContract;

        (, name, version, chainId, verifyingContract, , ) = acl.eip712Domain();

        return
            keccak256(
                abi.encode(
                    PERMISSION_TYPE_HASH,
                    keccak256(bytes(name)),
                    keccak256(bytes(version)),
                    chainId,
                    verifyingContract
                )
            );
    }

    function permissionHashTypedDataV4(
        bytes32 structHash
    ) public view returns (bytes32) {
        return
            MessageHashUtils.toTypedDataHash(
                permissionDomainSeparator(),
                structHash
            );
    }

    function signPermission(
        bytes32 structHash,
        uint256 pkey
    ) public pure returns (bytes memory signature) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pkey, structHash);
        return abi.encodePacked(r, s, v); // note the order here is different from line above.
    }

    function signPermissionSelf(
        Permission memory permission,
        uint256 pkey
    ) public view returns (Permission memory signedPermission) {
        signedPermission = permission;

        bytes32 permissionHash = PermissionUtils.issuerSelfHash(permission);
        bytes32 structHash = permissionHashTypedDataV4(permissionHash);

        signedPermission.issuerSignature = signPermission(structHash, pkey);
    }

    function signPermissionShared(
        Permission memory permission,
        uint256 pkey
    ) public view returns (Permission memory signedPermission) {
        signedPermission = permission;
        bytes32 permissionHash = PermissionUtils.issuerSharedHash(permission);
        bytes32 structHash = permissionHashTypedDataV4(permissionHash);

        signedPermission.issuerSignature = signPermission(structHash, pkey);
    }

    function signPermissionRecipient(
        Permission memory permission,
        uint256 pkey
    ) public view returns (Permission memory signedPermission) {
        signedPermission = permission;

        bytes32 permissionHash = PermissionUtils.recipientHash(permission);
        bytes32 structHash = permissionHashTypedDataV4(permissionHash);

        signedPermission.recipientSignature = signPermission(structHash, pkey);
    }

    function createBasePermission()
        public
        pure
        returns (Permission memory permission)
    {
        permission = Permission({
            issuer: address(0),
            expiration: 1000000000000,
            recipient: address(0),
            validatorId: 0,
            validatorContract: address(0),
            sealingKey: bytes32(0),
            issuerSignature: new bytes(0),
            recipientSignature: new bytes(0)
        });
    }

    function createPermissionSelf(
        address issuer
    ) public pure returns (Permission memory permission) {
        permission = createBasePermission();
        permission.issuer = issuer;
    }

    function createPermissionShared(
        address issuer,
        address recipient
    ) public pure returns (Permission memory permission) {
        permission = createBasePermission();
        permission.issuer = issuer;
        permission.recipient = recipient;
    }

    function createSealingKey(uint256 seed) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(seed));
    }

    function queryDecrypt(
        uint256 ctHash,
        uint256 hostChainId,
        Permission memory permission
    ) public view returns (bool, string memory error, uint256) {
        return queryDecrypter.queryDecrypt(ctHash, hostChainId, permission);
    }

    function querySealOutput(
        uint256 ctHash,
        uint256 hostChainId,
        Permission memory permission
    ) public view returns (bool, string memory error, bytes32) {
        return queryDecrypter.querySealOutput(ctHash, hostChainId, permission);
    }

    function unseal(bytes32 hashed, bytes32 key) public view returns (uint256) {
        return queryDecrypter.unseal(hashed, key);
    }
}
