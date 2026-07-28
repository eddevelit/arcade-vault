import { notFound } from "next/navigation";
import { getGame } from "@/lib/games";
import GamePlayer from "@/components/GamePlayer";
import { GAME_COMPONENTS } from "@/lib/games/registry";

export default async function GamePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  const Component = GAME_COMPONENTS[game.id] ?? GamePlayer;
  return <Component game={game} />;
}
