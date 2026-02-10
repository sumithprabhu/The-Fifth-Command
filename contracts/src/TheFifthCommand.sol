// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract TheFifthCommand is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    uint256 public entryFee;
    uint256 public startingChips;
    uint256 public maxPlayers;

    uint256 public constant MIN_ENTRY_FEE = 1 ether;
    uint256 public constant MAX_ENTRY_FEE = 100 ether;
    uint256 public constant MIN_STARTING_CHIPS = 100;
    uint256 public constant MAX_STARTING_CHIPS = 5000;

    enum GameState {
        NotStarted,
        InProgress,
        Finished
    }

    GameState public currentGameState;
    uint256 public currentGameId;
    uint256 public currentTotalPot;
    uint256 public currentRound;
    uint256 public currentTotalCards;

    address[] public currentPlayers;
    mapping(address => bool) public isCurrentPlayer;
    mapping(address => uint256) public currentChipBalance;
    mapping(address => uint256[]) public currentPlayerCards;

    struct GameResult {
        uint256 gameId;
        address winner;
        uint256 potPaid;
        uint256 potCarriedOver;
        uint256 totalPlayers;
        uint256 timestamp;
    }

    GameResult[] public pastGames;

    address public treasuryWallet;

    event PlayerJoined(uint256 indexed gameId, address indexed player);
    event PlayerLeft(uint256 indexed gameId, address indexed player);
    event GameStarted(uint256 indexed gameId, uint256 totalCards);
    event CardSettled(uint256 indexed gameId, uint256 round, uint256 cardId, address indexed winner, uint256 price);
    event GameFinalized(
        uint256 indexed gameId,
        address indexed winner,
        uint256 potPaid,
        uint256 potCarriedOver,
        uint256 feeTaken
    );
    event MaxPlayersUpdated(uint256 newMax);
    event EntryFeeUpdated(uint256 newFee);
    event StartingChipsUpdated(uint256 newChips);
    event TreasuryWalletUpdated(address newTreasury);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner, address _treasuryWallet) public initializer {
        __Ownable_init(initialOwner);

        entryFee = 10 ether;
        startingChips = 500;
        maxPlayers = 5;
        currentGameState = GameState.NotStarted;
        currentGameId = 1;
        treasuryWallet = _treasuryWallet;
    }

    // ────────────────────────────────────────────────────────────────
    // Setter for max players
    // ────────────────────────────────────────────────────────────────
    function setMaxPlayers(uint256 _maxPlayers) external onlyOwner {
        require(_maxPlayers >= 2, "Max players too low");
        require(currentGameState == GameState.NotStarted, "Cannot change during active game");
        maxPlayers = _maxPlayers;
        emit MaxPlayersUpdated(_maxPlayers);
    }

    // ────────────────────────────────────────────────────────────────
    // Setter for treasury wallet
    // ────────────────────────────────────────────────────────────────
    function setTreasuryWallet(address _treasuryWallet) external onlyOwner {
        require(_treasuryWallet != address(0), "Invalid treasury");
        treasuryWallet = _treasuryWallet;
        emit TreasuryWalletUpdated(_treasuryWallet);
    }

    // ────────────────────────────────────────────────────────────────
    // Join game
    // ────────────────────────────────────────────────────────────────
    function joinGame() external payable {
        require(currentGameState == GameState.NotStarted, "Game not open for joining");
        require(!isCurrentPlayer[msg.sender], "Already joined");
        require(msg.value == entryFee, "Must send exact entry fee");
        require(currentPlayers.length < maxPlayers, "Game is full");

        currentTotalPot += entryFee;
        currentChipBalance[msg.sender] = startingChips;
        isCurrentPlayer[msg.sender] = true;
        currentPlayers.push(msg.sender);

        emit PlayerJoined(currentGameId, msg.sender);
    }

    // ────────────────────────────────────────────────────────────────
    // Leave before game starts — refund with .call
    // ────────────────────────────────────────────────────────────────
    function leaveGame() external {
        require(currentGameState == GameState.NotStarted, "Game already started");
        require(isCurrentPlayer[msg.sender], "Not a player");

        // Remove from players array
        for (uint256 i = 0; i < currentPlayers.length; i++) {
            if (currentPlayers[i] == msg.sender) {
                currentPlayers[i] = currentPlayers[currentPlayers.length - 1];
                currentPlayers.pop();
                break;
            }
        }

        isCurrentPlayer[msg.sender] = false;
        currentChipBalance[msg.sender] = 0;

        // Refund using .call (replaces .transfer)
        uint256 amount = entryFee;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Refund failed");

        currentTotalPot -= amount;

        emit PlayerLeft(currentGameId, msg.sender);
    }

    // ────────────────────────────────────────────────────────────────
    // Setters for fee and chips
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
    // Start game
    // ────────────────────────────────────────────────────────────────
    function startGame(uint256 totalCards) external onlyOwner {
        require(currentGameState == GameState.NotStarted, "Game already started");
        require(totalCards > 0, "Invalid card count");

        currentGameState = GameState.InProgress;
        currentTotalCards = totalCards;
        currentRound = 1;

        emit GameStarted(currentGameId, totalCards);
    }

    // ────────────────────────────────────────────────────────────────
    // Settle one card
    // ────────────────────────────────────────────────────────────────
    function settleCard(uint256 cardId, address winner, uint256 finalPrice) external onlyOwner {
        require(currentGameState == GameState.InProgress, "No active game");
        require(currentRound <= currentTotalCards, "All cards done");

        // Allow skipped cards (no one bid)
        bool isSkipped = (finalPrice == 0 && winner == address(0));

        if (!isSkipped) {
            require(isCurrentPlayer[winner], "Not a player");
            require(currentChipBalance[winner] >= finalPrice, "Not enough chips");
            require(finalPrice > 0, "Invalid price");

            currentChipBalance[winner] -= finalPrice;
            currentPlayerCards[winner].push(cardId);
        }

        emit CardSettled(currentGameId, currentRound, cardId, winner, finalPrice);

        currentRound++;

        if (currentRound > currentTotalCards) {
            currentGameState = GameState.Finished;
        }
    }

    // ────────────────────────────────────────────────────────────────
    // Finalize game
    // ────────────────────────────────────────────────────────────────
    function finalizeGame(address winner) external onlyOwner {
        require(currentGameState == GameState.Finished, "Game not finished");

        uint256 potBeforeFee = currentTotalPot;
        uint256 fee = potBeforeFee * 10 / 100; // 10% fee
        uint256 payout = potBeforeFee - fee;

        address recipient = address(0);
        uint256 potPaid = 0;
        uint256 potCarriedOver = 0;

        // Send fee to treasury
        if (fee > 0) {
            (bool success, ) = payable(treasuryWallet).call{value: fee}("");
            require(success, "Fee transfer failed");
        }

        if (isCurrentPlayer[winner]) {
            recipient = winner;
            potPaid = payout;

            (bool success, ) = payable(winner).call{value: payout}("");
            require(success, "Payout to winner failed");

            currentTotalPot = 0;
        } else {
            // No valid winner → carry over (after fee)
            recipient = address(0);
            potPaid = 0;
            potCarriedOver = payout;
            currentTotalPot = potCarriedOver;
        }

        pastGames.push(
            GameResult({
                gameId: currentGameId,
                winner: recipient,
                potPaid: potPaid,
                potCarriedOver: potCarriedOver,
                totalPlayers: currentPlayers.length,
                timestamp: block.timestamp
            })
        );

        emit GameFinalized(currentGameId, recipient, potPaid, potCarriedOver, fee);

        // Prepare next game
        currentGameId++;
        _resetCurrentGame();
    }

    function _resetCurrentGame() internal {
        currentGameState = GameState.NotStarted;
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

    // Safety: recover stuck ETH (onlyOwner)
    function recoverNative(uint256 amount) external onlyOwner {
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Recovery failed");
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // Allow contract to receive ETH
    receive() external payable {}
}