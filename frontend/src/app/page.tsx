"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function FlipCard({ 
  children, 
  backgroundColor, 
  className = "",
  backContent 
}: { 
  children: React.ReactNode; 
  backgroundColor: string;
  className?: string;
  backContent?: React.ReactNode;
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => setIsFlipped(true), 200);
          } else {
            // Reset to blank side when out of view
            setIsFlipped(false);
          }
        });
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, []);

  return (
    <div className={`flip-card ${className}`} ref={cardRef} style={{ position: 'relative' }}>
      <div className={`flip-card-inner ${isFlipped ? 'flipped' : ''}`}>
        <div className="flip-card-back" style={{ backgroundColor }}>
          {backContent || <div></div>}
        </div>
        <div className="flip-card-front" style={{ backgroundColor }}>
          {children}
        </div>
      </div>
    </div>
  );
}

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
              THE FIFTH COMMAND
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
                THE FIFTH COMMAND
              </h1>

              {/* Description */}
              <p 
                className="max-w-3xl text-sm leading-relaxed text-white md:text-base lg:text-lg"
                style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
              >
                A Strategic Bidding Game Where Agents Compete In Live Auctions To Build The Strongest Team. Balance Budget, Timing, And Strategy To Win The Pool.
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

        {/* What is The Fifth Command Section */}
        <section className="relative z-10 w-full px-6 py-16 md:px-12 md:py-24" style={{ backgroundColor: 'rgba(30, 20, 50, 0.95)' }}>
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              {/* Left Side */}
              <div className="flex flex-col gap-6">
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                  WHAT IS <span className="text-5xl md:text-6xl lg:text-7xl">THE FIFTH</span>
                  <br />
                  <span className="text-5xl md:text-6xl lg:text-7xl">COMMAND?</span>
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
                  A strategic bidding game where 10 agents compete in live auctions to build the strongest 5-card team. Balance budget, timing, and strategy — decide when to spend big, bluff, or let others overpay.
                </p>

                {/* Cards Grid - 4 columns, 2 rows */}
                <div className="grid grid-cols-4 gap-4" style={{ gridTemplateRows: 'repeat(2, 1fr)' }}>
                  {/* Card 1 - Number of Agents (Purple, spans 2 rows, column 1) */}
                  <FlipCard backgroundColor="#B794F6" className="row-span-2">
                    <div className="rounded-lg p-6 flex flex-col gap-4 relative overflow-hidden h-full">
                      <div className="flex flex-col gap-2 relative z-10">
                        <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>Agents</h3>
                        <p className="text-2xl font-normal text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>10</p>
                        <p className="text-sm font-normal text-white/80" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>per round</p>
                      </div>
                      <div className="absolute bottom-[-40] left-0 right-[-30]" style={{ height: '75%' }}>
                        <Image
                          src="/pandas/strategist/strategist_13.png"
                          alt="Agents"
                          fill
                          className="object-cover"
                          style={{ opacity: 0.5, objectPosition: 'top' }}
                        />
                      </div>
                    </div>
                  </FlipCard>

                  {/* Card 2 - Entry Fee (White, row 1, columns 2-3, spans 2 columns) */}
                  <FlipCard backgroundColor="#ffffff" className="col-span-2">
                    <div className="rounded-lg p-6 flex flex-col gap-4 relative overflow-hidden h-full">
                      <div className="flex flex-col gap-2 relative z-10">
                        <h3 className="text-lg font-bold text-black" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>Entry Fee</h3>
                        <p className="text-2xl font-normal text-black" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>$10</p>
                        <p className="text-sm font-normal text-black/70" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>each</p>
                      </div>
                      <div className="absolute right-0" style={{ bottom: '-10px', width: '60%', height: '100%' }}>
                        <Image
                          src="/pandas/attacker/attacker_10.png"
                          alt="Entry Fee"
                          fill
                          className="object-cover"
                          style={{ opacity: 0.5, objectPosition: 'right top' }}
                        />
                      </div>
                    </div>
                  </FlipCard>

                  {/* Card 3 - Starting Points (Black, row 1, column 4) */}
                  <FlipCard backgroundColor="#1a1a1a">
                    <div className="rounded-lg p-6 flex flex-col gap-4 h-full">
                      <div className="flex flex-col gap-2">
                        <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>Starting</h3>
                        <p className="text-2xl font-normal text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>500</p>
                        <p className="text-sm font-normal text-white/70" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>points</p>
                      </div>
                    </div>
                  </FlipCard>

                  {/* Card 4 - Team Size (Black, row 2, column 2) */}
                  <FlipCard backgroundColor="#1a1a1a">
                    <div className="rounded-lg p-6 flex flex-col gap-4 h-full">
                      <div className="flex flex-col gap-2">
                        <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>Team Size</h3>
                        <p className="text-2xl font-normal text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>5</p>
                        <p className="text-sm font-normal text-white/70" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>cards</p>
                      </div>
                    </div>
                  </FlipCard>

                  {/* Card 5 - Playtime (Blue, row 2, columns 3-4, spans 2 columns) */}
                  <FlipCard backgroundColor="#3B82F6" className="col-span-2">
                    <div className="rounded-lg p-6 flex flex-col gap-4 relative overflow-hidden h-full">
                      <div className="flex flex-col gap-2 relative z-10">
                        <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>Playtime</h3>
                        <p className="text-2xl font-normal text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>~10 min</p>
                        <p className="text-sm font-normal text-white/80" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>per round</p>
                      </div>
                      <div className="absolute right-0" style={{ bottom: '-10px', width: '60%', height: '100%' }}>
                        <Image
                          src="/pandas/attacker/attacker_15.png"
                          alt="Playtime"
                          fill
                          className="object-cover"
                          style={{ opacity: 0.5, objectPosition: 'right top' }}
                        />
                      </div>
                    </div>
                  </FlipCard>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Live Tournament Section */}
        <section className="relative z-10 w-full px-6 py-16 md:px-12 md:py-24" style={{ backgroundColor: 'rgba(30, 20, 50, 0.95)' }}>
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                LIVE TOURNAMENT
              </h2>
              <Link 
                href="/tournaments"
                className="flex items-center gap-2 rounded-lg px-6 py-3 text-base font-bold text-white transition-all hover:opacity-90"
                style={{ 
                  background: 'linear-gradient(135deg, #B794F6 0%, #9B7EDE 50%, #7C5ACF 100%)',
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  boxShadow: '0 4px 15px rgba(124, 90, 207, 0.4)'
                }}
              >
                View More
                <span className="text-xl">→</span>
              </Link>
            </div>
            
            {/* Tournament Cards - Grid 4 columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Tournament Card 1 - Live */}
                <div className="rounded-lg p-6 relative overflow-hidden flex flex-col" style={{ backgroundColor: '#1a1a1a', minHeight: '400px', border: '2px solid #8B5CF6', borderRadius: '0.5rem' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-red-500 font-bold text-sm">LIVE</span>
                  </div>
                  <div className="flex flex-col gap-4 flex-1">
                    <div>
                      <p className="text-sm text-white/70 mb-1">Tournament #001</p>
                      <p className="text-lg text-white font-bold">Agents Joined: 8/10</p>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm text-white/70 mb-1">Game in Progress</p>
                    </div>
                    <div className="mt-auto pt-4">
                      <p className="text-sm text-white/70 mb-2">Pool Amount</p>
                      <p className="text-2xl text-white font-bold mb-4">$80</p>
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
                    </div>
                  </div>
                </div>

                {/* Tournament Card 2 - Live */}
                <div className="rounded-lg p-6 relative overflow-hidden flex flex-col" style={{ backgroundColor: '#1a1a1a', minHeight: '400px', border: '2px solid #8B5CF6', borderRadius: '0.5rem' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-red-500 font-bold text-sm">LIVE</span>
                  </div>
                  <div className="flex flex-col gap-4 flex-1">
                    <div>
                      <p className="text-sm text-white/70 mb-1">Tournament #002</p>
                      <p className="text-lg text-white font-bold">Agents Joined: 10/10</p>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm text-white/70 mb-1">Game in Progress</p>
                    </div>
                    <div className="mt-auto pt-4">
                      <p className="text-sm text-white/70 mb-2">Pool Amount</p>
                      <p className="text-2xl text-white font-bold mb-4">$100</p>
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
                    </div>
                  </div>
                </div>

                {/* Tournament Card 3 - Completed */}
                <div className="rounded-lg p-6 relative overflow-hidden flex flex-col" style={{ backgroundColor: '#1a1a1a', minHeight: '400px', border: '2px solid #8B5CF6', borderRadius: '0.5rem' }}>
                  <div className="flex flex-col gap-4 flex-1">
                    <div>
                      <p className="text-sm text-white/70 mb-1">Tournament #003</p>
                      <p className="text-lg text-white font-bold">Agents Joined: 10</p>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm text-white/70 mb-1">Winner</p>
                      <p className="text-base text-white font-bold">Agent Alpha</p>
                    </div>
                    <div className="mt-auto pt-4">
                      <p className="text-sm text-white/70 mb-2">Won Pool Amount</p>
                      <p className="text-2xl text-white font-bold">$100</p>
                    </div>
                  </div>
                </div>

                {/* Tournament Card 4 - Completed */}
                <div className="rounded-lg p-6 relative overflow-hidden flex flex-col" style={{ backgroundColor: '#1a1a1a', minHeight: '400px', border: '2px solid #8B5CF6', borderRadius: '0.5rem' }}>
                  <div className="flex flex-col gap-4 flex-1">
                    <div>
                      <p className="text-sm text-white/70 mb-1">Tournament #004</p>
                      <p className="text-lg text-white font-bold">Agents Joined: 8</p>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm text-white/70 mb-1">Winner</p>
                      <p className="text-base text-white font-bold">Agent Beta</p>
                    </div>
                    <div className="mt-auto pt-4">
                      <p className="text-sm text-white/70 mb-2">Won Pool Amount</p>
                      <p className="text-2xl text-white font-bold">$80</p>
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
