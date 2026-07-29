"use client";

import type { Game } from "@/lib/data";
import { GAME_COMPONENTS } from "@/lib/games/registry";
import GamePlayer from "@/components/GamePlayer";

interface GameLauncherProps {
  game: Game;
}

export default function GameLauncher({ game }: GameLauncherProps) {
  const Component = GAME_COMPONENTS[game.id] ?? GamePlayer;
  return <Component game={game} />;
}
