// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TheFifthCommand is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable gameCurrencyToken;

    uint256 public entryFee = 10 * 10**18; // 10 tokens (adjust decimals if needed)
    uint256 public startingChips = 500;

    uint256 public constant MIN_ENTRY_FEE = 1 * 10**18;
    uint256 public constant MAX_ENTRY_FEE = 100 * 10**18;
    uint256 public constant MIN_STARTING_CHIPS = 100;
    uint256 public constant MAX_STARTING_CHIPS = 5000;

    enum GameState {
        NotStarted,
        InProgress,
        Finished
    }

    // Current active game
    GameState public currentGameState = GameState.NotStarted;
    uint256 public currentGameId;
    uint256 public currentTotalPot; // in game tokens
    uint256 public currentRound;
    uint256 public currentTotalCards;

    // Players for current game
    address[] public currentPlayers;
    mapping(address => bool) public isCurrentPlayer;
    mapping(address => uint256) public currentChipBalance;
    mapping(address => uint256[]) public currentPlayerCards; // cardIds won by player

    // Historical games
    struct GameResult {
        uint256 gameId;
        address winner;
        uint256 potAmount;
        uint256 totalPlayers;
        uint256 timestamp;
    }

    GameResult[] public pastGames;

    event PlayerJoined(uint256 indexed gameId, address indexed player);
    event GameStarted(uint256 indexed gameId, uint256 totalCards);
    event CardSettled(
        uint256 indexed gameId,
        uint256 round,
        uint256 cardId,
        address indexed winner,
        uint256 price
    );
    event GameFinalized(uint256 indexed gameId, address indexed winner, uint256 pot);
    event EntryFeeUpdated(uint256 newFee);
    event StartingChipsUpdated(uint256 newChips);

    constructor(
        address initialOwner,
        address _gameCurrencyToken
    ) Ownable(initialOwner) {
        require(_gameCurrencyToken != address(0), "Invalid token address");
        gameCurrencyToken = IERC20(_gameCurrencyToken);
    }

    // ────────────────────────────────────────────────────────────────
    // Join current open game
    // ────────────────────────────────────────────────────────────────
    function joinGame() external {
        require(currentGameState == GameState.NotStarted, "Game not open for joining");
        require(!isCurrentPlayer[msg.sender], "Already joined");
        require(entryFee > 0, "Entry fee not set");

        // Transfer tokens from player to contract
        gameCurrencyToken.safeTransferFrom(msg.sender, address(this), entryFee);

        currentTotalPot += entryFee;
        currentChipBalance[msg.sender] = startingChips;
        isCurrentPlayer[msg.sender] = true;
        currentPlayers.push(msg.sender);

        emit PlayerJoined(currentGameId, msg.sender);
    }

    // ────────────────────────────────────────────────────────────────
    // Admin setters
    // ────────────────────────────────────────────────────────────────
    function setEntryFee(uint256 newFee) external onlyOwner {
        require(newFee >= MIN_ENTRY_FEE, "Fee too low");
        require(newFee <= MAX_ENTRY_FEE, "Fee too high");
        require(currentGameState == GameState.NotStarted, "Cannot change during active game");

        entryFee = newFee;
        emit EntryFeeUpdated(newFee);
    }

    function setStartingChips(uint256 newChips) external onlyOwner {
        require(newChips >= MIN_STARTING_CHIPS, "Chips too low");
        require(newChips <= MAX_STARTING_CHIPS, "Chips too high");
        require(currentGameState == GameState.NotStarted, "Cannot change during active game");

        startingChips = newChips;
        emit StartingChipsUpdated(newChips);
    }

    // ────────────────────────────────────────────────────────────────
    // Start the current game
    // ────────────────────────────────────────────────────────────────
    function startGame(uint256 totalCards) external onlyOwner {
        require(currentGameState == GameState.NotStarted, "Game already started");
        require(totalCards > 0, "Invalid card count");

        currentGameState = GameState.InProgress;
        currentTotalCards = totalCards;
        currentRound = 1;
        currentGameId++;

        emit GameStarted(currentGameId, totalCards);
    }

    // ────────────────────────────────────────────────────────────────
    // Settle one card
    // ────────────────────────────────────────────────────────────────
    function settleCard(
        uint256 cardId,
        address winner,
        uint256 finalPrice
    ) external onlyOwner {
        require(currentGameState == GameState.InProgress, "No active game");
        require(isCurrentPlayer[winner], "Not a player");
        require(currentChipBalance[winner] >= finalPrice, "Not enough chips");
        require(finalPrice > 0, "Invalid price");
        require(currentRound <= currentTotalCards, "All cards done");

        currentChipBalance[winner] -= finalPrice;
        currentPlayerCards[winner].push(cardId);

        emit CardSettled(currentGameId, currentRound, cardId, winner, finalPrice);

        currentRound++;

        if (currentRound > currentTotalCards) {
            currentGameState = GameState.Finished;
        }
    }

    // ────────────────────────────────────────────────────────────────
    // Finalize current game — send pot (ERC-20) to winner
    // ────────────────────────────────────────────────────────────────
    function finalizeGame(address winner) external onlyOwner {
        require(currentGameState == GameState.Finished, "Game not finished");
        require(isCurrentPlayer[winner], "Invalid winner");
        require(currentTotalPot > 0, "No pot");

        uint256 payout = currentTotalPot;
        currentTotalPot = 0;

        // Transfer ERC-20 tokens to winner
        gameCurrencyToken.safeTransfer(winner, payout);

        pastGames.push(
            GameResult({
                gameId: currentGameId,
                winner: winner,
                potAmount: payout,
                totalPlayers: currentPlayers.length,
                timestamp: block.timestamp
            })
        );

        emit GameFinalized(currentGameId, winner, payout);

        _resetCurrentGame();
    }

    function _resetCurrentGame() internal {
        currentGameState = GameState.NotStarted;
        currentTotalPot = 0;
        currentRound = 0;
        currentTotalCards = 0;

        for (uint256 i = 0; i < currentPlayers.length; i++) {
            address p = currentPlayers[i];
            isCurrentPlayer[p] = false;
            currentChipBalance[p] = 0;
            delete currentPlayerCards[p];
        }
        delete currentPlayers;
    }

    // ────────────────────────────────────────────────────────────────
    // View functions
    // ────────────────────────────────────────────────────────────────
    function getCurrentPlayerCount() external view returns (uint256) {
        return currentPlayers.length;
    }

    function getPastGamesCount() external view returns (uint256) {
        return pastGames.length;
    }

    function getPastGame(uint256 index) external view returns (GameResult memory) {
        return pastGames[index];
    }

    // Optional: recover stuck tokens (only owner)
    function recoverTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}