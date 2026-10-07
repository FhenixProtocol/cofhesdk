// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25 <0.9.0;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {ACP, IPermissionCustomIdValidator} from "./Permissioned.sol";

/**
 * @notice On-chain hand-off for sharing ACPs — replaces the JSON copy-paste flow.
 *
 * An issuer posts a sharing ACP addressed to a recipient; the recipient reads it
 * from here, fills in their sealing key, signs, and imports it client-side. Shares
 * are indexed globally per recipient — a share is addressed to a person, and any
 * cofhesdk-enabled app may surface it.
 *
 * Pointer-based: the full ACP and an optional metadata blob travel in the `Shared`
 * event; storage keeps only the share head — the fields this contract checks
 * (issuer, recipient, expiration, revoker) and the block of that event — plus the
 * recipient's set of share ids. A reader takes the head from `sharesFor` / `getShare`
 * and fetches the event with a `getLogs` over that one block, filtered by the
 * share id topic.
 *
 * The registry stays deliberately dumb:
 *
 *  - The posted ACP carries `sealingKey = 0` and `recipientSignature = ""` — the
 *    recipient supplies both at import, exactly as in the off-chain flow.
 *  - No signature verification on-chain: a share's full validity cannot be checked
 *    before the recipient signs, and the SDK validates everything at import. The
 *    trust the registry adds is `msg.sender == acp.issuer` — a share listed under
 *    a recipient was genuinely posted by its claimed issuer.
 *  - The metadata is opaque bytes, never interpreted here (the SDK defines the
 *    format: labels saying where each ctHash of a SNAPSHOT share came from). It is
 *    written once, with the share, and cannot be replaced.
 *  - `isShareValid` is the verification hook for other contracts: share exists,
 *    is unexpired, and is not revoked (per the share's own revoker contract).
 *
 * Nothing posted here is sensitive: every field is part of the cleartext share
 * payload by design. Posting on-chain does make the issuer→recipient sharing
 * relationship public. (A future variant may accept an encrypted payload as a
 * parallel entry type; this registry's cleartext entries would be unaffected.)
 */
contract ACPShareRegistry is UUPSUpgradeable, AccessControlUpgradeable {
    using EnumerableSet for EnumerableSet.Bytes32Set;

    /// @notice Role allowed to upgrade the implementation.
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @notice What storage keeps of a share: the fields `removeShare` and the validity
    ///         check read, and where to find the rest.
    /// @dev Packed into four slots; the two revoker slots stay zero for a share without
    ///      a revoker.
    struct ShareHead {
        address issuer;
        uint64 expiration;
        address recipient;
        /// @dev Block of the `Shared` event that carries the full ACP and the metadata
        ///      (the L2 block on Arbitrum).
        uint64 blockNumber;
        address revokerContract;
        uint256 revokerData;
    }

    /// @custom:storage-location erc7201:cofhe.storage.ACPShareRegistry.v2
    struct ACPShareRegistryStorage {
        /// @dev recipient => ids of shares addressed to them
        mapping(address => EnumerableSet.Bytes32Set) shareIdsFor;
        /// @dev share id => stored head
        mapping(bytes32 => ShareHead) heads;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("cofhe.storage.ACPShareRegistry.v2")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant ACP_SHARE_REGISTRY_SLOT =
        keccak256(abi.encode(uint256(keccak256("cofhe.storage.ACPShareRegistry.v2")) - 1)) & ~bytes32(uint256(0xff));

    /// @notice The first version's storage, which kept every share whole. Read only by
    ///         `migrateV1Shares`, which empties it; declared so the namespace stays reserved.
    /// @custom:storage-location erc7201:cofhe.storage.ACPShareRegistry
    struct ACPShareRegistryStorageV1 {
        /// @dev recipient => ids of shares addressed to them
        mapping(address => EnumerableSet.Bytes32Set) shareIdsFor;
        /// @dev share id => stored payload
        mapping(bytes32 => ACP) shares;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("cofhe.storage.ACPShareRegistry")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant ACP_SHARE_REGISTRY_V1_SLOT =
        keccak256(abi.encode(uint256(keccak256("cofhe.storage.ACPShareRegistry")) - 1)) & ~bytes32(uint256(0xff));

    /// @notice A share was posted. `acp` is the payload as posted; `metadata` is the opaque
    ///         blob that came with it (empty when none). The share id is
    ///         `keccak256(abi.encode(acp))`.
    event Shared(address indexed recipient, address indexed issuer, bytes32 indexed shareId, ACP acp, bytes metadata);
    event ShareRemoved(address indexed recipient, address indexed issuer, bytes32 indexed shareId);
    /// @notice `migrateV1Shares` moved a recipient's first-version shares: `migrated` live ones
    ///         re-posted (each with its own `Shared` event), `dropped` expired or revoked ones discarded.
    event V1SharesMigrated(address indexed recipient, uint256 migrated, uint256 dropped);

    error NotIssuer();
    error NotIssuerOrRecipient();
    error RecipientMissing();
    error SealingKeyMustBeEmpty();
    error IssuerSignatureMissing();
    error ShareExpired();
    error AlreadyShared();
    error UnknownShare();
    error NotAdminOrUpgrader();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice              Initializes the contract.
     * @param initialAdmin  Receives DEFAULT_ADMIN_ROLE and UPGRADER_ROLE.
     */
    function initialize(address initialAdmin) public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(UPGRADER_ROLE, initialAdmin);
    }

    /// @notice Post a sharing ACP for its recipient to pick up, with an optional metadata
    ///         blob (`""` for none).
    /// @dev The share id is the hash of the payload — reposting an identical share reverts,
    ///      whatever its metadata.
    function share(ACP calldata acp, bytes calldata metadata) external returns (bytes32 shareId) {
        if (msg.sender != acp.issuer) revert NotIssuer();
        if (acp.recipient == address(0)) revert RecipientMissing();
        if (acp.sealingKey != bytes32(0)) revert SealingKeyMustBeEmpty();
        if (acp.issuerSignature.length == 0) revert IssuerSignatureMissing();
        if (acp.expiration < block.timestamp) revert ShareExpired();

        shareId = keccak256(abi.encode(acp));
        // the id commits to the recipient, so a duplicate can only be in this set
        if (!_storeHead(shareId, acp.issuer, acp.expiration, acp.recipient, acp.revokerContract, acp.revokerData)) {
            revert AlreadyShared();
        }

        emit Shared(acp.recipient, acp.issuer, shareId, acp, metadata);
    }

    /// @dev Adds the share to its recipient's set and stores its head, pointing at this block.
    ///      False when the recipient already has a share with this id. The caller emits `Shared`
    ///      (from calldata in `share`, which keeps the payload out of memory).
    function _storeHead(
        bytes32 shareId,
        address issuer,
        uint64 expiration,
        address recipient,
        address revokerContract,
        uint256 revokerData
    ) private returns (bool) {
        ACPShareRegistryStorage storage $ = _getStorage();
        if (!$.shareIdsFor[recipient].add(shareId)) return false;
        $.heads[shareId] = ShareHead({
            issuer: issuer,
            expiration: expiration,
            recipient: recipient,
            blockNumber: uint64(_blockNumber()),
            revokerContract: revokerContract,
            revokerData: revokerData
        });
        return true;
    }

    /**
     * @notice One-time move of first-version shares into this layout, a page of recipients at a
     *         time (the first version kept no list of recipients; the upgrade task collects them
     *         from its `Shared` events). Each live share is re-posted as if new: its `Shared` event
     *         carries the full payload and empty metadata, and its head points at this block, so
     *         readers cannot tell it from a share posted now. Expired and revoked shares are
     *         dropped. Every share it reads is deleted from the first-version storage, so a repeated
     *         call is a no-op. Run inside `upgradeToAndCall`, or after it, by the admin or upgrader.
     */
    function migrateV1Shares(address[] calldata recipients) external {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && !hasRole(UPGRADER_ROLE, msg.sender)) {
            revert NotAdminOrUpgrader();
        }
        ACPShareRegistryStorageV1 storage v1 = _getStorageV1();
        for (uint256 r = 0; r < recipients.length; r++) {
            EnumerableSet.Bytes32Set storage ids = v1.shareIdsFor[recipients[r]];
            uint256 migrated = 0;
            uint256 dropped = 0;
            while (ids.length() > 0) {
                bytes32 shareId = ids.at(ids.length() - 1);
                ACP memory acp = v1.shares[shareId];
                ids.remove(shareId);
                delete v1.shares[shareId];
                if (
                    _isValid(acp.issuer, acp.expiration, acp.revokerContract, acp.revokerData) &&
                    _storeHead(shareId, acp.issuer, acp.expiration, acp.recipient, acp.revokerContract, acp.revokerData)
                ) {
                    emit Shared(acp.recipient, acp.issuer, shareId, acp, "");
                    migrated++;
                } else {
                    dropped++;
                }
            }
            if (migrated + dropped > 0) emit V1SharesMigrated(recipients[r], migrated, dropped);
        }
    }

    /// @notice Remove a share. The issuer may retract it; the recipient may dismiss it
    ///         (e.g. after importing, or to decline). The `Shared` event stays in its block;
    ///         readers go by the head, which is gone.
    function removeShare(bytes32 shareId) external {
        ACPShareRegistryStorage storage $ = _getStorage();

        ShareHead storage head = $.heads[shareId];
        if (head.issuer == address(0)) revert UnknownShare();
        if (msg.sender != head.issuer && msg.sender != head.recipient) revert NotIssuerOrRecipient();

        address recipient = head.recipient;
        address issuer = head.issuer;

        // the id set and the head map stay in sync — mirror share()'s add() handling
        if (!$.shareIdsFor[recipient].remove(shareId)) revert UnknownShare();
        delete $.heads[shareId];

        emit ShareRemoved(recipient, issuer, shareId);
    }

    /// @notice The importable shares addressed to `recipient` — unexpired and not revoked —
    ///         as their ids and heads, index for index. Dead entries stay in storage until
    ///         removed but are filtered here.
    function sharesFor(
        address recipient
    ) external view returns (bytes32[] memory shareIds, ShareHead[] memory heads) {
        ACPShareRegistryStorage storage $ = _getStorage();
        EnumerableSet.Bytes32Set storage ids = $.shareIdsFor[recipient];
        uint256 len = ids.length();

        // single pass: allocate for the maximum, fill with valid shares only
        shareIds = new bytes32[](len);
        heads = new ShareHead[](len);
        uint256 live = 0;
        for (uint256 i = 0; i < len; i++) {
            bytes32 shareId = ids.at(i);
            ShareHead storage head = $.heads[shareId];
            if (_isValid(head)) {
                shareIds[live] = shareId;
                heads[live] = head;
                live++;
            }
        }

        // truncate the memory arrays' length to the live count (shrink-only)
        if (live < len) {
            assembly {
                mstore(shareIds, live)
                mstore(heads, live)
            }
        }
    }

    /// @notice The head of a single share (zeroed struct if unknown/removed).
    function getShare(bytes32 shareId) external view returns (ShareHead memory) {
        return _getStorage().heads[shareId];
    }

    /// @notice Verification hook for contracts: the share exists, was posted by its
    ///         claimed issuer (guaranteed at posting), is unexpired, and is not
    ///         revoked per its own revoker contract.
    function isShareValid(bytes32 shareId) external view returns (bool) {
        ShareHead storage head = _getStorage().heads[shareId];
        if (head.issuer == address(0)) return false;
        return _isValid(head);
    }

    /// @dev Unexpired and not revoked. The revoker call mirrors `withPermission`'s
    ///      revocation clause; a reverting revoker fails closed (share invalid).
    function _isValid(ShareHead storage head) private view returns (bool) {
        return _isValid(head.issuer, head.expiration, head.revokerContract, head.revokerData);
    }

    function _isValid(
        address issuer,
        uint64 expiration,
        address revokerContract,
        uint256 revokerData
    ) private view returns (bool) {
        if (expiration < block.timestamp) return false;

        if (revokerData != 0 && revokerContract != address(0)) {
            try IPermissionCustomIdValidator(revokerContract).disabled(issuer, revokerData) returns (bool disabled) {
                if (disabled) return false;
            } catch {
                return false;
            }
        }

        return true;
    }

    /// @dev The number a `getLogs` query takes for the current block. On Arbitrum `block.number`
    ///      is an L1 block estimate and the L2 block comes from the ArbSys precompile; elsewhere
    ///      nothing answers at that address and `block.number` is the block.
    function _blockNumber() private view returns (uint256) {
        (bool ok, bytes memory result) = address(100).staticcall(abi.encodeWithSignature("arbBlockNumber()"));
        return ok && result.length == 32 ? abi.decode(result, (uint256)) : block.number;
    }

    /**
     * @dev Should revert when `msg.sender` is not authorized to upgrade the contract.
     *      Empty implementation since authorization is handled by the role check.
     */
    /* solhint-disable-next-line no-empty-blocks */
    function _authorizeUpgrade(address _newImplementation) internal virtual override onlyRole(UPGRADER_ROLE) {}

    /**
     * @dev Returns the registry storage location.
     */
    function _getStorage() internal pure returns (ACPShareRegistryStorage storage $) {
        bytes32 slot = ACP_SHARE_REGISTRY_SLOT;
        assembly {
            $.slot := slot
        }
    }

    /**
     * @dev Returns the first version's storage location.
     */
    function _getStorageV1() private pure returns (ACPShareRegistryStorageV1 storage $) {
        bytes32 slot = ACP_SHARE_REGISTRY_V1_SLOT;
        assembly {
            $.slot := slot
        }
    }
}
