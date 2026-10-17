// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Base} from "./Base.t.sol";
import {Bunuelo} from "../src/Bunuelo.sol";

contract BunueloTest is Base {
    function test_Metadata() public view {
        assertEq(bunuelo.symbol(), "BUNUELO");
        assertEq(bunuelo.decimals(), 18);
    }

    function test_RevertMintNotLedger() public {
        vm.expectRevert(Bunuelo.NotLedger.selector);
        bunuelo.mint(player, 1);
    }

    function test_RevertBurnNotLedger() public {
        vm.expectRevert(Bunuelo.NotLedger.selector);
        bunuelo.burn(player, 1);
    }

    function test_RevertLedgerSetTwice() public {
        vm.expectRevert(Bunuelo.LedgerAlreadySet.selector);
        bunuelo.setLedger(other);
    }

    function test_LedgerMintsAndBurns() public {
        vm.startPrank(address(ledger));
        bunuelo.mint(player, 10e18);
        bunuelo.burn(player, 4e18);
        vm.stopPrank();
        assertEq(bunuelo.balanceOf(player), 6e18);
    }
}
