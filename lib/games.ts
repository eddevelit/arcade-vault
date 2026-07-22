import { createClient } from "@/lib/supabase/server";
import type { Game } from "@/lib/data";

const GAME_COLUMNS = "id, title, short, long, cat, cover, color, best, plays";

export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select(GAME_COLUMNS)
    .order("sort_order");
  if (error) throw error;
  return data;
}

export async function getGame(id: string): Promise<Game | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select(GAME_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
