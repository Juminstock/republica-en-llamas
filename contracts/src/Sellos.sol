// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Cedula} from "./Cedula.sol";

/// @title Sellos de Grado
/// @notice Soulbound ERC1155 stamps. Every stamp a player earns in the game is its own mint,
/// authorized by the game server and only for holders of a Cédula.
contract Sellos is ERC1155, Ownable, EIP712 {
    bytes32 public constant SELLO_TYPEHASH = keccak256("Sello(address player,uint16 selloId,uint256 deadline)");

    Cedula public immutable cedula;
    address public immutable signer;
    string private _base;

    mapping(address player => mapping(uint16 selloId => bool)) public minted;

    event SelloMinted(address indexed player, uint16 indexed selloId);

    error AlreadyMinted();
    error Expired();
    error InvalidSignature();
    error NoCedula();
    error Soulbound();

    constructor(Cedula cedula_, address signer_, string memory baseURI_)
        ERC1155("")
        Ownable(msg.sender)
        EIP712("RepublicaEnLlamas", "1")
    {
        cedula = cedula_;
        signer = signer_;
        _base = baseURI_;
    }

    function mint(uint16 selloId, uint256 deadline, bytes calldata sig) external {
        if (block.timestamp > deadline) revert Expired();
        if (cedula.tokenOf(msg.sender) == 0) revert NoCedula();
        if (minted[msg.sender][selloId]) revert AlreadyMinted();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(SELLO_TYPEHASH, msg.sender, selloId, deadline)));
        if (ECDSA.recover(digest, sig) != signer) revert InvalidSignature();

        minted[msg.sender][selloId] = true;
        _mint(msg.sender, selloId, 1, "");
        emit SelloMinted(msg.sender, selloId);
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _base = baseURI_;
    }

    function uri(uint256 id) public view override returns (string memory) {
        return string.concat(_base, Strings.toString(id));
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        if (from != address(0)) revert Soulbound();
        super._update(from, to, ids, values);
    }
}
