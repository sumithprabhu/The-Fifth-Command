const { ethers } = require('ethers');

// Configuration
const API_BASE_URL = 'https://the-fifth-command.onrender.com/api/v1';
const PRIVATE_KEY = '13c248b0ef54a4fbb4dc5aa9f9a0fa6729621a32bed05ad77d8868646588c71e';
const BID_AMOUNT = 100;

async function fetchGameStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/game/status`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching game status:', error);
    throw error;
  }
}

function generateSignature(gameId, round, cardId, bidder, amount) {
  // Create wallet from private key
  const wallet = new ethers.Wallet(PRIVATE_KEY);
  
  // Backend signs: keccak256(solidityPack([uint256, uint256, uint256, address, uint256], [gameId, round, cardId, bidder, amount]))
  // Note: timestamp and nonce are NOT included in the signature
  const packed = ethers.solidityPacked(
    ['uint256', 'uint256', 'uint256', 'address', 'uint256'],
    [gameId, round, cardId, bidder, amount]
  );
  
  // Hash the packed data
  const hash = ethers.keccak256(packed);
  
  // Sign the hash directly (not as a message - this is what the backend expects)
  // Convert hash string to bytes
  const hashBytes = ethers.getBytes(hash);
  
  // Sign the hash bytes using the signing key
  const signature = wallet.signingKey.sign(hashBytes);
  
  // Serialize the signature to hex string
  return ethers.Signature.from(signature).serialized;
}

async function submitBid(message, signature) {
  try {
    const response = await fetch(`${API_BASE_URL}/bid/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        signature,
      }),
    });
    
    const data = await response.json();
    return { ok: response.ok, data };
  } catch (error) {
    console.error('Error submitting bid:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting bid submission script...\n');
  
  try {
    // Step 1: Fetch current game status
    console.log('📡 Fetching current game status...');
    const gameStatus = await fetchGameStatus();
    
    console.log('Game Status:', {
      gameId: gameStatus.gameId,
      gameState: gameStatus.gameState,
      currentRound: gameStatus.currentRound,
      currentCard: gameStatus.currentCard,
    });
    
    // Check if game is in progress
    if (gameStatus.gameState !== 'InProgress') {
      console.error(`❌ Game is not in progress. Current state: ${gameStatus.gameState}`);
      process.exit(1);
    }
    
    // Extract required information
    const gameId = gameStatus.gameId;
    const round = gameStatus.currentRound;
    const cardId = gameStatus.currentCard?.id;
    
    if (!cardId) {
      console.error('❌ No current card available');
      process.exit(1);
    }
    
    // Get bidder address from private key
    const wallet = new ethers.Wallet(PRIVATE_KEY);
    const bidder = wallet.address.toLowerCase();
    
    // Create message object (timestamp and nonce are required by backend schema)
    const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    const nonce = Math.floor(Math.random() * 1000000); // Random nonce
    
    const message = {
      bidder: bidder,
      gameId: gameId,
      round: round,
      cardId: cardId,
      amount: BID_AMOUNT,
      timestamp: timestamp,
      nonce: nonce
    };
    
    console.log('\n📝 Bid Details:');
    console.log(`  Game ID: ${gameId}`);
    console.log(`  Round: ${round}`);
    console.log(`  Card ID: ${cardId}`);
    console.log(`  Bidder: ${bidder}`);
    console.log(`  Amount: ${BID_AMOUNT}`);
    console.log(`  Timestamp: ${timestamp}`);
    console.log(`  Nonce: ${nonce}`);
    
    // Step 2: Generate signature
    // Note: Signature is generated from gameId, round, cardId, bidder, amount only
    // (timestamp and nonce are NOT included in signature)
    console.log('\n🔐 Generating signature...');
    const signature = generateSignature(gameId, round, cardId, bidder, BID_AMOUNT);
    console.log(`  Signature: ${signature}`);
    
    // Step 3: Submit bid
    console.log('\n📤 Submitting bid...');
    const result = await submitBid(message, signature);
    
    if (result.ok && result.data.ok) {
      console.log('✅ Bid submitted successfully!');
      console.log('Response:', result.data);
    } else {
      console.error('❌ Bid submission failed!');
      console.error('Response:', result.data);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
