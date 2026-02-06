import Image from "next/image";
import { FaEye } from "react-icons/fa";
import { GiBroadsword, GiCheckedShield } from "react-icons/gi";
import { FaStar } from "react-icons/fa";

type CardType = "allRound" | "attacker" | "defender" | "strategist";

interface CharacterCardProps {
  name: string;
  characterImage: string;
  attack: number;
  defense: number;
  strategist: number;
  type: CardType;
  description?: string;
}

export default function CharacterCard({
  name,
  characterImage,
  attack,
  defense,
  strategist,
  type,
  description,
}: CharacterCardProps) {
  // Get border color based on type
  const getBorderColor = () => {
    switch (type) {
      case "allRound":
        return "#FFD700";
      case "attacker":
        return "#EF4444";
      case "defender":
        return "#3B82F6";
      case "strategist":
        return "#10B981";
      default:
        return "#6B7280";
    }
  };

  const borderColor = getBorderColor();

  // Get type icon
  const getTypeIcon = () => {
    switch (type) {
      case "attacker":
        return <GiBroadsword className="text-white" size={14} />;
      case "defender":
        return <GiCheckedShield className="text-white" size={14} />;
      case "strategist":
        return <FaEye className="text-white" size={14} />;
      case "allRound":
        return <FaStar className="text-white" size={14} />;
      default:
        return <FaEye className="text-white" size={14} />;
    }
  };

  return (
    <div 
      className="relative w-80 rounded-2xl overflow-hidden card-metallic-shine"
      style={{
        background: 'linear-gradient(to bottom, #000000 0%, #1a0d2e 50%, #2d1b4e 100%)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
        border: `6px solid ${borderColor}`,
      }}
    >
      {/* Metallic overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background: 'linear-gradient(45deg, rgba(153, 153, 153, 0.3) 5%, rgba(255, 255, 255, 0.4) 10%, rgba(204, 204, 204, 0.3) 30%, rgba(221, 221, 221, 0.3) 50%, rgba(204, 204, 204, 0.3) 70%, rgba(255, 255, 255, 0.4) 80%, rgba(153, 153, 153, 0.3) 95%)',
        }}
      />
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
            {getTypeIcon()}
          </div>
        </div>
      </div>

      {/* Character Image Section */}
      <div className="relative px-4 pb-4 z-10">
        <div 
          className="relative w-full aspect-square rounded-xl overflow-hidden"
          style={{
            border: `4px solid ${borderColor}`,
            boxShadow: `0 4px 16px ${borderColor}60`,
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
            className="object-contain relative z-10"
          />
        </div>
      </div>

      {/* Stats Section - 2 Columns, 3 Rows */}
      <div className="relative px-4 pb-4 z-10">
        <div className="space-y-2 mb-3">
          {/* Attack */}
          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif' }}>
              Attack
            </p>
            <p className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif' }}>
              {attack}
            </p>
          </div>
          
          {/* Defense */}
          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif' }}>
              Defense
            </p>
            <p className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif' }}>
              {defense}
            </p>
          </div>
          
          {/* Strategist */}
          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif' }}>
              Strategist
            </p>
            <p className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif' }}>
              {strategist}
            </p>
          </div>
        </div>
        
        {/* Character Description */}
        {description && (
          <div className="mt-2">
            <p className="text-white text-xs leading-relaxed" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
              {description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
