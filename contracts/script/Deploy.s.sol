// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Cedula} from "../src/Cedula.sol";
import {Bunuelo} from "../src/Bunuelo.sol";
import {RepublicaLedger} from "../src/RepublicaLedger.sol";

/// @notice Deploys and wires the three contracts, then writes deployments/<chainid>.json.
contract Deploy is Script {
    function run() external {
        address serverSigner = vm.envAddress("SERVER_SIGNER");
        string memory baseURI = vm.envString("METADATA_BASE_URI");

        vm.startBroadcast();
        Cedula cedula = new Cedula(serverSigner, baseURI);
        Bunuelo bunuelo = new Bunuelo();
        RepublicaLedger ledger = new RepublicaLedger(cedula, bunuelo, serverSigner);
        cedula.setLedger(address(ledger));
        bunuelo.setLedger(address(ledger));
        vm.stopBroadcast();

        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeUint(obj, "blockNumber", block.number);
        vm.serializeAddress(obj, "serverSigner", serverSigner);
        vm.serializeAddress(obj, "cedula", address(cedula));
        vm.serializeAddress(obj, "bunuelo", address(bunuelo));
        string memory json = vm.serializeAddress(obj, "ledger", address(ledger));
        string memory path = string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);

        console.log("Cedula          ", address(cedula));
        console.log("Bunuelo         ", address(bunuelo));
        console.log("RepublicaLedger ", address(ledger));
        console.log("Written to      ", path);
    }
}
