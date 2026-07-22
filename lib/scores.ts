import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { ScoreRow } from "@/lib/data";

function toScoreRow(
  row: { player_name: string; score: number; created_at: string },
  rank: number,
): ScoreRow {
  return {
    rank,
    name: row.player_name,
    score: row.score,
    date: new Date(row.created_at).toLocaleDateString("es-ES"),
  };
}

// server-only — usado en app/juego/[id]/page.tsx
export async function getTopScores(
  gameId: string,
  limit = 10,
): Promise<ScoreRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("best_scores")
    .select("player_name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((row, i) => toScoreRow(row, i + 1));
}

// server-only — usado en app/salon-de-la-fama/page.tsx, una sola query para todos los juegos de la tabla `games` (hoy, solo asteroides)
export async function getAllTopScores(
  limit = 12,
): Promise<Record<string, ScoreRow[]>> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("ranked_scores")
    .select("game_id, player_name, score, created_at, rank")
    .lte("rank", limit)
    .order("game_id")
    .order("rank");
  if (error) throw error;

  const byGame: Record<string, ScoreRow[]> = {};
  for (const row of data) {
    (byGame[row.game_id] ??= []).push(toScoreRow(row, row.rank));
  }
  return byGame;
}

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
