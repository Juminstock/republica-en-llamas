// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Cedula} from "./Cedula.sol";
import {Bunuelo} from "./Bunuelo.sol";

/// @title RepublicaLedger
/// @notice Records server-attested task checkpoints: choices, fates and the Buñuelo earned and spent.
contract RepublicaLedger is EIP712 {
    struct Checkpoint {
        address player;
        uint16 level;
        uint8 task;
        uint16[] choiceIds;
        uint8[] options;
        uint8[3] fates;
        uint256 earned;
        uint256 spent;
        uint256 nonce;
        uint256 deadline;
    }

    bytes32 public constant CHECKPOINT_TYPEHASH = keccak256(
        "Checkpoint(address player,uint16 level,uint8 task,uint16[] choiceIds,uint8[] options,uint8[3] fates,uint256 earned,uint256 spent,uint256 nonce,uint256 deadline)"
    );
    uint8 public constant TASKS_PER_LEVEL = 5;
    uint8 public constant MAX_OPTIONS = 8;
    uint8 public constant MAX_FATE = 3;
    uint256 public constant MAX_EARN_PER_TASK = 200e18;

    Cedula public immutable cedula;
    Bunuelo public immutable bunuelo;
    address public immutable signer;

    mapping(address player => mapping(uint16 level => uint8)) public lastTask;
    mapping(address player => mapping(uint256 nonce => bool)) public nonceUsed;
    mapping(uint16 choiceId => uint256[8]) internal _choiceCounts;
    mapping(address player => mapping(uint16 choiceId => uint8)) internal _choiceOf;
    mapping(address player => mapping(uint16 choiceId => bool)) public hasChosen;
    mapping(address player => mapping(uint16 level => uint8[3])) internal _fates;

    event ChoiceMade(address indexed player, uint16 indexed choiceId, uint8 option);
    event TaskCompleted(address indexed player, uint16 level, uint8 task, uint256 earned, uint256 spent);
    event LevelCompleted(address indexed player, uint16 level, uint8[3] fates);

    error NotPlayer();
    error NoCedula();
    error InvalidLevel();
    error TaskOutOfOrder();
    error NonceUsed();
    error Expired();
    error InvalidSignature();
    error EarnCapExceeded();
    error LengthMismatch();
    error InvalidOption();
    error InvalidFate();

    constructor(Cedula cedula_, Bunuelo bunuelo_, address signer_) EIP712("RepublicaEnLlamas", "1") {
        cedula = cedula_;
        bunuelo = bunuelo_;
        signer = signer_;
    }

    function commitCheckpoint(Checkpoint calldata cp, bytes calldata sig) external {
        if (msg.sender != cp.player) revert NotPlayer();
        uint256 tokenId = cedula.tokenOf(cp.player);
        if (tokenId == 0) revert NoCedula();
        if (cp.level == 0 || cp.level > cedula.MAX_LEVEL()) revert InvalidLevel();
        if (cp.task != lastTask[cp.player][cp.level] + 1 || cp.task > TASKS_PER_LEVEL) revert TaskOutOfOrder();
        if (nonceUsed[cp.player][cp.nonce]) revert NonceUsed();
        if (block.timestamp > cp.deadline) revert Expired();
        if (cp.earned > MAX_EARN_PER_TASK) revert EarnCapExceeded();
        if (cp.choiceIds.length != cp.options.length) revert LengthMismatch();
        if (ECDSA.recover(_hashTypedDataV4(hashCheckpoint(cp)), sig) != signer) revert InvalidSignature();

        nonceUsed[cp.player][cp.nonce] = true;
        lastTask[cp.player][cp.level] = cp.task;

        for (uint256 i; i < cp.choiceIds.length; ++i) {
            uint8 option = cp.options[i];
            if (option >= MAX_OPTIONS) revert InvalidOption();
            uint16 choiceId = cp.choiceIds[i];
            _choiceCounts[choiceId][option]++;
            _choiceOf[cp.player][choiceId] = option;
            hasChosen[cp.player][choiceId] = true;
            emit ChoiceMade(cp.player, choiceId, option);
        }

        if (cp.earned > 0) bunuelo.mint(cp.player, cp.earned);
        if (cp.spent > 0) bunuelo.burn(cp.player, cp.spent);
        emit TaskCompleted(cp.player, cp.level, cp.task, cp.earned, cp.spent);

        if (cp.task == TASKS_PER_LEVEL) {
            for (uint256 i; i < 3; ++i) {
                if (cp.fates[i] > MAX_FATE) revert InvalidFate();
            }
            _fates[cp.player][cp.level] = cp.fates;
            // casting to 'uint8' is safe because level <= MAX_LEVEL (10)
            // forge-lint: disable-next-line(unsafe-typecast)
            cedula.stamp(tokenId, uint8(cp.level));
            emit LevelCompleted(cp.player, cp.level, cp.fates);
        }
    }

    function hashCheckpoint(Checkpoint calldata cp) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                CHECKPOINT_TYPEHASH,
                cp.player,
                cp.level,
                cp.task,
                keccak256(abi.encodePacked(cp.choiceIds)),
                keccak256(abi.encodePacked(cp.options)),
                keccak256(abi.encodePacked(cp.fates)),
                cp.earned,
                cp.spent,
                cp.nonce,
                cp.deadline
            )
        );
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function getChoiceStats(uint16 choiceId) external view returns (uint256[8] memory) {
        return _choiceCounts[choiceId];
    }

    function choiceOf(address player, uint16 choiceId) external view returns (uint8 option, bool chosen) {
        return (_choiceOf[player][choiceId], hasChosen[player][choiceId]);
    }

    function fatesOf(address player, uint16 level) external view returns (uint8[3] memory) {
        return _fates[player][level];
    }
}
