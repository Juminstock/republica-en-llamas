// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Base} from "./Base.t.sol";
import {Cedula, IERC5192} from "../src/Cedula.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract CedulaTest is Base {
    function test_ClaimMintsSoulbound() public {
        vm.expectEmit(address(cedula));
        emit IERC5192.Locked(1);
        uint256 id = _claim(player);
        assertEq(id, 1);
        assertEq(cedula.ownerOf(1), player);
        assertEq(cedula.tokenOf(player), 1);
        assertEq(cedula.metadataHashOf(1), keccak256("meta"));
        assertTrue(cedula.locked(1));
        assertEq(cedula.totalSupply(), 1);
        assertEq(cedula.tokenURI(1), "https://example.com/api/metadata/1");
    }

    function test_IdsIncrement() public {
        _claim(player);
        assertEq(_claim(other), 2);
    }

    function test_RevertDoubleClaim() public {
        _claim(player);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _claimSig(SIGNER_PK, player, keccak256("meta2"), deadline);
        vm.prank(player);
        vm.expectRevert(Cedula.AlreadyClaimed.selector);
        cedula.claim(keccak256("meta2"), deadline, sig);
    }

    function test_RevertExpired() public {
        uint256 deadline = block.timestamp + 1;
        bytes memory sig = _claimSig(SIGNER_PK, player, keccak256("meta"), deadline);
        vm.warp(deadline + 1);
        vm.prank(player);
        vm.expectRevert(Cedula.Expired.selector);
        cedula.claim(keccak256("meta"), deadline, sig);
    }

    function test_RevertWrongSigner() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _claimSig(0xBAD, player, keccak256("meta"), deadline);
        vm.prank(player);
        vm.expectRevert(Cedula.InvalidSignature.selector);
        cedula.claim(keccak256("meta"), deadline, sig);
    }

    function test_RevertSignatureForAnotherPlayer() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _claimSig(SIGNER_PK, other, keccak256("meta"), deadline);
        vm.prank(player);
        vm.expectRevert(Cedula.InvalidSignature.selector);
        cedula.claim(keccak256("meta"), deadline, sig);
    }

    function test_RevertTamperedMetadata() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _claimSig(SIGNER_PK, player, keccak256("meta"), deadline);
        vm.prank(player);
        vm.expectRevert(Cedula.InvalidSignature.selector);
        cedula.claim(keccak256("other"), deadline, sig);
    }

    function test_RevertTransfer() public {
        _claim(player);
        vm.prank(player);
        vm.expectRevert(Cedula.Soulbound.selector);
        cedula.transferFrom(player, other, 1);
        vm.prank(player);
        vm.expectRevert(Cedula.Soulbound.selector);
        cedula.safeTransferFrom(player, other, 1);
    }

    function test_RevertApprovals() public {
        _claim(player);
        vm.startPrank(player);
        vm.expectRevert(Cedula.Soulbound.selector);
        cedula.approve(other, 1);
        vm.expectRevert(Cedula.Soulbound.selector);
        cedula.setApprovalForAll(other, true);
        vm.stopPrank();
    }

    function test_SupportsERC5192() public view {
        assertTrue(cedula.supportsInterface(0xb45a3c0e));
        assertTrue(cedula.supportsInterface(0x80ac58cd)); // ERC721
    }

    function test_RevertStampNotLedger() public {
        _claim(player);
        vm.expectRevert(Cedula.NotLedger.selector);
        cedula.stamp(1, 1);
    }

    function test_RevertStampInvalidLevel() public {
        _claim(player);
        vm.startPrank(address(ledger));
        vm.expectRevert(Cedula.InvalidLevel.selector);
        cedula.stamp(1, 0);
        vm.expectRevert(Cedula.InvalidLevel.selector);
        cedula.stamp(1, 11);
        vm.stopPrank();
    }

    function test_StampBitmap() public {
        _claim(player);
        vm.startPrank(address(ledger));
        cedula.stamp(1, 1);
        cedula.stamp(1, 10);
        vm.stopPrank();
        assertEq(cedula.stampsOf(1), (1 << 0) | (1 << 9));
    }

    function test_RevertLedgerSetTwice() public {
        vm.expectRevert(Cedula.LedgerAlreadySet.selector);
        cedula.setLedger(other);
    }

    function test_RevertSetLedgerNotOwner() public {
        Cedula fresh = new Cedula(signer, "");
        vm.prank(other);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, other));
        fresh.setLedger(other);
    }

    function test_OwnerUpdatesBaseURI() public {
        _claim(player);
        cedula.setBaseURI("https://new.host/m/");
        assertEq(cedula.tokenURI(1), "https://new.host/m/1");
        vm.prank(other);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, other));
        cedula.setBaseURI("x");
    }
}
