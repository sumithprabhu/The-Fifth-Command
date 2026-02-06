import CharacterCard from "@/components/CharacterCard";
import charMeta from "@/char_meta.json";

export default function PlaygroundPage({ params }: { params: { id: string } }) {
  // Get first character from each type
  const defender = charMeta.defender[0];
  const attacker = charMeta.attacker[0];
  const allRound = charMeta.allRound[0];
  const strategist = charMeta.strategist[0];

  return (
    <div className="min-h-screen w-full flex items-center justify-center py-8" style={{ backgroundColor: '#131313' }}>
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 justify-items-center">
          {/* Defender Card */}
          <CharacterCard
            name={defender.name}
            characterImage={defender.image}
            attack={defender.attack}
            defense={defender.defense}
            strategist={defender.strategist}
            type="defender"
            description={defender.description}
          />
          
          {/* Attacker Card */}
          <CharacterCard
            name={attacker.name}
            characterImage={attacker.image}
            attack={attacker.attack}
            defense={attacker.defense}
            strategist={attacker.strategist}
            type="attacker"
            description={attacker.description}
          />
          
          {/* AllRound Card */}
          <CharacterCard
            name={allRound.name}
            characterImage={allRound.image}
            attack={allRound.attack}
            defense={allRound.defense}
            strategist={allRound.strategist}
            type="allRound"
            description={allRound.description}
          />
          
          {/* Strategist Card */}
          <CharacterCard
            name={strategist.name}
            characterImage={strategist.image}
            attack={strategist.attack}
            defense={strategist.defense}
            strategist={strategist.strategist}
            type="strategist"
            description={strategist.description}
          />
        </div>
      </div>
    </div>
  );
}
