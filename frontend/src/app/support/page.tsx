"use client";

export default function SupportPage() {
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
              Support
            </h1>
            <div className="h-1 w-24 mb-6" style={{ backgroundColor: primaryColor }}></div>
          </div>

          {/* Main Content */}
          <div className="mb-8">
            <p 
              className="text-xl text-white/90 mb-8"
              style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
            >
              We love to connect with you!
            </p>
            
            <p 
              className="text-lg text-white/80 mb-6"
              style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
            >
              Need help? Have questions about the game? We're here to assist you!
            </p>

            <div className="p-6 rounded-lg mb-6" style={{ backgroundColor: 'rgba(194, 143, 243, 0.1)', border: `1px solid ${primaryColor}` }}>
              <h2 
                className="text-2xl font-bold mb-4"
                style={{ 
                  color: primaryColor,
                  fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif'
                }}
              >
                Get Support
              </h2>
              <p 
                className="text-white/90 mb-4"
                style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
              >
                The best way to reach us for support is through X (formerly Twitter). Send us a direct message and we'll get back to you as soon as possible!
              </p>
              <a 
                href="https://x.com/thefifthcommand"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 rounded-lg font-bold text-white transition-all hover:opacity-90"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor} 0%, #9B7EDE 50%, #7C5ACF 100%)`,
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  boxShadow: '0 4px 15px rgba(124, 90, 207, 0.4)'
                }}
              >
                DM Us on X
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
