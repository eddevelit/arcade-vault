import { notFound } from "next/navigation";
import { getGame } from "@/lib/games";
import GamePlayer from "@/components/GamePlayer";
import AsteroidsGame from "@/components/AsteroidsGame";

export default async function GamePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  if (game.id === "asteroides") return <AsteroidsGame game={game} />;

  return <GamePlayer game={game} />;
}
