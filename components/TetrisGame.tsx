"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Game } from "@/lib/data";
import { createTetrisGame, type TetrisHandle } from "@/lib/games/tetris";
import { useStoredUser } from "@/lib/session";
import { saveScore } from "@/lib/scores-client";
import TouchControls from "@/components/TouchControls";

interface TetrisGameProps {
  game: Game;
}

export default function TetrisGame({ game }: TetrisGameProps) {
  const user = useStoredUser();
  const boardCanvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<TetrisHandle | null>(null);
  const [over, setOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const name = nameOverride ?? (user ? user.name : "INVITADO");

  useEffect(() => {
    const boardCanvas = boardCanvasRef.current;
    const nextCanvas = nextCanvasRef.current;
    if (!boardCanvas || !nextCanvas) return;

    handleRef.current = createTetrisGame(boardCanvas, nextCanvas, (score) => {
      setFinalScore(score);
      setOver(true);
    });

    return () => {
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

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
          justifyContent: "flex-end",
          marginBottom: 18,
        }}
      >
        <Link href="/biblioteca" className="btn ghost">
          VOLVER AL VAULT
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div className="crt" style={{ maxWidth: 340 }}>
          <div className="crt-screen" style={{ aspectRatio: "1 / 2" }}>
            <canvas
              ref={boardCanvasRef}
              width={300}
              height={600}
              style={{ width: "100%", height: "100%", touchAction: "none" }}
            />
          </div>
          <div className="crt-bottom">
            <span className="led">SEÑAL OK</span>
            <span>{game.title} · CRT-83 · 60 HZ</span>
            <span>CARGA · 1MB</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "center",
          }}
        >
          <span className="mono" style={{ color: "var(--ink-dim)" }}>
            SIGUIENTE
          </span>
          <canvas
            ref={nextCanvasRef}
            width={120}
            height={120}
            style={{
              width: 120,
              height: 120,
              background: "#000",
              border: "1px solid var(--ink-dim)",
            }}
          />
        </div>
      </div>

      <TouchControls
        accent="green"
        actions={[
          { id: "drop", label: "CAÍDA", code: "Space" },
          { id: "pause", label: "PAUSA", code: "KeyP" },
        ]}
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
