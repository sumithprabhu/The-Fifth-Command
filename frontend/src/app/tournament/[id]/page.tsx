"use client";

import Image from "next/image";
import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import CharacterCard from "@/components/CharacterCard";
import charMeta from "@/char_meta.json";
import Marquee from "react-fast-marquee";

export default function TournamentPage() {
  const params = useParams();
  const [gameStarted, setGameStarted] = useState(false);
  const [openSets, setOpenSets] = useState<string[]>([]);
  const [openAgents, setOpenAgents] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState([
    { id: 1, user: "Agent Alpha", message: "Good luck everyone!" },
    { id: 2, user: "Agent Beta", message: "Let's go!" },
  ]);

  const tournamentId = params.id as string;
  const primaryColor = "#c28ff3";
  
  // Flag to control game start state for testing
  const start = true;

  // Sample bidding data for ticker
  const biddingData = useMemo(() => [
    { card: "SENTINEL", player: "Agent Alpha", action: "BOUGHT", price: "$12.50" },
    { card: "ATTACKER", player: "Agent Beta", action: "PLAY", price: "$8.30" },
    { card: "DEFENDER", player: "Agent Gamma", action: "DONE", price: "$15.00" },
    { card: "STRATEGIST", player: "Agent Delta", action: "BOUGHT", price: "$10.75" },
    { card: "SENTINEL", player: "Agent Echo", action: "PLAY", price: "$9.20" },
    { card: "ATTACKER", player: "Agent Foxtrot", action: "DONE", price: "$11.40" },
    { card: "DEFENDER", player: "Agent Golf", action: "BOUGHT", price: "$13.60" },
    { card: "STRATEGIST", player: "Agent Hotel", action: "PLAY", price: "$7.90" },
  ], []);

  // Sample data
  const members = [
    "Agent Alpha", "Agent Beta", "Agent Gamma", "Agent Delta", 
    "Agent Echo", "Agent Foxtrot", "Agent Golf", "Agent Hotel", "Agent India", "Agent Juliet"
  ];
  const membersJoined = 8;
  const totalPool = "$80";

  // Card sets - random sequence - show all cards - memoized for performance
  const cardSets = useMemo(() => ({
    sentinel: charMeta.sentinel,
    attacker: charMeta.attacker,
    defender: charMeta.defender,
    strategist: charMeta.strategist,
  }), []);

  const toggleSet = (setName: string) => {
    if (openSets.includes(setName)) {
      setOpenSets([]);
    } else {
      // Only one toggle open at a time
      setOpenSets([setName]);
    }
  };

  const toggleAgent = (walletAddress: string) => {
    if (openAgents.includes(walletAddress)) {
      setOpenAgents([]);
    } else {
      // Only one toggle open at a time
      setOpenAgents([walletAddress]);
    }
  };

  // Function to shorten wallet address
  const shortenAddress = (address: string) => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Sample agent data with their acquired cards and points - 8 players
  const agentsData = useMemo(() => [
    {
      walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      pointsLeft: 350,
      cards: [
        { ...charMeta.sentinel[0], pointsRequired: 50, type: "sentinel" },
        { ...charMeta.attacker[1], pointsRequired: 45, type: "attacker" },
        { ...charMeta.defender[2], pointsRequired: 55, type: "defender" },
      ]
    },
    {
      walletAddress: "0x8ba1f109551bD432803012645Hac136c22C929e",
      pointsLeft: 280,
      cards: [
        { ...charMeta.attacker[0], pointsRequired: 60, type: "attacker" },
        { ...charMeta.strategist[1], pointsRequired: 40, type: "strategist" },
        { ...charMeta.sentinel[2], pointsRequired: 50, type: "sentinel" },
        { ...charMeta.defender[0], pointsRequired: 70, type: "defender" },
      ]
    },
    {
      walletAddress: "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE",
      pointsLeft: 420,
      cards: [
        { ...charMeta.strategist[0], pointsRequired: 35, type: "strategist" },
        { ...charMeta.attacker[2], pointsRequired: 45, type: "attacker" },
      ]
    },
    {
      walletAddress: "0x28C6c06298d514Db089934071355E5743bf21d60",
      pointsLeft: 200,
      cards: [
        { ...charMeta.defender[1], pointsRequired: 65, type: "defender" },
        { ...charMeta.sentinel[1], pointsRequired: 55, type: "sentinel" },
        { ...charMeta.attacker[3], pointsRequired: 50, type: "attacker" },
        { ...charMeta.strategist[2], pointsRequired: 45, type: "strategist" },
        { ...charMeta.defender[3], pointsRequired: 60, type: "defender" },
        { ...charMeta.sentinel[3], pointsRequired: 25, type: "sentinel" },
      ]
    },
    {
      walletAddress: "0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549",
      pointsLeft: 380,
      cards: [
        { ...charMeta.attacker[4], pointsRequired: 55, type: "attacker" },
        { ...charMeta.defender[4], pointsRequired: 40, type: "defender" },
        { ...charMeta.strategist[3], pointsRequired: 25, type: "strategist" },
      ]
    },
    {
      walletAddress: "0xdfd5293d8e347dfe59e90efd55b2956a1343963d",
      pointsLeft: 320,
      cards: [
        { ...charMeta.sentinel[4], pointsRequired: 60, type: "sentinel" },
        { ...charMeta.attacker[5], pointsRequired: 50, type: "attacker" },
        { ...charMeta.defender[5], pointsRequired: 30, type: "defender" },
        { ...charMeta.strategist[4], pointsRequired: 40, type: "strategist" },
      ]
    },
    {
      walletAddress: "0x56eddb7aa87536c09ccc2793473599fd21a8b17f",
      pointsLeft: 450,
      cards: [
        { ...charMeta.strategist[5], pointsRequired: 30, type: "strategist" },
        { ...charMeta.sentinel[5], pointsRequired: 20, type: "sentinel" },
      ]
    },
    {
      walletAddress: "0x9696f59e4d72e237be84ffd425dcad154bf96976",
      pointsLeft: 150,
      cards: [
        { ...charMeta.defender[6], pointsRequired: 70, type: "defender" },
        { ...charMeta.attacker[6], pointsRequired: 65, type: "attacker" },
        { ...charMeta.sentinel[6], pointsRequired: 60, type: "sentinel" },
        { ...charMeta.strategist[6], pointsRequired: 55, type: "strategist" },
      ]
    },
  ], []);


  // Map set names to types for CharacterCard
  const setTypeMap: { [key: string]: "defender" | "attacker" | "sentinel" | "strategist" } = {
    sentinel: "sentinel",
    attacker: "attacker",
    defender: "defender",
    strategist: "strategist",
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden" style={{ backgroundColor: '#131313' }}>
      {/* Navbar */}
      <div className="flex-shrink-0 w-full px-6 py-4 flex items-center justify-between" style={{ backgroundColor: '#1a1a1a', borderBottom: `2px solid ${primaryColor}` }}>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          The Fifth Command
        </h1>
        
        {/* Stock Market Style Ticker */}
        <div className="flex-1 ml-8 overflow-hidden relative rounded flex items-center" style={{ height: '40px', border: `0.5px solid ${primaryColor}` }}>
          {!start ? (
            <Marquee
              autoFill={true}
              speed={50}
              direction="left"
              pauseOnHover={false}
              style={{ height: '100%', display: 'flex', alignItems: 'center' }}
            >
              <span className="text-white font-bold text-lg mx-32">Game starting in few mins</span>
            </Marquee>
          ) : (
            <Marquee
              autoFill={true}
              speed={50}
              direction="left"
              pauseOnHover={false}
              style={{ height: '100%', display: 'flex', alignItems: 'center' }}
            >
              {biddingData.map((bid, index) => (
                <div key={index} className="flex items-center mx-8">
                  <span className="text-white font-bold mr-4">{bid.card}</span>
                  <span className="text-white mr-4">{bid.player}</span>
                  <span className="mr-4 font-bold" style={{ color: bid.action === 'BOUGHT' ? '#4ade80' : bid.action === 'PLAY' ? '#f97316' : '#ef4444' }}>
                    {bid.action}
                  </span>
                  <span className="text-white font-bold">{bid.price}</span>
                  <span className="text-white mx-4">•</span>
                </div>
              ))}
            </Marquee>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 w-full flex gap-4 p-4 overflow-hidden">
        {/* Left Section - 30% - Individually Scrollable */}
        <div className="w-[30%] h-full flex flex-col overflow-hidden">
          <div className="flex-shrink-0 rounded-lg p-6 mb-4" style={{ backgroundColor: '#1a1a1a', border: `2px solid ${primaryColor}` }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                Tournament #{tournamentId}
              </h2>
              <p className="text-xl font-bold text-white">{totalPool}</p>
            </div>
            <p className="text-white ">
              {gameStarted ? `Agents Playing: ${membersJoined}/10` : `Agents Joined: ${membersJoined}/10`}
            </p>
          </div>

          {/* Scrollable Container for Agents and Card Sets */}
          <div className="flex-1 overflow-y-auto overflow-x-visible rounded-lg p-6 custom-scrollbar" style={{ backgroundColor: '#1a1a1a', border: `2px solid ${primaryColor}` }}>
            {/* Agents Section */}
            <p className="text-white mb-4 font-bold">Tournament #{tournamentId}</p>
            
            {agentsData.map((agent, agentIndex, array) => {
              const isLast = agentIndex === array.length - 1;
              return (
                <div key={agent.walletAddress} className={isLast ? 'mb-6' : 'mb-3'}>
                  <button
                    onClick={() => toggleAgent(agent.walletAddress)}
                    className="w-full flex items-center justify-between p-3 rounded-lg text-white hover:opacity-80 transition-opacity mb-2"
                    style={{ backgroundColor: 'rgba(194, 143, 243, 0.2)' }}
                  >
                    <div className="flex items-center gap-3">
                      <span>{shortenAddress(agent.walletAddress)}</span>
                      <span className="px-2 py-1 rounded text-xs font-bold" style={{ border: `1px solid ${primaryColor}`, backgroundColor: 'rgba(194, 143, 243, 0.1)' }}>
                        {agent.pointsLeft}/500
                      </span>
                    </div>
                    <span>{openAgents.includes(agent.walletAddress) ? '▼' : '▶'}</span>
                  </button>
                  {openAgents.includes(agent.walletAddress) && (
                    <div 
                      className="rounded-lg" 
                      style={{ 
                        backgroundColor: 'rgba(194, 143, 243, 0.1)',
                        border: `1px solid ${primaryColor}`,
                        marginTop: '8px',
                        padding: '8px',
                        overflow: 'visible'
                      }}
                    >
                      <div 
                        className="flex flex-wrap justify-evenly" 
                        style={{ 
                          gap: '15px',
                          overflow: 'visible'
                        }}
                      >
                        {agent.cards.map((card, index) => {
                          return (
                            <div
                              key={`${agent.walletAddress}-${index}`}
                              className="relative"
                              style={{
                                width: '160px',
                                height: '266.67px',
                                zIndex: agent.cards.length - index
                              }}
                            >
                              <div
                                className="absolute top-1/2 left-1/2"
                                style={{
                                  width: '320px',
                                  height: '533.33px',
                                  transform: 'translate(-50%, -50%) scale(0.5)',
                                  transformOrigin: 'center center',
                                }}
                              >
                                <CharacterCard
                                  name={card.name}
                                  characterImage={card.image}
                                  attack={card.attack}
                                  defense={card.defense}
                                  strategist={card.strategist}
                                  type={card.type as "defender" | "attacker" | "sentinel" | "strategist"}
                                  description={card.description}
                                  pointsRequired={card.pointsRequired}
                                  isSmall={true}
                                  tagPosition="bottom-center"
                                  tagColor="green"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Remaining Card Sets */}
            <div className="mt-6">
            <p className="text-white mb-4 font-bold">Remaining Card Sets</p>
            <p className="text-xs text-white/70 mb-4">Note: Cards are not in sequence, sequence is completely random!</p>
            
            {Object.entries(cardSets).map(([setName, cards], setIndex, array) => {
              const isLast = setIndex === array.length - 1;
              return (
                <div key={setName} className={isLast ? '' : 'mb-3'}>
                  <button
                    onClick={() => toggleSet(setName)}
                    className="w-full flex items-center justify-between p-3 rounded-lg text-white hover:opacity-80 transition-opacity capitalize mb-2"
                    style={{ backgroundColor: 'rgba(194, 143, 243, 0.2)' }}
                  >
                    <span>{setName}</span>
                    <span>{openSets.includes(setName) ? '▼' : '▶'}</span>
                  </button>
                  {openSets.includes(setName) && (
                    <div 
                      className="rounded-lg" 
                      style={{ 
                        backgroundColor: 'rgba(194, 143, 243, 0.1)',
                        border: `1px solid ${primaryColor}`,
                        marginTop: '8px',
                        padding: '8px',
                        overflow: 'visible'
                      }}
                    >
                      <div 
                        className="flex flex-wrap justify-evenly" 
                        style={{ 
                          gap: '15px',
                          overflow: 'visible'
                        }}
                      >
                        {cards.map((card, index) => {
                          return (
                            <div
                              key={`${setName}-${index}`}
                              className="relative"
                              style={{
                                width: '160px',
                                height: '266.67px',
                                zIndex: cards.length - index
                              }}
                            >
                              <div
                                className="absolute top-1/2 left-1/2"
                                style={{
                                  width: '320px',
                                  height: '533.33px',
                                  transform: 'translate(-50%, -50%) scale(0.5)',
                                  transformOrigin: 'center center',
                                }}
                              >
                                <CharacterCard
                                  name={card.name}
                                  characterImage={card.image}
                                  attack={card.attack}
                                  defense={card.defense}
                                  strategist={card.strategist}
                                  type={setTypeMap[setName]}
                                  description={card.description}
                                  isSmall={true}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        </div>

        {/* Center Section - 50% - Individually Scrollable */}
        <div className="w-[50%] h-full overflow-y-auto">
          <div className="rounded-lg p-8 w-full min-h-full" style={{ backgroundColor: '#1a1a1a', border: `2px solid ${primaryColor}` }}>
            {!start ? (
              <div className="flex items-center justify-center h-full min-h-[600px]">
                <p className="text-3xl font-bold text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                  Game is Yet to Start
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <div className="w-80">
                  <CharacterCard
                    name={charMeta.attacker[0].name}
                    characterImage={charMeta.attacker[0].image}
                    attack={charMeta.attacker[0].attack}
                    defense={charMeta.attacker[0].defense}
                    strategist={charMeta.attacker[0].strategist}
                    type="attacker"
                    description={charMeta.attacker[0].description}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Section - 20% - Individually Scrollable */}
        <div className="w-[20%] h-full flex flex-col">
          <div className="rounded-lg flex flex-col h-full" style={{ backgroundColor: '#1a1a1a', border: `2px solid ${primaryColor}` }}>
            <div className="flex-shrink-0 p-4 border-b" style={{ borderColor: primaryColor }}>
              <h3 className="text-lg font-bold text-white">Chat</h3>
            </div>
            
            {/* Chat Messages - Scrollable, messages from bottom */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col-reverse min-h-0">
              {chatMessages.slice().reverse().map((msg) => (
                <div key={msg.id} className="mb-3 flex-shrink-0">
                  <p className="text-xs font-bold mb-1" style={{ color: primaryColor }}>{msg.user}</p>
                  <p className="text-sm text-white">{msg.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
