"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Game } from "@/lib/data";
import {
  createAsteroidsGame,
  type AsteroidsHandle,
} from "@/lib/games/asteroids";
import { saveScore, useStoredUser } from "@/lib/session";

interface AsteroidsGameProps {
  game: Game;
}

export default function AsteroidsGame({ game }: AsteroidsGameProps) {
  const user = useStoredUser();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<AsteroidsHandle | null>(null);
  const [over, setOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const name = nameOverride ?? (user ? user.name : "INVITADO");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    handleRef.current = createAsteroidsGame(canvas, (score) => {
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
    setNameOverride(null);
    handleRef.current?.restart();
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
                  onClick={() => {
                    saveScore({ game: game.id, score: finalScore, name });
                    setSaved(true);
                  }}
                >
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
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
