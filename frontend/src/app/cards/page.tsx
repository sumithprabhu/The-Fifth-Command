"use client";

import CharacterCard from "@/components/CharacterCard";

// Example cards - one from each type
const showcaseCards = [
  {
    name: "Prime",
    characterImage: "/pandas/sentinel/sentinel_5.png",
    attack: 5,
    defense: 6,
    strategist: 5,
    type: "sentinel" as const,
    description: "An experienced fighter with well-rounded combat abilities."
  },
  {
    name: "Blitz",
    characterImage: "/pandas/attacker/attacker_14.png",
    attack: 8,
    defense: 5,
    strategist: 6,
    type: "attacker" as const,
    description: "Lightning-fast strikes that overwhelm enemies before they can react."
  },
  {
    name: "Barrier",
    characterImage: "/pandas/defender/defender_8.png",
    attack: 6,
    defense: 9,
    strategist: 5,
    type: "defender" as const,
    description: "Creates an impenetrable wall that enemies cannot breach."
  },
  {
    name: "Visionary",
    characterImage: "/pandas/strategist/strategist_13.png",
    attack: 6,
    defense: 6,
    strategist: 9,
    type: "strategist" as const,
    description: "Forward-thinking strategist who sees the bigger picture."
  }
];

export default function CardsPage() {
  const primaryColor = "#c28ff3";

  return (
    <div className="min-h-screen w-full flex flex-col overflow-hidden" style={{ backgroundColor: '#131313' }}>
      {/* Header */}
      <div className="flex-shrink-0 w-full px-6 py-6 flex items-center justify-between" style={{ backgroundColor: '#1a1a1a', borderBottom: `2px solid ${primaryColor}` }}>
        <h1 
          className="text-3xl md:text-4xl font-bold text-white"
          style={{ fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif' }}
        >
          CARD SHOWCASE
        </h1>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-12">
        <div className="max-w-7xl mx-auto">
          {/* Description */}
          <div className="mb-8 text-center">
            <p className="text-white/80 text-lg md:text-xl leading-relaxed" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
              Discover the four unique card types in The Fifth Command. Each type brings distinct strengths to your team.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
            {showcaseCards.map((card, index) => (
              <div key={index} className="flex flex-col items-center">
                {/* Type Label */}
                <div className="mb-4">
                  <span 
                    className="px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider"
                    style={{ 
                      backgroundColor: 'rgba(194, 143, 243, 0.1)',
                      border: `2px solid ${primaryColor}`,
                      color: primaryColor,
                      fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif'
                    }}
                  >
                    {card.type}
                  </span>
                </div>

                {/* Card */}
                <div className="w-full max-w-[320px]">
                  <CharacterCard
                    name={card.name}
                    characterImage={card.characterImage}
                    attack={card.attack}
                    defense={card.defense}
                    strategist={card.strategist}
                    type={card.type}
                    description={card.description}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Additional Info Section */}
          <div className="mt-16 rounded-lg p-8" style={{ backgroundColor: '#1a1a1a', border: `2px solid ${primaryColor}` }}>
            <h2 
              className="text-2xl md:text-3xl font-bold text-white mb-6"
              style={{ fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif' }}
            >
              BUILD YOUR TEAM
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-3" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                  Team Composition
                </h3>
                <p className="text-white/80 leading-relaxed" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                  Your final team consists of your top 5 cards. Choose wisely - balance attack, defense, and strategy to maximize your team score.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-3" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                  Scoring System
                </h3>
                <p className="text-white/80 leading-relaxed" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                  Your team score is calculated from your top 2 attackers, top 2 defenders, and best strategist. The highest score wins the entire pot!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
