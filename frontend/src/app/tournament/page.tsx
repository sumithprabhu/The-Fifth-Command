"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentGameId } from "@/lib/contract";

export default function TournamentPage() {
  const router = useRouter();
  
  useEffect(() => {
    async function redirectToCurrentGame() {
      try {
        const gameId = await getCurrentGameId();
        router.replace(`/tournament/${Number(gameId)}`);
      } catch (error) {
        console.error("Error fetching current game ID:", error);
        // If no current game, redirect to home
        router.replace('/');
      }
    }
    
    redirectToCurrentGame();
  }, [router]);
  
  return (
    <div className="h-screen w-full flex items-center justify-center" style={{ backgroundColor: '#131313' }}>
      <p className="text-white text-xl" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
        Redirecting to tournament...
      </p>
    </div>
  );
}
