// SPDX-License-Identifier: BSD-3-Clause-Clear
/* solhint-disable one-contract-per-file */
pragma solidity >=0.8.25 <0.9.0;

import {ACL, Permission} from "./ACL.sol";
// import {PlaintextsStorage} from "./PlaintextsStorage.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MockCoFHE} from "./MockCoFHE.sol";
import {ITaskManager, FunctionId, Utils, EncryptedInput} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";

error DecryptionResultNotReady(uint256 ctHash);
// Input validation errors
error InvalidInputsAmount(string operation, uint256 got, uint256 expected);
error InvalidOperationInputs(string operation);
error TooManyInputs(string operation, uint256 got, uint256 maxAllowed);
error InvalidBytesLength(uint256 got, uint256 expected);
// Type and security validation errors
error InvalidTypeOrSecurityZone(string operation);
error InvalidInputType(uint8 actual, uint8 expected);
error InvalidInputForFunction(string functionName, uint8 inputType);
error InvalidSecurityZone(int32 zone, int32 min, int32 max);
error InvalidSignature();
error InvalidSigner(address signer, address expectedSigner);

// Access control errors
error InvalidAddress();
error OnlyOwnerAllowed(address caller);
error OnlyAggregatorAllowed(address caller);

// Operation-specific errors
error RandomFunctionNotSupported();

library TMCommon {
    uint256 private constant HASH_MASK_FOR_METADATA =
        type(uint256).max - type(uint16).max; // 2 bytes reserved for metadata
    uint256 private constant SECURITY_ZONE_MASK = type(uint8).max; // 0xff -  1 bytes reserved for security zone
    uint256 private constant UINT_TYPE_MASK = (type(uint8).max >> 1); // 0x7f - 7 bits reserved for uint type in the one before last byte
    uint256 private constant TRIVIALLY_ENCRYPTED_MASK =
        type(uint8).max - UINT_TYPE_MASK; //0x80  1 bit reserved for isTriviallyEncrypted
    uint256 private constant SHIFTED_TYPE_MASK = UINT_TYPE_MASK << 8; // 0x7f007 bits reserved for uint type in the one before last byte

    function uint256ToBytes32(
        uint256 value
    ) internal pure returns (bytes memory) {
        bytes memory result = new bytes(32);
        assembly {
            mstore(add(result, 32), value)
        }
        return result;
    }

    function combineInputs(
        uint256[] memory encryptedHashes,
        uint256[] memory extraInputs
    ) internal pure returns (uint256[] memory) {
        uint256[] memory inputs = new uint256[](
            encryptedHashes.length + extraInputs.length
        );
        uint8 i = 0;
        for (; i < encryptedHashes.length; i++) {
            inputs[i] = encryptedHashes[i];
        }
        for (; i < encryptedHashes.length + extraInputs.length; i++) {
            inputs[i] = extraInputs[i - encryptedHashes.length];
        }

        return inputs;
    }

    function getReturnType(
        FunctionId functionId,
        uint8 ctType
    ) internal pure returns (uint8) {
        if (
            functionId == FunctionId.lte ||
            functionId == FunctionId.lt ||
            functionId == FunctionId.gte ||
            functionId == FunctionId.gt ||
            functionId == FunctionId.eq ||
            functionId == FunctionId.ne
        ) {
            return Utils.EBOOL_TFHE;
        }

        return ctType;
    }

    /// @notice Calculates the temporary hash for async operations
    /// @dev Must result the same temp hash as calculated by warp-drive/fhe-driver/CalcBinaryPlaceholderValueHash
    /// @param functionId - The function id
    /// @return The calculated temporary key
    function calcPlaceholderKey(
        uint8 ctType,
        int32 securityZone,
        uint256[] memory inputs,
        FunctionId functionId
    ) internal pure returns (uint256) {
        bytes memory combined;
        bool isTriviallyEncrypted = (functionId == FunctionId.trivialEncrypt);
        for (uint8 i = 0; i < inputs.length; i++) {
            combined = bytes.concat(combined, uint256ToBytes32(inputs[i]));
        }

        // Square is doing mul behind the scene
        if (functionId == FunctionId.square) {
            functionId = FunctionId.mul;
            combined = bytes.concat(combined, uint256ToBytes32(inputs[0]));
        }

        bytes1 functionIdByte = bytes1(uint8(functionId));
        combined = bytes.concat(combined, functionIdByte);

        // Calculate Keccak256 hash
        bytes32 hash = keccak256(combined);

        // TODO: Trivially encrypted here isn't matching the check in `checkAllowed`
        // - arcitect 2025-04-02

        uint256 ctHash = appendMetadata(
            uint256(hash),
            securityZone,
            getReturnType(functionId, ctType),
            isTriviallyEncrypted
        );

        return ctHash;
    }

    function getByteForTrivialAndType(
        bool isTrivial,
        uint8 uintType
    ) internal pure returns (uint256) {
        /// @dev first bit for isTriviallyEncrypted
        /// @dev last 7 bits for uintType

        return
            uint256(
                ((isTrivial ? TRIVIALLY_ENCRYPTED_MASK : 0x00) |
                    (uintType & UINT_TYPE_MASK))
            );
    }

    /**
     *      Results format is: keccak256(operands_list, op)[0:29] || is_trivial (1 bit) & ct_type (7 bit) || securityZone || ct_version
     */
    function appendMetadata(
        uint256 preCtHash,
        int32 securityZone,
        uint8 uintType,
        bool isTrivial
    ) internal pure returns (uint256 result) {
        result = preCtHash & HASH_MASK_FOR_METADATA;
        uint256 metadata = (getByteForTrivialAndType(isTrivial, uintType) <<
            8) | (uint256(uint8(int8(securityZone)))); /// @dev 8 bits for type, 8 bits for securityZone
        result = result | metadata;
    }

    function getSecurityZoneFromHash(
        uint256 hash
    ) internal pure returns (int32) {
        return int32(int8(uint8(hash & SECURITY_ZONE_MASK)));
    }

    function getUintTypeFromHash(uint256 hash) internal pure returns (uint8) {
        return uint8((hash & SHIFTED_TYPE_MASK) >> 8);
    }

    function getSecAndTypeFromHash(
        uint256 hash
    ) internal pure returns (uint256) {
        return uint256((SHIFTED_TYPE_MASK | SECURITY_ZONE_MASK) & hash);
    }
    function isTriviallyEncryptedFromHash(
        uint256 hash
    ) internal pure returns (bool) {
        return (hash & TRIVIALLY_ENCRYPTED_MASK) == TRIVIALLY_ENCRYPTED_MASK;
    }
}

contract TaskManager is ITaskManager, MockCoFHE {
    address owner;
    bool private initialized;

    // NOTE: MOCK PLAINTEXTS STORAGE
    mapping(uint256 ctHash => uint256) private _decryptResult;
    mapping(uint256 ctHash => bool) private _decryptResultReady;
    mapping(uint256 ctHash => uint64) private _decryptResultReadyTimestamp;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    /**
     * @notice              Initializes the contract.
     * @param initialOwner  Initial owner address.
     */
    function initialize(address initialOwner) public {
        owner = initialOwner;
        initialized = true;
        verifierSigner = address(0);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwnerAllowed(msg.sender);
        _;
    }

    function setSecurityZones(int32 minSZ, int32 maxSZ) external onlyOwner {
        securityZoneMin = minSZ;
        securityZoneMax = maxSZ;
    }

    function isInitialized() public view returns (bool) {
        return initialized;
    }

    // Errors
    // Returned when the handle is not allowed in the ACL for the account.
    error ACLNotAllowed(uint256 handle, address account);

    // Events
    event TaskCreated(
        uint256 ctHash,
        string operation,
        uint256 input1,
        uint256 input2,
        uint256 input3
    );
    event ProtocolNotification(
        uint256 ctHash,
        string operation,
        string errorMessage
    );
    event DecryptionResult(
        uint256 ctHash,
        uint256 result,
        address indexed requestor
    );

    struct Task {
        address creator;
        uint256 createdAt;
        bool isResultReady;
    }

    // Supported Security Zones
    int32 private securityZoneMax;
    int32 private securityZoneMin;

    // Address of the aggregator
    address public aggregator;

    // Access-Control contract
    ACL public acl;

    address private verifierSigner;

    // Storage contract for plaintext results of decrypt operations
    // PlaintextsStorage public plaintextsStorage;

    modifier onlyAggregator() {
        if (msg.sender != aggregator) {
            revert OnlyAggregatorAllowed(msg.sender);
        }
        _;
    }

    function exists() public pure returns (bool) {
        return true;
    }

    function sendEventCreated(
        uint256 ctHash,
        string memory operation,
        uint256[] memory inputs
    ) private {
        if (inputs.length == 1 || opIs(operation, FunctionId.cast)) {
            emit TaskCreated(ctHash, operation, inputs[0], 0, 0);

            // NOTE: MOCK
            MOCK_unaryOperation(ctHash, operation, inputs[0]);
        } else if (inputs.length == 2) {
            emit TaskCreated(ctHash, operation, inputs[0], inputs[1], 0);

            // NOTE: MOCK
            MOCK_twoInputOperation(ctHash, operation, inputs[0], inputs[1]);
        } else {
            emit TaskCreated(
                ctHash,
                operation,
                inputs[0],
                inputs[1],
                inputs[2]
            );

            // NOTE: MOCK
            MOCK_threeInputOperation(
                ctHash,
                operation,
                inputs[0],
                inputs[1],
                inputs[2]
            );
        }
    }

    function createDecryptTask(uint256 ctHash, address /*requestor*/) public {
        checkAllowed(ctHash);

        // NOTE: MOCK COMMENTED
        // (uint256 result, bool hasResult) = plaintextsStorage.getResult(ctHash);
        // if (hasResult) {
        //     emit DecryptionResult(ctHash, result, requestor);
        // } else {
        //     uint256[] memory inputs = new uint256[](1);
        //     inputs[0] = uint256(uint160(requestor));
        //     sendEventCreated(
        //         ctHash,
        //         Utils.functionIdToString(FunctionId.decrypt),
        //         inputs
        //     );
        // }

        // NOTE: MOCK
        _decryptResultReady[ctHash] = true;
        _decryptResult[ctHash] = _get(ctHash);

        uint64 asyncOffset = uint64((block.timestamp % 10) + 1);
        _decryptResultReadyTimestamp[ctHash] =
            uint64(block.timestamp) +
            asyncOffset;
    }

    function getDecryptResult(uint256 ctHash) public view returns (uint256) {
        (uint256 result, bool decrypted) = getDecryptResultSafe(ctHash);
        if (!decrypted) revert DecryptionResultNotReady(ctHash);
        return result;
    }

    function getDecryptResultSafe(
        uint256 ctHash
    ) public view returns (uint256 result, bool decrypted) {
        if (!_decryptResultReady[ctHash]) return (0, false);

        // NOTE: MOCK
        if (block.timestamp < _decryptResultReadyTimestamp[ctHash])
            return (0, false);

        return (_get(ctHash), true);
    }

    function checkAllowed(uint256 ctHash) internal view {
        if (!TMCommon.isTriviallyEncryptedFromHash(ctHash)) {
            if (!acl.isAllowed(ctHash, msg.sender))
                revert ACLNotAllowed(ctHash, msg.sender);
        }
    }

    function isUnaryOperation(FunctionId funcId) internal pure returns (bool) {
        return
            funcId == FunctionId.not ||
            funcId == FunctionId.square ||
            funcId == FunctionId.cast;
    }

    function isPlaintextOperation(
        FunctionId funcId
    ) internal pure returns (bool) {
        return
            funcId == FunctionId.random || funcId == FunctionId.trivialEncrypt;
    }

    function getSecurityZone(
        FunctionId functionId,
        uint256[] memory encryptedInputs,
        uint256[] memory plaintextInputs
    ) internal pure returns (int32) {
        if (isPlaintextOperation(functionId)) {
            // If inputs are plaintext (currently trivialEncrypt and random) the security zone will be the last input
            return int32(int256(plaintextInputs[plaintextInputs.length - 1]));
        }

        // First param of a function that receives some encrypted values will always be encrypted
        // Refer to: combineInput for more details
        return TMCommon.getSecurityZoneFromHash(encryptedInputs[0]);
    }

    function isValidSecurityZone(
        int32 _securityZone
    ) internal view returns (bool) {
        return
            _securityZone >= securityZoneMin &&
            _securityZone <= securityZoneMax;
    }

    function validateEncryptedHashes(
        uint256[] memory encryptedHashes
    ) internal view {
        for (uint8 i = 0; i < encryptedHashes.length; i++) {
            checkAllowed(encryptedHashes[i]);
        }
    }

    // Verifies if a function is a function that supports all types (including select for ifTrue, ifFalse)
    function isAllTypesFunction(
        FunctionId funcId
    ) internal pure returns (bool) {
        return
            funcId == FunctionId.select ||
            funcId == FunctionId.eq ||
            funcId == FunctionId.ne ||
            funcId == FunctionId.cast;
    }

    // Verifies if a function is receives ONLY boolean or numeral inputs
    function isBooleanAndNumeralFunction(
        FunctionId funcId
    ) internal pure returns (bool) {
        return
            funcId == FunctionId.xor ||
            funcId == FunctionId.and ||
            funcId == FunctionId.or ||
            funcId == FunctionId.not;
    }

    function validateFunctionInputTypes(
        FunctionId funcId,
        string memory functionName,
        uint256[] memory inputs
    ) internal pure {
        if (isAllTypesFunction(funcId)) {
            return;
        }

        if (isBooleanAndNumeralFunction(funcId)) {
            for (uint8 i = 0; i < inputs.length; i++) {
                uint8 inputType = TMCommon.getUintTypeFromHash(inputs[i]);
                if ((inputType ^ Utils.EADDRESS_TFHE) == 0) {
                    revert InvalidInputForFunction(
                        functionName,
                        Utils.EADDRESS_TFHE
                    );
                }
            }
        } else {
            // In this case we expect a function that only work with numbers
            for (uint8 i = 0; i < inputs.length; i++) {
                uint8 inputType = TMCommon.getUintTypeFromHash(inputs[i]);
                if (
                    (inputType ^ Utils.EADDRESS_TFHE) == 0 ||
                    (inputType ^ Utils.EBOOL_TFHE) == 0
                ) {
                    revert InvalidInputForFunction(functionName, inputType);
                }
            }
        }
    }

    function validateInputs(
        uint256[] memory encryptedHashes,
        FunctionId funcId
    ) internal view {
        string memory functionName = Utils.functionIdToString(funcId);

        if (encryptedHashes.length == 0) {
            if (!isPlaintextOperation(funcId)) {
                revert InvalidOperationInputs(functionName);
            }
            return;
        }

        if (funcId == FunctionId.select) {
            validateSelectInputs(encryptedHashes);
        } else if (isUnaryOperation(funcId)) {
            if (encryptedHashes.length != 1) {
                revert InvalidInputsAmount(
                    functionName,
                    encryptedHashes.length,
                    1
                );
            }
        } else {
            if (encryptedHashes.length != 2) {
                revert InvalidInputsAmount(
                    functionName,
                    encryptedHashes.length,
                    2
                );
            }
            if (
                (
                    TMCommon.getSecAndTypeFromHash(
                        encryptedHashes[0] ^ encryptedHashes[1]
                    )
                ) != 0
            ) {
                revert InvalidTypeOrSecurityZone(functionName);
            }
        }

        int32 securityZone = TMCommon.getSecurityZoneFromHash(
            encryptedHashes[0]
        );
        if (!isValidSecurityZone(securityZone)) {
            revert InvalidSecurityZone(
                securityZone,
                securityZoneMin,
                securityZoneMax
            );
        }
        validateEncryptedHashes(encryptedHashes);
        validateFunctionInputTypes(funcId, functionName, encryptedHashes);
    }

    function validateSelectInputs(
        uint256[] memory encryptedHashes
    ) internal pure {
        if (encryptedHashes.length != 3) {
            revert InvalidInputsAmount("select", encryptedHashes.length, 3);
        }
        if (
            (
                TMCommon.getSecAndTypeFromHash(
                    encryptedHashes[1] ^ encryptedHashes[2]
                )
            ) != 0
        ) {
            revert InvalidTypeOrSecurityZone("select");
        }

        uint8 uintType = TMCommon.getUintTypeFromHash(encryptedHashes[0]);
        if ((uintType ^ Utils.EBOOL_TFHE) != 0) {
            revert InvalidInputType(uintType, Utils.EBOOL_TFHE);
        }
    }

    function createTask(
        uint8 returnType,
        FunctionId funcId,
        uint256[] memory encryptedHashes,
        uint256[] memory extraInputs
    ) external returns (uint256) {
        if (funcId == FunctionId.random) {
            revert RandomFunctionNotSupported();
        }
        uint256 inputsLength = encryptedHashes.length + extraInputs.length;
        if (inputsLength > 3) {
            revert TooManyInputs(
                Utils.functionIdToString(funcId),
                inputsLength,
                3
            );
        }

        validateInputs(encryptedHashes, funcId);
        uint256[] memory inputs = TMCommon.combineInputs(
            encryptedHashes,
            extraInputs
        );

        int32 securityZone = getSecurityZone(
            funcId,
            encryptedHashes,
            extraInputs
        );
        uint256 ctHash = TMCommon.calcPlaceholderKey(
            returnType,
            securityZone,
            inputs,
            funcId
        );

        acl.allowTransient(ctHash, msg.sender, address(this));
        sendEventCreated(ctHash, Utils.functionIdToString(funcId), inputs);

        return ctHash;
    }

    function handleDecryptResult(
        uint256 ctHash,
        uint256 result,
        address[] calldata /*requestors*/
    ) external onlyAggregator {
        // plaintextsStorage.storeResult(ctHash, result);
        // for (uint8 i = 0; i < requestors.length; i++) {
        //     emit DecryptionResult(ctHash, result, requestors[i]);
        // }

        _decryptResultReady[ctHash] = true;
        _decryptResult[ctHash] = result;
        _decryptResultReadyTimestamp[ctHash] = uint64(block.timestamp);
    }

    function handleError(
        uint256 ctHash,
        string memory operation,
        string memory errorMessage
    ) external onlyAggregator {
        emit ProtocolNotification(ctHash, operation, errorMessage);
    }

    function verifyType(uint8 ctType, uint8 desiredType) internal pure {
        if (ctType != desiredType) {
            revert InvalidInputType(ctType, desiredType);
        }
    }

    function verifyInput(
        EncryptedInput memory input,
        address sender
    ) external returns (uint256) {
        int32 securityZone = int32(uint32(input.securityZone));

        // When signer is set to 0 address we skip this logic to be able to support debug use cases.
        // In debug use cases we assume that the verifier is not necessarily running.
        if (verifierSigner != address(0)) {
            if (!isValidSecurityZone(securityZone)) {
                revert InvalidSecurityZone(
                    securityZone,
                    securityZoneMin,
                    securityZoneMax
                );
            }

            address signer = extractSigner(input, sender);
            if (signer != verifierSigner) {
                revert InvalidSigner(signer, verifierSigner);
            }
        }

        uint256 appendedHash = TMCommon.appendMetadata(
            input.ctHash,
            securityZone,
            input.utype,
            false
        );

        acl.allowTransient(appendedHash, msg.sender, address(this));
        return appendedHash;
    }

    function allow(uint256 ctHash, address account) external {
        if (!TMCommon.isTriviallyEncryptedFromHash(ctHash)) {
            acl.allow(ctHash, account, msg.sender);

            // NOTE: MOCK
            MOCK_logAllow(
                account == msg.sender ? "FHE.allowThis" : "FHE.allow",
                ctHash,
                account
            );
        }
    }

    function allowGlobal(uint256 ctHash) external {
        if (!TMCommon.isTriviallyEncryptedFromHash(ctHash)) {
            acl.allowGlobal(ctHash, msg.sender);

            // NOTE: MOCK
            MOCK_logAllow("FHE.allowGlobal", ctHash, msg.sender);
        }
    }

    function allowTransient(uint256 ctHash, address account) external {
        if (!TMCommon.isTriviallyEncryptedFromHash(ctHash)) {
            acl.allowTransient(ctHash, account, msg.sender);

            // NOTE: MOCK
            MOCK_logAllow("FHE.allowTransient", ctHash, account);
        }
    }

    function allowForDecryption(uint256 ctHash) external {
        if (!TMCommon.isTriviallyEncryptedFromHash(ctHash)) {
            uint256[] memory hashes = new uint256[](1);
            hashes[0] = ctHash;
            acl.allowForDecryption(hashes, msg.sender);

            // NOTE: MOCK
            MOCK_logAllow("FHE.allowForDecryption", ctHash, msg.sender);
        }
    }

    function isAllowed(
        uint256 ctHash,
        address account
    ) external view returns (bool) {
        if (TMCommon.isTriviallyEncryptedFromHash(ctHash)) {
            return true;
        }
        return acl.isAllowed(ctHash, account);
    }

    function extractSigner(
        EncryptedInput memory input,
        address sender
    ) private view returns (address) {
        bytes memory combined = abi.encodePacked(
            input.ctHash,
            input.utype,
            input.securityZone,
            sender,
            block.chainid
        );

        bytes32 expectedHash = keccak256(combined);

        address signer = ECDSA.recover(expectedHash, input.signature);
        if (signer == address(0)) {
            revert InvalidSignature();
        }

        return signer;
    }

    function setVerifierSigner(address signer) external onlyOwner {
        verifierSigner = signer;
    }

    function setSecurityZoneMax(int32 securityZone) external onlyOwner {
        if (securityZone < securityZoneMin) {
            revert InvalidSecurityZone(
                securityZone,
                securityZoneMin,
                securityZoneMax
            );
        }
        securityZoneMax = securityZone;
    }

    function setSecurityZoneMin(int32 securityZone) external onlyOwner {
        if (securityZone > securityZoneMax) {
            revert InvalidSecurityZone(
                securityZone,
                securityZoneMin,
                securityZoneMax
            );
        }
        securityZoneMin = securityZone;
    }

    function setACLContract(address _aclAddress) external onlyOwner {
        if (_aclAddress == address(0)) {
            revert InvalidAddress();
        }
        acl = ACL(_aclAddress);
    }

    // function setPlaintextsStorage(
    //     address _plaintextsStorageAddress
    // ) external onlyOwner {
    //     if (_plaintextsStorageAddress == address(0)) {
    //         revert InvalidAddress();
    //     }
    //     plaintextsStorage = PlaintextsStorage(_plaintextsStorageAddress);
    // }

    function setAggregator(address _aggregatorAddress) external onlyOwner {
        if (_aggregatorAddress == address(0)) {
            revert InvalidAddress();
        }
        aggregator = _aggregatorAddress;
    }

    function isAllowedWithPermission(
        Permission memory permission,
        uint256 handle
    ) public view returns (bool) {
        return acl.isAllowedWithPermission(permission, handle);
    }
}
