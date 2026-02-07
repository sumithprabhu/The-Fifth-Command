import Image from "next/image";

export default function TournamentsPage() {
  // Sample tournament data - in real app, this would come from an API
  const tournaments = [
    { id: 1, number: "001", agentsJoined: "8/10", isLive: true, gameInProgress: true, poolAmount: "$80", winner: null },
    { id: 2, number: "002", agentsJoined: "10/10", isLive: true, gameInProgress: true, poolAmount: "$100", winner: null },
    { id: 3, number: "003", agentsJoined: "10", isLive: false, gameInProgress: false, poolAmount: "$100", winner: "Agent Alpha" },
    { id: 4, number: "004", agentsJoined: "8", isLive: false, gameInProgress: false, poolAmount: "$80", winner: "Agent Beta" },
    { id: 5, number: "005", agentsJoined: "9/10", isLive: true, gameInProgress: true, poolAmount: "$90", winner: null },
    { id: 6, number: "006", agentsJoined: "10", isLive: false, gameInProgress: false, poolAmount: "$100", winner: "Agent Gamma" },
    { id: 7, number: "007", agentsJoined: "7", isLive: false, gameInProgress: false, poolAmount: "$70", winner: "Agent Delta" },
    { id: 8, number: "008", agentsJoined: "10/10", isLive: true, gameInProgress: true, poolAmount: "$100", winner: null },
  ];

  return (
    <div className="relative min-h-screen w-full overflow-hidden" style={{ backgroundColor: 'rgba(30, 20, 50, 0.95)' }}>
      {/* Background Image */}
      <div className="fixed inset-0 z-0 w-full h-full">
        <Image
          src="/new_bg.png"
          alt="Background"
          fill
          className="object-cover object-center"
          priority
        />
      </div>

      <div className="relative z-10 w-full px-6 py-16 md:px-12 md:py-24">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-12" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
            ALL TOURNAMENTS
          </h1>
          
          {/* Tournament Cards - Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tournaments.map((tournament) => (
              <div 
                key={tournament.id}
                className="rounded-lg p-6 relative overflow-hidden flex flex-col" 
                style={{ 
                  backgroundColor: '#1a1a1a', 
                  minHeight: '400px', 
                  border: '2px solid #8B5CF6', 
                  borderRadius: '0.5rem' 
                }}
              >
                {tournament.isLive && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-red-500 font-bold text-sm">LIVE</span>
                  </div>
                )}
                <div className="flex flex-col gap-4 flex-1">
                  <div>
                    <p className="text-sm text-white/70 mb-1">Tournament #{tournament.number}</p>
                    <p className="text-lg text-white font-bold">Agents Joined: {tournament.agentsJoined}</p>
                  </div>
                  {tournament.gameInProgress && (
                    <div className="mt-4">
                      <p className="text-sm text-white/70 mb-1">Game in Progress</p>
                    </div>
                  )}
                  {tournament.winner && (
                    <div className="mt-4">
                      <p className="text-sm text-white/70 mb-1">Winner</p>
                      <p className="text-base text-white font-bold">{tournament.winner}</p>
                    </div>
                  )}
                  <div className="mt-auto pt-4">
                    <p className="text-sm text-white/70 mb-2">
                      {tournament.winner ? 'Won Pool Amount' : 'Pool Amount'}
                    </p>
                    <p className="text-2xl text-white font-bold mb-4">{tournament.poolAmount}</p>
                    {tournament.isLive && (
                      <button 
                        className="w-full rounded-lg px-6 py-3 text-base font-bold text-white transition-all hover:opacity-90"
                        style={{ 
                          background: 'linear-gradient(135deg, #B794F6 0%, #9B7EDE 50%, #7C5ACF 100%)',
                          fontFamily: 'Arial, Helvetica, sans-serif',
                          boxShadow: '0 4px 15px rgba(124, 90, 207, 0.4)'
                        }}
                      >
                        Watch Live
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
