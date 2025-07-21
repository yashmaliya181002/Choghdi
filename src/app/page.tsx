import Lobby from "@/components/game/Lobby";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

function LobbyLoader() {
  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-gamemat text-white">
      <Loader2 className="w-12 h-12 animate-spin mb-4" />
      <p className="text-xl">Loading Game...</p>
    </div>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Suspense fallback={<LobbyLoader />}>
        <Lobby />
      </Suspense>
    </main>
  );
}
