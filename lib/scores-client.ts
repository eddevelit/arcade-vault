import { createClient as createBrowserClient } from "@/lib/supabase/client";

// client-safe — reemplaza al saveScore actual de lib/session.ts
export async function saveScore(entry: {
  game: string;
  score: number;
  name: string;
}): Promise<void> {
  const supabase = createBrowserClient();
  const { error } = await supabase.from("scores").insert({
    game_id: entry.game,
    player_name: entry.name,
    score: entry.score,
  });
  if (error) throw error;
}
