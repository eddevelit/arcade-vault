import { getGames } from "@/lib/games";
import HallOfFameClient from "@/components/HallOfFameClient";

export default async function HallOfFamePage() {
  const games = await getGames();
  return <HallOfFameClient games={games} />;
}
