// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {TheFifthCommand} from "../src/TheFifthCommand.sol";

// token: address 0x48944A87a032755aCC2AF0AAf14A1e20E69eB88B
// game: address 0x86916e1aa3D38747f92Cc9dE50Be4dC9f96e607b

contract TestGameToken {
    string public name = "The Fifth Command";
    string public symbol = "FIF";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() {
    }

    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");

        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;

        emit Transfer(from, to, amount);
        return true;
    }
}

contract DeployTheFifthCommand is Script {
    function run() public returns (address token, address game) {
        vm.startBroadcast();

        // ────────────────────────────────────────────────────────────────
        // 1. Deploy the ERC-20 token
        // ────────────────────────────────────────────────────────────────
        TestGameToken gameToken = new TestGameToken();
        console.log("TestGameToken deployed at:", address(gameToken));

        // Mint 1,000,000 tokens to the deployer (msg.sender)
        uint256 mintAmount = 1_000_000 * 10**18;
        gameToken.mint(mintAmount);
        console.log("Minted %s tokens to %s", mintAmount, msg.sender);

        // ────────────────────────────────────────────────────────────────
        // 2. Deploy TheFifthCommand with the token as currency
        // ────────────────────────────────────────────────────────────────
        TheFifthCommand gameContract = new TheFifthCommand(msg.sender, address(gameToken));
        console.log("TheFifthCommand deployed at:", address(gameContract));
        console.log("Owner:", msg.sender);
        console.log("Game currency token:", address(gameToken));

        gameToken.approve(address(gameContract), mintAmount);
        // gameContract.startGame(5);
        gameContract.joinGame();

        vm.stopBroadcast();

        return (address(gameToken), address(gameContract));
    }
}