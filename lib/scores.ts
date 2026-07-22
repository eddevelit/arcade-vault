import { createClient as createServerClient } from "@/lib/supabase/server";
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

// server-only — usado en app/juego/[id]/page.tsx para las estadísticas en vivo (partidas jugadas y mejor puntuación)
export async function getGameStats(
  gameId: string,
): Promise<{ plays: number; best: number }> {
  const supabase = await createServerClient();

  const [{ count, error: countError }, { data: bestRow, error: bestError }] =
    await Promise.all([
      supabase
        .from("scores")
        .select("*", { count: "exact", head: true })
        .eq("game_id", gameId),
      supabase
        .from("scores")
        .select("score")
        .eq("game_id", gameId)
        .order("score", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  if (countError) throw countError;
  if (bestError) throw bestError;

  return { plays: count ?? 0, best: bestRow?.score ?? 0 };
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
