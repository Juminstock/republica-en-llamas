// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Base} from "./Base.t.sol";
import {Sellos} from "../src/Sellos.sol";

contract SellosTest is Base {
    Sellos internal sellos;
    uint16 internal constant BIBLIOTECA = 1101;

    function setUp() public override {
        super.setUp();
        sellos = new Sellos(cedula, signer, "https://example.com/api/sellos/");
    }

    function _selloSig(uint256 pk, address who, uint16 id, uint256 deadline) internal view returns (bytes memory) {
        bytes32 structHash =
            keccak256(abi.encode(keccak256("Sello(address player,uint16 selloId,uint256 deadline)"), who, id, deadline));
        return _sign(pk, _domain(address(sellos)), structHash);
    }

    function _mint(address who, uint16 id) internal {
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory sig = _selloSig(SIGNER_PK, who, id, deadline);
        vm.prank(who);
        sellos.mint(id, deadline, sig);
    }

    function test_MintsSello() public {
        _claim(player);
        vm.expectEmit(address(sellos));
        emit Sellos.SelloMinted(player, BIBLIOTECA);
        _mint(player, BIBLIOTECA);
        assertEq(sellos.balanceOf(player, BIBLIOTECA), 1);
        assertTrue(sellos.minted(player, BIBLIOTECA));
        assertEq(sellos.uri(BIBLIOTECA), "https://example.com/api/sellos/1101");
    }

    function test_DomainMatchesHelper() public view {
        assertEq(sellos.domainSeparator(), _domain(address(sellos)));
    }

    function test_SeveralSellosPerPlayer() public {
        _claim(player);
        _mint(player, 1101);
        _mint(player, 1102);
        _mint(player, 1105);
        assertEq(sellos.balanceOf(player, 1102), 1);
        assertEq(sellos.balanceOf(player, 1103), 0);
    }

    function test_RevertDuplicate() public {
        _claim(player);
        _mint(player, BIBLIOTECA);
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory sig = _selloSig(SIGNER_PK, player, BIBLIOTECA, deadline);
        vm.prank(player);
        vm.expectRevert(Sellos.AlreadyMinted.selector);
        sellos.mint(BIBLIOTECA, deadline, sig);
    }

    function test_RevertWrongSigner() public {
        _claim(player);
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory sig = _selloSig(0xBAD, player, BIBLIOTECA, deadline);
        vm.prank(player);
        vm.expectRevert(Sellos.InvalidSignature.selector);
        sellos.mint(BIBLIOTECA, deadline, sig);
    }

    function test_RevertTamperedId() public {
        _claim(player);
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory sig = _selloSig(SIGNER_PK, player, BIBLIOTECA, deadline);
        vm.prank(player);
        vm.expectRevert(Sellos.InvalidSignature.selector);
        sellos.mint(1102, deadline, sig);
    }

    function test_RevertExpired() public {
        _claim(player);
        uint256 deadline = block.timestamp + 1;
        bytes memory sig = _selloSig(SIGNER_PK, player, BIBLIOTECA, deadline);
        vm.warp(deadline + 1);
        vm.prank(player);
        vm.expectRevert(Sellos.Expired.selector);
        sellos.mint(BIBLIOTECA, deadline, sig);
    }

    function test_RevertSignatureForAnotherPlayer() public {
        _claim(player);
        _claim(other);
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory sig = _selloSig(SIGNER_PK, player, BIBLIOTECA, deadline);
        vm.prank(other);
        vm.expectRevert(Sellos.InvalidSignature.selector);
        sellos.mint(BIBLIOTECA, deadline, sig);
    }

    function test_RevertWithoutCedula() public {
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory sig = _selloSig(SIGNER_PK, player, BIBLIOTECA, deadline);
        vm.prank(player);
        vm.expectRevert(Sellos.NoCedula.selector);
        sellos.mint(BIBLIOTECA, deadline, sig);
    }

    function test_RevertTransfer() public {
        _claim(player);
        _mint(player, BIBLIOTECA);
        vm.prank(player);
        vm.expectRevert(Sellos.Soulbound.selector);
        sellos.safeTransferFrom(player, other, BIBLIOTECA, 1, "");
    }

    function test_RevertBatchTransfer() public {
        _claim(player);
        _mint(player, BIBLIOTECA);
        uint256[] memory ids = new uint256[](1);
        ids[0] = BIBLIOTECA;
        uint256[] memory values = new uint256[](1);
        values[0] = 1;
        vm.prank(player);
        vm.expectRevert(Sellos.Soulbound.selector);
        sellos.safeBatchTransferFrom(player, other, ids, values, "");
    }

    function test_RevertApproval() public {
        vm.prank(player);
        vm.expectRevert(Sellos.Soulbound.selector);
        sellos.setApprovalForAll(other, true);
    }

    function test_OnlyOwnerSetsBaseURI() public {
        sellos.setBaseURI("https://new.example/");
        assertEq(sellos.uri(7), "https://new.example/7");
        vm.prank(player);
        vm.expectRevert();
        sellos.setBaseURI("x");
    }
}
