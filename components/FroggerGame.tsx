"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Game } from "@/lib/data";
import { createFroggerGame, type FroggerHandle } from "@/lib/games/frogger";
import {
  DEFAULT_SKIN,
  SKIN_IDS,
  SKIN_LABELS,
  getSkin,
  saveSkin,
  type SkinId,
} from "@/lib/games/skins";
import { useStoredUser } from "@/lib/session";
import { saveScore } from "@/lib/scores-client";
import TouchControls from "@/components/TouchControls";

interface FroggerGameProps {
  game: Game;
}

export default function FroggerGame({ game }: FroggerGameProps) {
  const user = useStoredUser();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<FroggerHandle | null>(null);
  const [over, setOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [skin, setSkin] = useState<SkinId>(DEFAULT_SKIN);
  const gameIdRef = useRef(game.id);

  const name = nameOverride ?? (user ? user.name : "INVITADO");

  // Deps [] a propósito: cambiar de skin nunca debe recrear el motor ni tirar
  // la partida en curso. La skin guardada se hidrata acá, ya en el browser.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stored = getSkin(gameIdRef.current);
    setSkin(stored);

    handleRef.current = createFroggerGame(
      canvas,
      (score) => {
        setFinalScore(score);
        setOver(true);
      },
      stored,
    );

    return () => {
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

  const changeSkin = (next: SkinId) => {
    setSkin(next);
    saveSkin(gameIdRef.current, next);
    handleRef.current?.setSkin(next);
  };

  const restart = () => {
    setOver(false);
    setSaved(false);
    setSaving(false);
    setSaveError(false);
    setNameOverride(null);
    handleRef.current?.restart();
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      await saveScore({ game: game.id, score: finalScore, name });
      setSaved(true);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="av-player fade-in">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SKIN_IDS.map((id) => (
            <button
              key={id}
              className={id === skin ? "btn yellow" : "btn ghost"}
              onClick={() => changeSkin(id)}
              aria-pressed={id === skin}
            >
              {SKIN_LABELS[id]}
            </button>
          ))}
        </div>
        <Link href="/biblioteca" className="btn ghost">
          VOLVER AL VAULT
        </Link>
      </div>

      {/* El tablero es 640×560 (8/7), no el 4/3 que asume .crt-screen: sin este
          aspect-ratio propio la grilla se estira 17% a lo ancho. El tope de
          ancho evita que, ya sin estirar, el tablero crezca de alto en desktop. */}
      <div className="crt" style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="crt-screen" style={{ aspectRatio: "8 / 7" }}>
          <canvas
            ref={canvasRef}
            width={640}
            height={560}
            style={{ width: "100%", height: "100%", touchAction: "none" }}
          />
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {/* accent="green": game.color de Frogger es `lime`, que no existe en la
          union de TouchControls (compartido, fuera de alcance) — se usa el tono
          más cercano del set disponible. */}
      <TouchControls
        accent="green"
        actions={[{ id: "pause", label: "PAUSA", code: "KeyP" }]}
      />

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{finalScore.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setNameOverride(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "GUARDANDO..." : "GUARDAR PUNTUACIÓN"}
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            {saveError && (
              <div className="input-row">
                <span className="mono" style={{ color: "var(--ink-dim)" }}>
                  ERROR AL GUARDAR LA PUNTUACIÓN.
                </span>
                <button className="btn magenta" onClick={handleSave}>
                  REINTENTAR
                </button>
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/biblioteca" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
