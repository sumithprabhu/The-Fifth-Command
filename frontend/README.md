<div align="center">
  <img src="public/logo.png" alt="The Fifth Command Logo" width="200" height="200">
  
  # The Fifth Command
  
</div>

## About

The Fifth Command frontend is a Next.js web application that provides the user interface for the real-time strategic auction card game. Built with React, TypeScript, and Tailwind CSS, it offers a modern and responsive experience for watching live tournaments, viewing game history, and interacting with the game ecosystem.

The frontend integrates with the backend API for real-time game data and connects to the Ethereum smart contract for on-chain interactions. It features dynamic tournament pages, real-time chat, card displays, and a comprehensive game viewing experience.

## Deployment Details

| **Property** | **Value** |
|--------------|-----------|
| **Framework** | Next.js 16 |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **Backend API** | `https://the-fifth-command.onrender.com/api/v1` |
| **WebSocket** | `wss://the-fifth-command.onrender.com` |

## Frontend Features

The frontend provides the following core functionality:
- Homepage with tournament listings and game information
- Live tournament viewing with real-time updates
- Dynamic game pages with per-game routing (`/tournament/[id]`)
- Real-time chat integration via Socket.IO
- Card showcase and character displays
- Team page and token information
- Responsive design with smooth animations
- Smart contract integration for game state
- Winner declaration and confetti celebrations
