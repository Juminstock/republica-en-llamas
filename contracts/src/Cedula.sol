// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice ERC5192 minimal soulbound interface.
interface IERC5192 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    function locked(uint256 tokenId) external view returns (bool);
}

/// @title Cédula de Supervivencia
/// @notice Soulbound citizen ID. One per address, authorized by the game server, stamped once per completed level.
contract Cedula is ERC721, Ownable, EIP712, IERC5192 {
    bytes32 public constant CLAIM_TYPEHASH = keccak256("Claim(address player,bytes32 metadataHash,uint256 deadline)");
    uint8 public constant MAX_LEVEL = 10;

    address public immutable signer;
    address public ledger;
    string private _base;
    uint256 private _nextId = 1;

    mapping(address player => uint256 tokenId) public tokenOf;
    mapping(uint256 tokenId => bytes32) public metadataHashOf;
    mapping(uint256 tokenId => uint16) public stampsOf;

    event Claimed(address indexed player, uint256 indexed tokenId, bytes32 metadataHash);
    event Stamped(uint256 indexed tokenId, uint8 level);
    event LedgerSet(address ledger);

    error AlreadyClaimed();
    error Expired();
    error InvalidSignature();
    error Soulbound();
    error NotLedger();
    error LedgerAlreadySet();
    error InvalidLevel();

    constructor(address signer_, string memory baseURI_)
        ERC721(unicode"Cédula de Supervivencia", "CEDULA")
        Ownable(msg.sender)
        EIP712("RepublicaEnLlamas", "1")
    {
        signer = signer_;
        _base = baseURI_;
    }

    function claim(bytes32 metadataHash, uint256 deadline, bytes calldata sig) external returns (uint256 tokenId) {
        if (tokenOf[msg.sender] != 0) revert AlreadyClaimed();
        if (block.timestamp > deadline) revert Expired();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(CLAIM_TYPEHASH, msg.sender, metadataHash, deadline)));
        if (ECDSA.recover(digest, sig) != signer) revert InvalidSignature();

        tokenId = _nextId++;
        tokenOf[msg.sender] = tokenId;
        metadataHashOf[tokenId] = metadataHash;
        _mint(msg.sender, tokenId);
        emit Locked(tokenId);
        emit Claimed(msg.sender, tokenId, metadataHash);
    }

    function stamp(uint256 tokenId, uint8 level) external {
        if (msg.sender != ledger) revert NotLedger();
        if (level == 0 || level > MAX_LEVEL) revert InvalidLevel();
        _requireOwned(tokenId);
        stampsOf[tokenId] |= uint16(1) << (level - 1);
        emit Stamped(tokenId, level);
    }

    function setLedger(address ledger_) external onlyOwner {
        if (ledger != address(0)) revert LedgerAlreadySet();
        ledger = ledger_;
        emit LedgerSet(ledger_);
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _base = baseURI_;
    }

    function totalSupply() external view returns (uint256) {
        return _nextId - 1;
    }

    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == type(IERC5192).interfaceId || super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        if (from != address(0)) revert Soulbound();
    }

    function _baseURI() internal view override returns (string memory) {
        return _base;
    }
}
