import { notFound } from "next/navigation";
import { getGame } from "@/lib/games";
import GameLauncher from "@/components/GameLauncher";

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
