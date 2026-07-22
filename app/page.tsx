import { getGames } from "@/lib/games";
import HomeClient from "@/components/HomeClient";

export default async function HomePage() {
  const games = await getGames();
  return <HomeClient games={games} />;
}
