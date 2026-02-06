// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TheFifthCommand.sol";

contract TheFifthCommandTest is Test {
    TheFifthCommand game;
    address owner = address(0xABCD);
    address player1 = address(0x1111);
    address player2 = address(0x2222);
    address player3 = address(0x3333);
    address nonPlayer = address(0x9999);

    uint256 constant INITIAL_FEE = 10 ether;
    uint256 constant INITIAL_CHIPS = 500;

    receive() external payable {}

    function setUp() public {
        vm.deal(owner, 1000 ether);
        vm.deal(player1, 100 ether);
        vm.deal(player2, 100 ether);
        vm.deal(player3, 100 ether);

        vm.prank(owner);
        game = new TheFifthCommand(owner);
    }

    // ────────────────────────────────────────────────────────────────
    // Basic setup & ownership
    // ────────────────────────────────────────────────────────────────

    function test_InitialState() public {
        assertEq(game.owner(), owner);
        assertEq(game.entryFee(), INITIAL_FEE);
        assertEq(game.startingChips(), INITIAL_CHIPS);
        assertEq(uint256(game.currentGameState()), uint256(TheFifthCommand.GameState.NotStarted));
        assertEq(game.currentGameId(), 0);
        assertEq(game.currentTotalPot(), 0);
    }

    function test_OwnableOnlyFunctions() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, player1));
        vm.prank(player1);
        game.setEntryFee(15 ether);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, player1));
        vm.prank(player1);
        game.startGame(10);
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
    // Game flow: start → settle → finalize
    // ────────────────────────────────────────────────────────────────

    function test_FullGameFlow() public {
        // Join
        vm.prank(player1);
        game.joinGame{value: INITIAL_FEE}();

        vm.prank(player2);
        game.joinGame{value: INITIAL_FEE}();

        assertEq(game.currentTotalPot(), 20 ether);

        // Start game
        vm.prank(owner);
        game.startGame(3); // 3 cards

        assertEq(uint256(game.currentGameState()), uint256(TheFifthCommand.GameState.InProgress));

        // Settle cards
        vm.prank(owner);
        game.settleCard(1, player1, 120);

        vm.prank(owner);
        game.settleCard(2, player2, 80);

        vm.prank(owner);
        game.settleCard(3, player1, 200);

        assertEq(uint256(game.currentGameState()), uint256(TheFifthCommand.GameState.Finished));

        // Finalize
        uint256 initialBalance = player1.balance;
        vm.prank(owner);
        game.finalizeGame(player1);

        assertEq(player1.balance, initialBalance + 20 ether);
        assertEq(game.currentTotalPot(), 0);
        assertEq(uint256(game.currentGameState()), uint256(TheFifthCommand.GameState.NotStarted));
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

    // ────────────────────────────────────────────────────────────────
    // Finalize edge cases
    // ────────────────────────────────────────────────────────────────

    function test_Finalize_NotFinished_Reverts() public {
        vm.prank(player1);
        game.joinGame{value: INITIAL_FEE}();

        vm.prank(owner);
        game.startGame(3);

        vm.expectRevert("Game not finished");
        vm.prank(owner);
        game.finalizeGame(player1);
    }

    function test_Finalize_InvalidWinner_Reverts() public {
        vm.prank(player1);
        game.joinGame{value: INITIAL_FEE}();

        vm.prank(owner);
        game.startGame(1);

        vm.prank(owner);
        game.settleCard(1, player1, 100);

        vm.expectRevert("Invalid winner");
        vm.prank(owner);
        game.finalizeGame(nonPlayer);
    }
}
