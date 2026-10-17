// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Cedula} from "../src/Cedula.sol";
import {Sellos} from "../src/Sellos.sol";

/// @notice Adds Sellos next to an existing deployment and merges its address into deployments/<chainid>.json.
/// Uses the same server signer and Cédula as the existing contracts.
contract DeploySellos is Script {
    function run() external {
        string memory path = string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".json");
        string memory existing = vm.readFile(path);

        address serverSigner = vm.parseJsonAddress(existing, ".serverSigner");
        address cedula = vm.parseJsonAddress(existing, ".cedula");
        if (vm.envOr("SERVER_SIGNER", address(0)) != address(0)) {
            require(vm.envAddress("SERVER_SIGNER") == serverSigner, "SERVER_SIGNER differs from the deployed signer");
        }
        require(Cedula(cedula).signer() == serverSigner, "Cedula signer differs from deployments file");
        string memory baseURI = vm.envOr("SELLOS_BASE_URI", string("https://republica-en-llamas.vercel.app/api/sellos/"));

        vm.startBroadcast();
        Sellos sellos = new Sellos(Cedula(cedula), serverSigner, baseURI);
        vm.stopBroadcast();

        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", vm.parseJsonUint(existing, ".chainId"));
        vm.serializeUint(obj, "blockNumber", vm.parseJsonUint(existing, ".blockNumber"));
        vm.serializeAddress(obj, "serverSigner", serverSigner);
        vm.serializeAddress(obj, "cedula", cedula);
        vm.serializeAddress(obj, "bunuelo", vm.parseJsonAddress(existing, ".bunuelo"));
        vm.serializeAddress(obj, "ledger", vm.parseJsonAddress(existing, ".ledger"));
        string memory json = vm.serializeAddress(obj, "sellos", address(sellos));
        vm.writeJson(json, path);

        console.log("Sellos          ", address(sellos));
        console.log("Merged into     ", path);
    }
}
