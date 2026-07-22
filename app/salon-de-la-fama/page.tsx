import { getGames } from "@/lib/games";
import { getAllTopScores } from "@/lib/scores";
import HallOfFameClient from "@/components/HallOfFameClient";

export default async function HallOfFamePage() {
  const [games, scoresByGame] = await Promise.all([
    getGames(),
    getAllTopScores(12),
  ]);
  return <HallOfFameClient games={games} scoresByGame={scoresByGame} />;
}
