"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Game } from "@/lib/data";
import { createArkanoidGame, type ArkanoidHandle } from "@/lib/games/arkanoid";
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

interface ArkanoidGameProps {
  game: Game;
}

export default function ArkanoidGame({ game }: ArkanoidGameProps) {
  const user = useStoredUser();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<ArkanoidHandle | null>(null);
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

    handleRef.current = createArkanoidGame(
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

      <div className="crt">
        <div className="crt-screen">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

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
