// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TheFifthCommand.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract TheFifthCommandTest is Test {
    TheFifthCommand game;
    address owner = address(0xABCD);
    address player1 = address(0x1111);
    address player2 = address(0x2222);
    address player3 = address(0x3333);
    address player4 = address(0x4444);
    address player5 = address(0x5555);
    address player6 = address(0x6666);
    address nonPlayer = address(0x9999);
    address treasury = address(0x7777);

    uint256 constant INITIAL_FEE = 10 ether;
    uint256 constant INITIAL_CHIPS = 500;

    receive() external payable {}

    function setUp() public {
        vm.deal(owner, 1000 ether);
        vm.deal(player1, 100 ether);
        vm.deal(player2, 100 ether);
        vm.deal(player3, 100 ether);
        vm.deal(player4, 100 ether);
        vm.deal(player5, 100 ether);
        vm.deal(player6, 100 ether);
        vm.deal(treasury, 0 ether);

        // Deploy implementation
        TheFifthCommand implementation = new TheFifthCommand();

        // Prepare initializer data
        bytes memory initData = abi.encodeCall(TheFifthCommand.initialize, (owner, treasury));

        // Deploy proxy pointing to implementation
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

        // Cast proxy to contract interface
        game = TheFifthCommand(payable(address(proxy)));

        // Verify initialization
        assertEq(game.owner(), owner);
        assertEq(game.treasuryWallet(), treasury);
        assertEq(game.currentGameId(), 1);
    }

    // ────────────────────────────────────────────────────────────────
    // Basic setup & ownership
    // ────────────────────────────────────────────────────────────────

    function test_InitialState() public {
        assertEq(game.owner(), owner);
        assertEq(game.entryFee(), INITIAL_FEE);
        assertEq(game.startingChips(), INITIAL_CHIPS);
        assertEq(game.maxPlayers(), 5);
        assertEq(uint256(game.currentGameState()), uint256(TheFifthCommand.GameState.NotStarted));
        assertEq(game.currentGameId(), 1);
        assertEq(game.currentTotalPot(), 0);
        assertEq(game.treasuryWallet(), treasury);
    }

    // ────────────────────────────────────────────────────────────────
    // Parameter setters
    // ────────────────────────────────────────────────────────────────

    function test_SetEntryFee() public {
        vm.prank(owner);
        game.setEntryFee(15 ether);
        assertEq(game.entryFee(), 15 ether);

        vm.expectRevert("Fee too low");
        vm.prank(owner);
        game.setEntryFee(0.5 ether);

        vm.prank(owner);
        game.startGame(5);
        vm.expectRevert("Cannot change during active game");
        vm.prank(owner);
        game.setEntryFee(20 ether);
    }

    function test_SetStartingChips() public {
        vm.prank(owner);
        game.setStartingChips(1000);
        assertEq(game.startingChips(), 1000);

        vm.expectRevert("Chips too low");
        vm.prank(owner);
        game.setStartingChips(50);
    }

    function test_SetMaxPlayers() public {
        vm.prank(owner);
        game.setMaxPlayers(8);
        assertEq(game.maxPlayers(), 8);

        vm.expectRevert("Max players too low");
        vm.prank(owner);
        game.setMaxPlayers(1);
    }

    // ────────────────────────────────────────────────────────────────
    // Joining game
    // ────────────────────────────────────────────────────────────────

    function test_JoinGame_Success() public {
        vm.prank(player1);
        game.joinGame{value: INITIAL_FEE}();

        assertEq(game.currentTotalPot(), INITIAL_FEE);
        assertEq(game.currentChipBalance(player1), INITIAL_CHIPS);
        assertTrue(game.isCurrentPlayer(player1));
        assertEq(game.getCurrentPlayerCount(), 1);
    }

    function test_JoinGame_GameFull_Reverts() public {
        vm.prank(player1);
        game.joinGame{value: INITIAL_FEE}();
        vm.prank(player2);
        game.joinGame{value: INITIAL_FEE}();
        vm.prank(player3);
        game.joinGame{value: INITIAL_FEE}();
        vm.prank(player4);
        game.joinGame{value: INITIAL_FEE}();
        vm.prank(player5);
        game.joinGame{value: INITIAL_FEE}();

        vm.expectRevert("Game is full");
        vm.prank(player6);
        game.joinGame{value: INITIAL_FEE}();
    }

    function test_JoinGame_WrongValue_Reverts() public {
        vm.expectRevert("Must send exact entry fee");
        vm.prank(player1);
        game.joinGame{value: 5 ether}();
    }

    function test_JoinGame_AlreadyJoined_Reverts() public {
        vm.prank(player1);
        game.joinGame{value: INITIAL_FEE}();

        vm.expectRevert("Already joined");
        vm.prank(player1);
        game.joinGame{value: INITIAL_FEE}();
    }

    function test_JoinGame_AfterStart_Reverts() public {
        vm.prank(player1);
        game.joinGame{value: INITIAL_FEE}();

        vm.prank(owner);
        game.startGame(5);

        vm.expectRevert("Game not open for joining");
        vm.prank(player2);
        game.joinGame{value: INITIAL_FEE}();
    }

    // ────────────────────────────────────────────────────────────────
    // Leaving game before start
    // ────────────────────────────────────────────────────────────────

    function test_LeaveGame_Success() public {
        vm.prank(player1);
        game.joinGame{value: INITIAL_FEE}();

        uint256 initialBalance = player1.balance;

        vm.prank(player1);
        game.leaveGame();

        assertEq(player1.balance, initialBalance + INITIAL_FEE);
        assertEq(game.currentTotalPot(), 0);
        assertEq(game.getCurrentPlayerCount(), 0);
        assertFalse(game.isCurrentPlayer(player1));
    }

    function test_LeaveGame_AfterStart_Reverts() public {
        vm.prank(player1);
        game.joinGame{value: INITIAL_FEE}();

        vm.prank(owner);
        game.startGame(1);

        vm.expectRevert("Game already started");
        vm.prank(player1);
        game.leaveGame();
    }

    // ────────────────────────────────────────────────────────────────
    // Game flow: start → settle → finalize
    // ────────────────────────────────────────────────────────────────

    function test_FullGameFlow_WithWinner() public {
        vm.prank(player1);
        game.joinGame{value: INITIAL_FEE}();

        vm.prank(player2);
        game.joinGame{value: INITIAL_FEE}();

        assertEq(game.currentTotalPot(), 20 ether);

        vm.prank(owner);
        game.startGame(3);

        vm.prank(owner);
        game.settleCard(1, player1, 120);

        vm.prank(owner);
        game.settleCard(2, player2, 80);

        vm.prank(owner);
        game.settleCard(3, player1, 200);

        assertEq(uint256(game.currentGameState()), uint256(TheFifthCommand.GameState.Finished));

        uint256 player1BalanceBefore = player1.balance;
        uint256 treasuryBalanceBefore = treasury.balance;

        vm.prank(owner);
        game.finalizeGame(player1);

        // 10% fee = 2 ether
        assertEq(treasury.balance, treasuryBalanceBefore + 2 ether);
        assertEq(player1.balance, player1BalanceBefore + 18 ether);
        assertEq(game.currentTotalPot(), 0);
        assertEq(game.currentGameId(), 2); // incremented
        assertEq(uint256(game.currentGameState()), uint256(TheFifthCommand.GameState.NotStarted));
    }

    function test_Finalize_NoValidWinner_PotCarriesOver() public {
        vm.prank(player1);
        game.joinGame{value: INITIAL_FEE}();

        vm.prank(owner);
        game.startGame(1);

        vm.prank(owner);
        game.settleCard(1, player1, 100);

        vm.prank(owner);
        game.finalizeGame(nonPlayer); // invalid winner

        assertEq(game.currentTotalPot(), INITIAL_FEE - INITIAL_FEE * 10/100); // carried over
        assertEq(game.currentGameId(), 2);
    }

    function test_SettleCard_InvalidWinner_Reverts() public {
        vm.prank(player1);
        game.joinGame{value: INITIAL_FEE}();

        vm.prank(owner);
        game.startGame(3);

        vm.expectRevert("Not a player");
        vm.prank(owner);
        game.settleCard(1, nonPlayer, 100);
    }

    function test_SettleCard_NotEnoughChips_Reverts() public {
        vm.prank(player1);
        game.joinGame{value: INITIAL_FEE}();

        vm.prank(owner);
        game.startGame(3);

        vm.expectRevert("Not enough chips");
        vm.prank(owner);
        game.settleCard(1, player1, 600);
    }

    function test_Finalize_NotFinished_Reverts() public {
        vm.prank(player1);
        game.joinGame{value: INITIAL_FEE}();

        vm.prank(owner);
        game.startGame(3);

        vm.expectRevert("Game not finished");
        vm.prank(owner);
        game.finalizeGame(player1);
    }
}
