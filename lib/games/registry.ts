"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { Game } from "@/lib/data";

export const GAME_COMPONENTS: Record<string, ComponentType<{ game: Game }>> = {
  asteroides: dynamic(() => import("@/components/AsteroidsGame"), {
    ssr: false,
  }),
  tetris: dynamic(() => import("@/components/TetrisGame"), { ssr: false }),
  arkanoid: dynamic(() => import("@/components/ArkanoidGame"), {
    ssr: false,
  }),
  serpiente: dynamic(() => import("@/components/SerpienteGame"), {
    ssr: false,
  }),
};
