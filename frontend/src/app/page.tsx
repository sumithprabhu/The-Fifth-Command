import Image from "next/image";

export default function Home() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background Image */}
      <div className="fixed inset-0 z-0 w-full h-full">
        <Image
          src="/new_bg.png"
          alt="Background"
          fill
          className="object-cover"
          style={{ objectPosition: 'center center' }}
          priority
          sizes="100vw"
        />
      </div>

      {/* Content Overlay */}
      <div className="relative z-10">
        {/* Hero Section - Full Viewport */}
        <section id="home" className="relative z-10 flex flex-col h-screen w-full">
          {/* Header */}
          <header className="flex w-full items-center justify-between px-6 py-4 md:px-10 md:py-6">
            {/* Logo */}
            <div className="text-xl font-bold text-white md:text-2xl" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
              DUMMY
            </div>

            {/* Navigation and CTA */}
            <div className="flex items-center gap-4 md:gap-6">
              <nav className="hidden items-center gap-5 text-sm font-bold text-white md:flex md:gap-6 md:text-base" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                <a href="#home" className="hover:opacity-80 transition-opacity">
                  Home
                </a>
                <a href="#rarity" className="hover:opacity-80 transition-opacity">
                  Rarity
                </a>
                <a href="#benefits" className="hover:opacity-80 transition-opacity">
                  Benefits
                </a>
                <a href="#lore" className="hover:opacity-80 transition-opacity">
                  Lore
                </a>
                <a href="#roadmap" className="hover:opacity-80 transition-opacity">
                  Roadmap
                </a>
              </nav>
              <button 
                className="relative overflow-hidden rounded-full px-6 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 md:px-8 md:py-3 md:text-base"
                style={{ 
                  background: 'linear-gradient(135deg, #B794F6 0%, #9B7EDE 50%, #7C5ACF 100%)',
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  boxShadow: '0 4px 15px rgba(124, 90, 207, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                }}
              >
                <span className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent opacity-50"></span>
                <span className="relative z-10">Mint Now</span>
              </button>
            </div>
          </header>

          {/* Hero Content */}
          <main className="flex flex-1 items-start justify-center px-6 pt-16 md:px-8 md:pt-20">
            <div className="flex flex-col items-center gap-5 text-center md:gap-6">
              {/* Main Title */}
              <h1 
                className="text-5xl font-black leading-[0.9] tracking-tight text-white md:text-6xl lg:text-7xl xl:text-8xl"
                style={{ 
                  fontFamily: 'var(--font-orbitron), sans-serif'
                }}
              >
                DUMMY
              </h1>

              {/* Description */}
              <p 
                className="max-w-3xl text-sm leading-relaxed text-white md:text-base lg:text-lg"
                style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
              >
                Lorem Ipsum Dolor Sit Amet, Consectetur Adipiscing Elit. Diam Ipsum Lectus In Sapien Lectus Nam Mi. Lorem Ipsum Dolor Sit Amet, Consectetur Adipiscing Elit.
              </p>
            </div>
          </main>

          {/* Pandas at Bottom - All in One Row with Different Levels */}
          <div className="relative z-10 flex items-end justify-center w-full pb-4">
          <div className="flex items-end justify-center">
            
            
            {/* Level 3 - Left */}
            <div className="flex flex-col items-center" style={{ transform: 'translateY(40px)', marginRight: '-30px' }}>
              <Image
                src="/pandas/defender/defender_12.png"
                alt="Defender 12"
                width={495}
                height={495}
                className="animate-slide-up object-contain"
                style={{ 
                  animationDelay: '0.6s', 
                  animationFillMode: 'both',
                  width: '495px',
                  height: 'auto'
                }}
              />
            </div>
            
            {/* Level 2 - Left */}
            <div className="flex flex-col items-center" style={{ transform: 'translateY(20px)', marginRight: '-30px' }}>
              <Image
                src="/pandas/attacker/attacker_16.png"
                alt="Attacker 16"
                width={550}
                height={550}
                className="animate-slide-up object-contain"
                style={{ 
                  animationDelay: '0.3s', 
                  animationFillMode: 'both',
                  width: '550px',
                  height: 'auto'
                }}
              />
            </div>
            
            {/* Level 1 - Top Center */}
            <div className="flex flex-col items-center" style={{ marginRight: '-30px' }}>
              <Image
                src="/pandas/attacker/attacker_3.png"
                alt="Attacker 3"
                width={715}
                height={715}
                className="animate-slide-up object-contain"
                style={{ 
                  animationDelay: '0s', 
                  animationFillMode: 'both',
                  width: '715px',
                  height: 'auto'
                }}
              />
            </div>
            
            {/* Level 2 - Right */}
            <div className="flex flex-col items-center" style={{ transform: 'translateY(20px)', marginRight: '-30px' }}>
              <Image
                src="/pandas/strategist/strategist_6.png"
                alt="Strategist 6"
                width={550}
                height={550}
                className="animate-slide-up object-contain"
                style={{ 
                  animationDelay: '0.3s', 
                  animationFillMode: 'both',
                  width: '550px',
                  height: 'auto'
                }}
              />
            </div>
            
            {/* Level 3 - Right */}
            <div className="flex flex-col items-center" style={{ transform: 'translateY(40px)' }}>
              <Image
                src="/pandas/defender/defender_3.png"
                alt="Defender 3"
                width={495}
                height={495}
                className="animate-slide-up object-contain"
                style={{ 
                  animationDelay: '0.6s', 
                  animationFillMode: 'both',
                  width: '495px',
                  height: 'auto'
                }}
              />
            </div>
            
            {/* Level 4 - Bottom Right */}
           
          </div>
        </div>
        </section>

        {/* What is DUMMY Section */}
        <section className="relative z-10 w-full px-6 py-16 md:px-12 md:py-24" style={{ backgroundColor: 'rgba(30, 20, 50, 0.95)' }}>
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              {/* Left Side */}
              <div className="flex flex-col gap-6">
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                  WHAT IS <span className="text-5xl md:text-6xl lg:text-7xl">DUMMY?</span>
                </h2>
                <button 
                  className="relative overflow-hidden rounded-lg px-8 py-4 text-base font-bold text-white transition-all hover:opacity-90 w-fit"
                  style={{ 
                    background: 'linear-gradient(135deg, #B794F6 0%, #9B7EDE 50%, #7C5ACF 100%)',
                    fontFamily: 'Arial, Helvetica, sans-serif',
                    boxShadow: '0 4px 15px rgba(124, 90, 207, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                  }}
                >
                  <span className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent opacity-50"></span>
                  <span className="relative z-10">Check Our Roadmap</span>
                </button>
              </div>

              {/* Right Side */}
              <div className="flex flex-col gap-8">
                {/* Description */}
                <p className="text-base md:text-lg leading-relaxed text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                  This is a website where users can get their agent into a bidding game to form a team and win the pool. A user can also watch more content soon.
                </p>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Card 1 - Supply */}
                  <div className="rounded-lg p-6 flex flex-col gap-4" style={{ backgroundColor: '#B794F6' }}>
                    <div className="flex flex-col gap-2">
                      <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>Supply</h3>
                      <p className="text-2xl font-normal text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>9,999</p>
                    </div>
                    <div className="w-20 h-20 bg-white/20 rounded-lg flex items-center justify-center">
                      <span className="text-4xl">🎯</span>
                    </div>
                  </div>

                  {/* Card 2 - Mainsale buyer limit */}
                  <div className="rounded-lg p-6 flex flex-col gap-4 bg-white">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-lg font-bold text-black" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>Mainsale buyer limit:</h3>
                      <p className="text-base font-normal text-black" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>8 per transaction</p>
                    </div>
                    <div className="w-20 h-20 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-4xl">8</span>
                    </div>
                  </div>

                  {/* Card 3 - Unique collection */}
                  <div className="rounded-lg p-6 flex flex-col gap-4" style={{ backgroundColor: '#1a1a1a' }}>
                    <div className="flex flex-col gap-2">
                      <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>Unique</h3>
                      <p className="text-base font-normal text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>collection</p>
                    </div>
                    <div className="w-20 h-20 bg-white/10 rounded-lg flex items-center justify-center">
                      <span className="text-4xl">✨</span>
                    </div>
                  </div>

                  {/* Card 4 - Elements */}
                  <div className="rounded-lg p-6 flex flex-col gap-4" style={{ backgroundColor: '#1a1a1a' }}>
                    <div className="flex flex-col gap-2">
                      <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>Elements</h3>
                      <p className="text-2xl font-normal text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>300</p>
                    </div>
                    <div className="w-20 h-20 bg-white/10 rounded-lg flex items-center justify-center">
                      <span className="text-4xl">🧩</span>
                    </div>
                  </div>

                  {/* Card 5 - Presale buyer limit */}
                  <div className="rounded-lg p-6 flex flex-col gap-4" style={{ backgroundColor: '#3B82F6' }}>
                    <div className="flex flex-col gap-2">
                      <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>Presale buyer limit:</h3>
                      <p className="text-base font-normal text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>2 per wallet</p>
                    </div>
                    <div className="w-20 h-20 bg-white/20 rounded-lg flex items-center justify-center">
                      <span className="text-4xl">2</span>
                    </div>
                  </div>

                  {/* Card 6 - Price */}
                  <div className="rounded-lg p-6 flex flex-col gap-4 bg-white">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-lg font-bold text-black" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>Price</h3>
                      <p className="text-base font-normal text-black" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>0.05 ETH</p>
                    </div>
                    <div className="w-20 h-20 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">💎</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
