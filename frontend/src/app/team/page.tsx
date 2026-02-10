"use client";

import Image from "next/image";
import { memo } from "react";
import { GiBroadsword } from "react-icons/gi";

export default function TeamPage() {
  const primaryColor = "#c28ff3";

  const teamMembers = [
    {
      name: "Sumith Prabhu",
      characterImage: "/pandas/attacker/attacker_1.png", // Using existing image, will be replaced
      role: "Founder",
      description: "Frontend wizard crafting pixel-perfect interfaces with React and Next.js, bringing The Fifth Command to life.",
      twitterLink: "https://x.com/sumithprabhu_",
      linkedinLink: "https://www.linkedin.com/in/sumith-prabhu/",
      githubLink: "https://github.com/sumithprabhu",
    },
    {
      name: "Nilesh Gupta",
      characterImage: "/pandas/defender/defender_1.png", // Using existing image, will be replaced
      role: "Developer",
      description: "Backend architect and smart contract sorcerer building robust infrastructure and secure blockchain systems.",
      twitterLink: "https://x.com/0xNilesh",
      linkedinLink: "https://www.linkedin.com/in/0xnilesh/",
      githubLink: "https://github.com/0xNilesh",
    },
  ];

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: '#2a2a2a' }}>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div 
          className="rounded-lg p-8"
        >
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{ 
                color: primaryColor,
                fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif'
              }}
            >
              Team
            </h1>
            <div className="h-1 w-24 mx-auto mb-6" style={{ backgroundColor: primaryColor }}></div>
          </div>

          {/* Team Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {teamMembers.map((member, index) => (
              <div key={index} className="w-full max-w-sm mx-auto">
                <TeamCard
                  name={member.name}
                  characterImage={member.characterImage}
                  role={member.role}
                  description={member.description}
                  twitterLink={member.twitterLink}
                  linkedinLink={member.linkedinLink}
                  githubLink={member.githubLink}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Team Card Component (copied from CharacterCard with social links instead of stats)
function TeamCard({
  name,
  characterImage,
  role,
  description,
  twitterLink,
  linkedinLink,
  githubLink,
}: {
  name: string;
  characterImage: string;
  role?: string;
  description?: string;
  twitterLink?: string;
  linkedinLink?: string;
  githubLink?: string;
}) {
  const primaryColor = "#c28ff3";
  const borderColor = "#EF4444"; // Attacker color (red)

  return (
    <div 
      className="relative w-full rounded-2xl overflow-visible flex flex-col"
      style={{
        aspectRatio: '3 / 5',
        background: 'linear-gradient(to bottom, #000000 0%, #1a0d2e 50%, #2d1b4e 100%)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
        border: `6px solid ${borderColor}`,
      }}
    >
      {/* Name Ribbon */}
      <div className="relative px-4 pt-4 pb-2 z-10">
        <div className="relative flex items-center justify-between px-4 py-2 rounded-full bg-black/50" style={{
          border: '2px solid #8B5CF6',
          boxShadow: '0 2px 8px rgba(139, 92, 246, 0.4)',
        }}>
          <h3 className="text-white text-lg font-bold uppercase tracking-wider" style={{ 
            fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif',
            letterSpacing: '0.1em',
          }}>
            {name}
          </h3>
          <div className="flex items-center justify-center">
            <GiBroadsword className="text-white" size={14} />
          </div>
        </div>
      </div>

      {/* Character Image Section */}
      <div className="relative px-4 pb-4 z-10 flex-1 flex flex-col">
        <div 
          className="relative w-full flex-1 rounded-xl overflow-hidden"
          style={{
            border: `4px solid ${borderColor}`,
            boxShadow: `0 4px 16px ${borderColor}60`,
            minHeight: 0
          }}
        >
          <div className="absolute inset-0">
            <Image
              src="/new_bg.png"
              alt="Background"
              fill
              className="object-cover"
            />
          </div>
          <Image
            src={characterImage}
            alt={name}
            fill
            className="object-contain relative z-10 block"
            style={{ display: 'block' }}
          />
        </div>
      </div>

      {/* Social Links Section - Replaces Stats Section */}
      <div className="relative px-4 pb-4 z-10">
        <div className="space-y-2 mb-3">
          {/* Twitter */}
          {twitterLink && (
            <div className="flex items-center justify-between">
              <p className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif' }}>
                Twitter
              </p>
              <a
                href={twitterLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-purple-400 transition-colors text-sm font-bold"
                style={{ fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif' }}
              >
                @{twitterLink.replace('https://', '').replace('http://', '').replace('x.com/', '').replace('twitter.com/', '').replace('www.', '').replace(/\/$/, '')}
              </a>
            </div>
          )}
          
          {/* LinkedIn */}
          {linkedinLink && (
            <div className="flex items-center justify-between">
              <p className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif' }}>
                LinkedIn
              </p>
              <a
                href={linkedinLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-purple-400 transition-colors text-sm font-bold"
                style={{ fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif' }}
              >
                {linkedinLink.replace('https://', '').replace('http://', '').replace('www.linkedin.com/in/', '').replace('linkedin.com/in/', '').replace('www.', '').replace(/\/$/, '')}
              </a>
            </div>
          )}
          
          {/* GitHub */}
          {githubLink && (
            <div className="flex items-center justify-between">
              <p className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif' }}>
                GitHub
              </p>
              <a
                href={githubLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-purple-400 transition-colors text-sm font-bold"
                style={{ fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif' }}
              >
                {githubLink.replace('https://', '').replace('http://', '').replace('github.com/', '').replace('www.', '').replace(/\/$/, '')}
              </a>
            </div>
          )}
        </div>
        
        {/* Description */}
        {description && (
          <div className="mt-4 pt-3 border-t border-white/10">
            <p className="text-white/90 text-sm leading-relaxed" style={{ fontFamily: 'Arial, Helvetica, sans-serif', lineHeight: '1.6' }}>
              {description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
