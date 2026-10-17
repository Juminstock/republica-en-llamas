// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Buñuelo
/// @notice Testnet game currency. Only the ledger can mint and burn; there is no other issuance.
contract Bunuelo is ERC20, Ownable {
    address public ledger;

    event LedgerSet(address ledger);

    error NotLedger();
    error LedgerAlreadySet();

    constructor() ERC20(unicode"Buñuelo", "BUNUELO") Ownable(msg.sender) {}

    modifier onlyLedger() {
        if (msg.sender != ledger) revert NotLedger();
        _;
    }

    function setLedger(address ledger_) external onlyOwner {
        if (ledger != address(0)) revert LedgerAlreadySet();
        ledger = ledger_;
        emit LedgerSet(ledger_);
    }

    function mint(address to, uint256 amount) external onlyLedger {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyLedger {
        _burn(from, amount);
    }
}
