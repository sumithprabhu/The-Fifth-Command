// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {TheFifthCommand} from "../src/TheFifthCommand.sol";
import {console} from "forge-std/console.sol";

contract DeployTheFifthCommand is Script {
    function run() public returns (TheFifthCommand) {
        // Start broadcasting with the account that's running the script
        vm.startBroadcast();

        // Deploy the contract and set the broadcaster (msg.sender during broadcast) as owner
        TheFifthCommand game = new TheFifthCommand(msg.sender);

        vm.stopBroadcast();

        // Log useful information
        console.log("TheFifthCommand deployed at:", address(game));
        console.log("Initial owner (broadcaster):", msg.sender);

        return game;
    }
}