// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Cedula} from "../src/Cedula.sol";
import {Bunuelo} from "../src/Bunuelo.sol";
import {RepublicaLedger} from "../src/RepublicaLedger.sol";

abstract contract Base is Test {
    uint256 internal constant SIGNER_PK = 0xA11CE;
    address internal signer;
    address internal player = makeAddr("player");
    address internal other = makeAddr("other");

    Cedula internal cedula;
    Bunuelo internal bunuelo;
    RepublicaLedger internal ledger;

    bytes32 internal constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    function setUp() public virtual {
        signer = vm.addr(SIGNER_PK);
        cedula = new Cedula(signer, "https://example.com/api/metadata/");
        bunuelo = new Bunuelo();
        ledger = new RepublicaLedger(cedula, bunuelo, signer);
        cedula.setLedger(address(ledger));
        bunuelo.setLedger(address(ledger));
    }

    function _domain(address verifying) internal view returns (bytes32) {
        return keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256("RepublicaEnLlamas"), keccak256("1"), block.chainid, verifying)
        );
    }

    function _sign(uint256 pk, bytes32 domain, bytes32 structHash) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, keccak256(abi.encodePacked("\x19\x01", domain, structHash)));
        return abi.encodePacked(r, s, v);
    }

    function _claimSig(uint256 pk, address who, bytes32 mh, uint256 deadline) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(keccak256("Claim(address player,bytes32 metadataHash,uint256 deadline)"), who, mh, deadline)
        );
        return _sign(pk, _domain(address(cedula)), structHash);
    }

    function _claim(address who) internal returns (uint256) {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _claimSig(SIGNER_PK, who, keccak256("meta"), deadline);
        vm.prank(who);
        return cedula.claim(keccak256("meta"), deadline, sig);
    }

    function _cp(address who, uint8 task, uint256 earned, uint256 spent, uint256 nonce)
        internal
        view
        returns (RepublicaLedger.Checkpoint memory cp)
    {
        cp.player = who;
        cp.level = 1;
        cp.task = task;
        cp.choiceIds = new uint16[](1);
        cp.choiceIds[0] = uint16(100 + task);
        cp.options = new uint8[](1);
        cp.options[0] = 1;
        cp.earned = earned;
        cp.spent = spent;
        cp.nonce = nonce;
        cp.deadline = block.timestamp + 1 hours;
    }

    // Mirrors RepublicaLedger.hashCheckpoint independently of the contract.
    function _cpHash(RepublicaLedger.Checkpoint memory cp) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256(
                    "Checkpoint(address player,uint16 level,uint8 task,uint16[] choiceIds,uint8[] options,uint8[3] fates,uint256 earned,uint256 spent,uint256 nonce,uint256 deadline)"
                ),
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

    function _cpSig(uint256 pk, RepublicaLedger.Checkpoint memory cp) internal view returns (bytes memory) {
        return _sign(pk, _domain(address(ledger)), _cpHash(cp));
    }

    function _commit(RepublicaLedger.Checkpoint memory cp) internal {
        bytes memory sig = _cpSig(SIGNER_PK, cp);
        vm.prank(cp.player);
        ledger.commitCheckpoint(cp, sig);
    }
}
