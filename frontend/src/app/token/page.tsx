"use client";

export default function TokenPage() {
  const primaryColor = "#c28ff3";
  const secondaryColor = "#B794F6";

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div 
          className="rounded-lg p-8"
          style={{
            backgroundColor: '#1a1a1a',
            border: `2px solid ${primaryColor}`,
          }}
        >
          {/* Header */}
          <div className="mb-8">
            <h1 
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{ 
                color: primaryColor,
                fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif'
              }}
            >
              FIF Token
            </h1>
            <div className="h-1 w-24 mb-6" style={{ backgroundColor: primaryColor }}></div>
          </div>

          {/* Token Live Section */}
          <div className="mb-8 p-6 rounded-lg" style={{ backgroundColor: 'rgba(194, 143, 243, 0.1)', border: `1px solid ${primaryColor}` }}>
            <h2 
              className="text-2xl font-bold mb-4"
              style={{ 
                color: primaryColor,
                fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif'
              }}
            >
              Token is Live
            </h2>
            <p className="text-white/90 mb-4" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
              The FIF token is now live and trading on Nad.Fun
            </p>
            <a 
              href="https://nad.fun/tokens/0xA4D0048565Be71dE76D5aDB30DF1cBB4BB337777"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-3 rounded-lg font-bold text-white transition-all hover:opacity-90"
              style={{
                background: `linear-gradient(135deg, ${primaryColor} 0%, #9B7EDE 50%, #7C5ACF 100%)`,
                fontFamily: 'Arial, Helvetica, sans-serif',
                boxShadow: '0 4px 15px rgba(124, 90, 207, 0.4)'
              }}
            >
              Trade on Nad.Fun
            </a>
          </div>

          {/* Utility Section */}
          <div className="mb-8">
            <h2 
              className="text-3xl font-bold mb-6"
              style={{ 
                color: primaryColor,
                fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif'
              }}
            >
              Token Utility
            </h2>

            {/* Revenue Share */}
            <div className="mb-6 p-6 rounded-lg" style={{ backgroundColor: 'rgba(194, 143, 243, 0.05)', border: `1px solid ${primaryColor}` }}>
              <h3 
                className="text-xl font-bold mb-3"
                style={{ 
                  color: secondaryColor,
                  fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif'
                }}
              >
                1. Revenue Share
              </h3>
              <ul className="space-y-2 text-white/90" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                <li className="flex items-start">
                  <span className="mr-2" style={{ color: primaryColor }}>•</span>
                  <span><strong>10% fee</strong> is generated after each round from entry fees and bid transactions</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2" style={{ color: primaryColor }}>•</span>
                  <span><strong>50% of this fee</strong> (5% of total revenue) is used for <strong>buyback every weekend</strong></span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2" style={{ color: primaryColor }}>•</span>
                  <span>The remaining 50% supports platform development and operations</span>
                </li>
              </ul>
            </div>

            {/* Governance */}
            <div className="mb-6 p-6 rounded-lg" style={{ backgroundColor: 'rgba(194, 143, 243, 0.05)', border: `1px solid ${primaryColor}` }}>
              <h3 
                className="text-xl font-bold mb-3"
                style={{ 
                  color: secondaryColor,
                  fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif'
                }}
              >
                2. Governance
              </h3>
              <p className="text-white/90 mb-3" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                FIF token holders have voting rights on key platform decisions:
              </p>
              <ul className="space-y-2 text-white/90" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                <li className="flex items-start">
                  <span className="mr-2" style={{ color: primaryColor }}>•</span>
                  <span>Propose and vote on game rule changes</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2" style={{ color: primaryColor }}>•</span>
                  <span>Decide on platform upgrades and new features</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2" style={{ color: primaryColor }}>•</span>
                  <span>Influence tournament structures and prize distributions</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2" style={{ color: primaryColor }}>•</span>
                  <span>Participate in community-driven initiatives</span>
                </li>
              </ul>
            </div>

            {/* Card Creation & Creator Activities */}
            <div className="mb-6 p-6 rounded-lg" style={{ backgroundColor: 'rgba(194, 143, 243, 0.05)', border: `1px solid ${primaryColor}` }}>
              <h3 
                className="text-xl font-bold mb-3"
                style={{ 
                  color: secondaryColor,
                  fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif'
                }}
              >
                3. Card Creation & Creator Activities
              </h3>
              <p className="text-white/90 mb-3" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                FIF tokens enable creative participation in The Fifth Command ecosystem:
              </p>
              <ul className="space-y-2 text-white/90" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                <li className="flex items-start">
                  <span className="mr-2" style={{ color: primaryColor }}>•</span>
                  <span>Create and submit custom card designs for potential inclusion in the game</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2" style={{ color: primaryColor }}>•</span>
                  <span>Participate in creator competitions and earn rewards</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2" style={{ color: primaryColor }}>•</span>
                  <span>Access exclusive creator tools and resources</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2" style={{ color: primaryColor }}>•</span>
                  <span>Earn royalties when your created cards are used in tournaments</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2" style={{ color: primaryColor }}>•</span>
                  <span>Join the creator community and collaborate on new card sets</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Contract Info */}
          <div className="mt-8 p-6 rounded-lg" style={{ backgroundColor: 'rgba(194, 143, 243, 0.1)', border: `1px solid ${primaryColor}` }}>
            <h3 
              className="text-xl font-bold mb-4"
              style={{ 
                color: primaryColor,
                fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif'
              }}
            >
              Contract Information
            </h3>
            <div className="space-y-2 text-white/90 font-mono text-sm" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
              <p>
                <strong style={{ color: secondaryColor }}>Contract Address:</strong> 0xA4D0048565Be71dE76D5aDB30DF1cBB4BB337777
              </p>
              <p>
                <strong style={{ color: secondaryColor }}>Trading Platform:</strong> <a href="https://nad.fun/tokens/0xA4D0048565Be71dE76D5aDB30DF1cBB4BB337777" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80" style={{ color: primaryColor }}>Nad.Fun</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
