// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Base} from "./Base.t.sol";
import {RepublicaLedger} from "../src/RepublicaLedger.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract RepublicaLedgerTest is Base {
    function setUp() public override {
        super.setUp();
        _claim(player);
    }

    function test_HashMatchesHelper() public view {
        RepublicaLedger.Checkpoint memory cp = _cp(player, 1, 1e18, 0, 1);
        assertEq(ledger.hashCheckpoint(cp), _cpHash(cp));
        assertEq(ledger.domainSeparator(), _domain(address(ledger)));
    }

    function test_CommitMintsAndRecords() public {
        RepublicaLedger.Checkpoint memory cp = _cp(player, 1, 50e18, 0, 1);
        vm.expectEmit(address(ledger));
        emit RepublicaLedger.ChoiceMade(player, 101, 1);
        vm.expectEmit(address(ledger));
        emit RepublicaLedger.TaskCompleted(player, 1, 1, 50e18, 0);
        _commit(cp);
        assertEq(bunuelo.balanceOf(player), 50e18);
        assertEq(ledger.lastTask(player, 1), 1);
        assertTrue(ledger.nonceUsed(player, 1));
        (uint8 option, bool chosen) = ledger.choiceOf(player, 101);
        assertEq(option, 1);
        assertTrue(chosen);
    }

    function test_EarnThenSpendSameCheckpoint() public {
        _commit(_cp(player, 1, 30e18, 10e18, 1));
        assertEq(bunuelo.balanceOf(player), 20e18);
    }

    function test_RevertOverspend() public {
        _commit(_cp(player, 1, 10e18, 0, 1));
        RepublicaLedger.Checkpoint memory cp = _cp(player, 2, 0, 11e18, 2);
        bytes memory sig = _cpSig(SIGNER_PK, cp);
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, player, 10e18, 11e18));
        ledger.commitCheckpoint(cp, sig);
    }

    function test_RevertNotPlayer() public {
        RepublicaLedger.Checkpoint memory cp = _cp(player, 1, 0, 0, 1);
        bytes memory sig = _cpSig(SIGNER_PK, cp);
        vm.prank(other);
        vm.expectRevert(RepublicaLedger.NotPlayer.selector);
        ledger.commitCheckpoint(cp, sig);
    }

    function test_RevertNoCedula() public {
        RepublicaLedger.Checkpoint memory cp = _cp(other, 1, 0, 0, 1);
        bytes memory sig = _cpSig(SIGNER_PK, cp);
        vm.prank(other);
        vm.expectRevert(RepublicaLedger.NoCedula.selector);
        ledger.commitCheckpoint(cp, sig);
    }

    function test_RevertOutOfOrder() public {
        RepublicaLedger.Checkpoint memory cp = _cp(player, 2, 0, 0, 1);
        bytes memory sig = _cpSig(SIGNER_PK, cp);
        vm.prank(player);
        vm.expectRevert(RepublicaLedger.TaskOutOfOrder.selector);
        ledger.commitCheckpoint(cp, sig);
    }

    function test_RevertRepeatedTask() public {
        _commit(_cp(player, 1, 0, 0, 1));
        RepublicaLedger.Checkpoint memory cp = _cp(player, 1, 0, 0, 2);
        bytes memory sig = _cpSig(SIGNER_PK, cp);
        vm.prank(player);
        vm.expectRevert(RepublicaLedger.TaskOutOfOrder.selector);
        ledger.commitCheckpoint(cp, sig);
    }

    function test_RevertNonceReuse() public {
        _commit(_cp(player, 1, 0, 0, 7));
        RepublicaLedger.Checkpoint memory cp = _cp(player, 2, 0, 0, 7);
        bytes memory sig = _cpSig(SIGNER_PK, cp);
        vm.prank(player);
        vm.expectRevert(RepublicaLedger.NonceUsed.selector);
        ledger.commitCheckpoint(cp, sig);
    }

    function test_RevertExpired() public {
        RepublicaLedger.Checkpoint memory cp = _cp(player, 1, 0, 0, 1);
        bytes memory sig = _cpSig(SIGNER_PK, cp);
        vm.warp(cp.deadline + 1);
        vm.prank(player);
        vm.expectRevert(RepublicaLedger.Expired.selector);
        ledger.commitCheckpoint(cp, sig);
    }

    function test_RevertWrongSigner() public {
        RepublicaLedger.Checkpoint memory cp = _cp(player, 1, 0, 0, 1);
        bytes memory sig = _cpSig(0xBAD, cp);
        vm.prank(player);
        vm.expectRevert(RepublicaLedger.InvalidSignature.selector);
        ledger.commitCheckpoint(cp, sig);
    }

    function test_RevertTamperedAmount() public {
        RepublicaLedger.Checkpoint memory cp = _cp(player, 1, 10e18, 0, 1);
        bytes memory sig = _cpSig(SIGNER_PK, cp);
        cp.earned = 100e18;
        vm.prank(player);
        vm.expectRevert(RepublicaLedger.InvalidSignature.selector);
        ledger.commitCheckpoint(cp, sig);
    }

    function test_RevertEarnCap() public {
        RepublicaLedger.Checkpoint memory cp = _cp(player, 1, 200e18 + 1, 0, 1);
        bytes memory sig = _cpSig(SIGNER_PK, cp);
        vm.prank(player);
        vm.expectRevert(RepublicaLedger.EarnCapExceeded.selector);
        ledger.commitCheckpoint(cp, sig);
    }

    function test_RevertLengthMismatch() public {
        RepublicaLedger.Checkpoint memory cp = _cp(player, 1, 0, 0, 1);
        cp.options = new uint8[](2);
        bytes memory sig = _cpSig(SIGNER_PK, cp);
        vm.prank(player);
        vm.expectRevert(RepublicaLedger.LengthMismatch.selector);
        ledger.commitCheckpoint(cp, sig);
    }

    function test_RevertInvalidOption() public {
        RepublicaLedger.Checkpoint memory cp = _cp(player, 1, 0, 0, 1);
        cp.options[0] = 8;
        bytes memory sig = _cpSig(SIGNER_PK, cp);
        vm.prank(player);
        vm.expectRevert(RepublicaLedger.InvalidOption.selector);
        ledger.commitCheckpoint(cp, sig);
    }

    function test_RevertInvalidLevel() public {
        RepublicaLedger.Checkpoint memory cp = _cp(player, 1, 0, 0, 1);
        cp.level = 11;
        bytes memory sig = _cpSig(SIGNER_PK, cp);
        vm.prank(player);
        vm.expectRevert(RepublicaLedger.InvalidLevel.selector);
        ledger.commitCheckpoint(cp, sig);
    }

    function test_ChoiceTallies() public {
        _claim(other);
        RepublicaLedger.Checkpoint memory a = _cp(player, 1, 0, 0, 1);
        RepublicaLedger.Checkpoint memory b = _cp(other, 1, 0, 0, 1);
        b.options[0] = 2;
        _commit(a);
        _commit(b);
        uint256[8] memory stats = ledger.getChoiceStats(101);
        assertEq(stats[1], 1);
        assertEq(stats[2], 1);
        assertEq(stats[0], 0);
    }

    function test_LevelCompletionStampsCedula() public {
        for (uint8 t = 1; t <= 4; ++t) {
            _commit(_cp(player, t, 10e18, 0, t));
        }
        RepublicaLedger.Checkpoint memory last = _cp(player, 5, 10e18, 0, 5);
        last.fates = [uint8(0), 1, 0];
        vm.expectEmit(address(ledger));
        emit RepublicaLedger.LevelCompleted(player, 1, last.fates);
        _commit(last);
        assertEq(cedula.stampsOf(1), 1);
        uint8[3] memory f = ledger.fatesOf(player, 1);
        assertEq(f[1], 1);

        RepublicaLedger.Checkpoint memory sixth = _cp(player, 6, 0, 0, 6);
        bytes memory sig = _cpSig(SIGNER_PK, sixth);
        vm.prank(player);
        vm.expectRevert(RepublicaLedger.TaskOutOfOrder.selector);
        ledger.commitCheckpoint(sixth, sig);
    }

    function test_RevertInvalidFate() public {
        for (uint8 t = 1; t <= 4; ++t) {
            _commit(_cp(player, t, 0, 0, t));
        }
        RepublicaLedger.Checkpoint memory last = _cp(player, 5, 0, 0, 5);
        last.fates = [uint8(4), 0, 0];
        bytes memory sig = _cpSig(SIGNER_PK, last);
        vm.prank(player);
        vm.expectRevert(RepublicaLedger.InvalidFate.selector);
        ledger.commitCheckpoint(last, sig);
    }

    function testFuzz_SupplyEqualsMintedMinusBurned(uint256[5] memory earns, uint256[5] memory spends) public {
        uint256 minted;
        uint256 burned;
        uint256 balance;
        for (uint8 t = 1; t <= 5; ++t) {
            uint256 e = bound(earns[t - 1], 0, 200e18);
            uint256 s = bound(spends[t - 1], 0, balance + e);
            _commit(_cp(player, t, e, s, t));
            minted += e;
            burned += s;
            balance = balance + e - s;
        }
        assertEq(bunuelo.totalSupply(), minted - burned);
        assertEq(bunuelo.balanceOf(player), balance);
    }
}
