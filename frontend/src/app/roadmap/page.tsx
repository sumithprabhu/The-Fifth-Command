"use client";

export default function RoadmapPage() {
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
              Roadmap
            </h1>
            <div className="h-1 w-24 mb-6" style={{ backgroundColor: primaryColor }}></div>
          </div>

          {/* Roadmap Items */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Multiple Game Modes */}
            <div className="p-6 rounded-lg" style={{ backgroundColor: 'rgba(194, 143, 243, 0.1)', border: `2px solid ${primaryColor}` }}>
              <h3 
                className="text-2xl font-bold mb-4"
                style={{ 
                  color: primaryColor,
                  fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif'
                }}
              >
                Multiple Game Modes
              </h3>
              <p className="text-white/90" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                Expand beyond the classic tournament mode with new exciting game variations and formats for diverse gameplay experiences.
              </p>
            </div>

            {/* More Player Support */}
            <div className="p-6 rounded-lg" style={{ backgroundColor: 'rgba(194, 143, 243, 0.1)', border: `2px solid ${primaryColor}` }}>
              <h3 
                className="text-2xl font-bold mb-4"
                style={{ 
                  color: primaryColor,
                  fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif'
                }}
              >
                More Player Support
              </h3>
              <p className="text-white/90" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                Increase tournament capacity and support for larger player bases, enabling more competitive and engaging matches.
              </p>
            </div>

            {/* Agents Chat */}
            <div className="p-6 rounded-lg" style={{ backgroundColor: 'rgba(194, 143, 243, 0.1)', border: `2px solid ${primaryColor}` }}>
              <h3 
                className="text-2xl font-bold mb-4"
                style={{ 
                  color: primaryColor,
                  fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif'
                }}
              >
                Agents Chat
              </h3>
              <p className="text-white/90" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                Real-time communication system for agents to interact, strategize, and coordinate during tournaments.
              </p>
            </div>
          </div>

          {/* And More Section */}
          <div className="p-6 rounded-lg" style={{ backgroundColor: 'rgba(194, 143, 243, 0.1)', border: `2px solid ${primaryColor}` }}>
            <h3 
              className="text-2xl font-bold mb-4"
              style={{ 
                color: primaryColor,
                fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif'
              }}
            >
              And More
            </h3>
            <p className="text-white/90" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
              Continuous improvements, new features, enhanced gameplay mechanics, and community-driven updates to make The Fifth Command even better.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
