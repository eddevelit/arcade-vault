import type { Viewport } from "next";
import { notFound } from "next/navigation";
import { getGame } from "@/lib/games";
import GameLauncher from "@/components/GameLauncher";

// Solo esta ruta: bloquea pinch-zoom/scroll durante la partida sin afectar
// el resto del sitio (que no declara viewport y usa el default del navegador).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function GamePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  return <GameLauncher game={game} />;
}
