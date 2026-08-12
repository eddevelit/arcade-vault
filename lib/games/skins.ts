export type SkinId = "clasico" | "neon" | "retro";

export const SKIN_IDS: readonly SkinId[] = ["clasico", "neon", "retro"];

export const DEFAULT_SKIN: SkinId = "clasico";

export const SKIN_LABELS: Record<SkinId, string> = {
  clasico: "CLÁSICO",
  neon: "NEÓN",
  retro: "RETRO",
};

const skinKey = (gameId: string) => `av_skin_${gameId}`;

function isSkinId(value: unknown): value is SkinId {
  return typeof value === "string" && SKIN_IDS.includes(value as SkinId);
}

// La preferencia es por juego, no global: cada motor lee la suya al montar.
// Cualquier valor ausente, corrupto o un localStorage que tire (modo privado)
// cae al default en vez de romper la partida.
export function getSkin(gameId: string): SkinId {
  try {
    const raw = localStorage.getItem(skinKey(gameId));
    return isSkinId(raw) ? raw : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

export function saveSkin(gameId: string, skin: SkinId): void {
  try {
    localStorage.setItem(skinKey(gameId), skin);
  } catch {
    // Sin persistencia (modo privado): la skin igual aplica en la sesión actual.
  }
}
