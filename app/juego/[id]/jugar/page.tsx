import { notFound } from "next/navigation";
import { GAMES } from "@/lib/data";
import GamePlayer from "@/components/GamePlayer";
import AsteroidsGame from "@/components/AsteroidsGame";

export default async function GamePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  if (game.id === "asteroides") return <AsteroidsGame game={game} />;

  return <GamePlayer game={game} />;
}
