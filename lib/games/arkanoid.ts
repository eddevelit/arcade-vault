import {
  loadSpritesheet,
  drawSprite,
  drawFrame,
  EXPLOSION_FRAMES,
  EXPLOSION_DURATION,
} from "./arkanoid-sprites";
import { DEFAULT_SKIN, type SkinId } from "./skins";

export interface ArkanoidHandle {
  destroy: () => void;
  restart: () => void;
  togglePause: () => void;
  setSkin: (skin: SkinId) => void;
}

export interface ArkanoidPalette {
  bg: string;
  overlay: string;
  overlayText: string;
  pauseOverlay: string;
  pauseText: string;
  hud: string;
  /**
   * Los sprites vienen de un spritesheet y se dibujan con `drawImage`, que
   * ignora `fillStyle`. La única forma de teñirlos sin tocar el asset es un
   * `ctx.filter`; `"none"` los deja exactamente como están.
   */
  spriteFilter: string;
  /** shadowBlur del glow; 0 desactiva el efecto por completo. */
  glow: number;
  glowColor: string;
}

const ARKANOID_SKINS: Record<SkinId, ArkanoidPalette> = {
  clasico: {
    bg: "#000",
    overlay: "rgba(0, 0, 0, 0.6)",
    overlayText: "#fff",
    pauseOverlay: "rgba(0, 0, 0, 0.65)",
    pauseText: "#fff",
    hud: "#fff",
    spriteFilter: "none",
    glow: 0,
    glowColor: "transparent",
  },
  neon: {
    bg: "#06020e",
    overlay: "rgba(6, 2, 14, 0.72)",
    overlayText: "#0ff",
    pauseOverlay: "rgba(6, 2, 14, 0.78)",
    pauseText: "#ff0",
    hud: "#0ff",
    spriteFilter: "saturate(2.4) brightness(1.15) contrast(1.1)",
    glow: 14,
    glowColor: "#f0f",
  },
  retro: {
    bg: "#140c00",
    overlay: "rgba(20, 12, 0, 0.72)",
    overlayText: "#ffb000",
    pauseOverlay: "rgba(20, 12, 0, 0.78)",
    pauseText: "#ffb000",
    hud: "#ffb000",
    // grayscale + sepia colapsa los 7 colores de bloque a un solo matiz ámbar,
    // conservando su luminancia original como rampa de tonos.
    spriteFilter: "grayscale(1) sepia(1) saturate(5) brightness(1.35)",
    glow: 0,
    glowColor: "transparent",
  },
};

interface Paddle {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Ball {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alive: boolean;
}

interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  elapsed: number;
}

interface LevelBlock {
  col: number;
  row: number;
  color: string;
}

interface Level {
  speed: number;
  blocks: LevelBlock[];
}

type GameState = "playing" | "gameover" | "win";

const LEVELS: Level[] = (() => {
  const rowColors1 = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];
  const rowColors2 = ["gray", "cyan", "hotpink", "yellow", "magenta", "green"];
  const rowColors4 = ["cyan", "magenta", "green", "yellow", "hotpink", "red"];

  const l1: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      l1.push({ col, row, color: rowColors1[row] });

  const l2: LevelBlock[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < 6; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if ((col + row) % 2 === 0)
        l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if (!gaps4[row].includes(col))
        l4.push({ col, row, color: rowColors4[row] });

  const l5: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({
          col,
          row,
          color: isCross && !isFrame ? "hotpink" : "cyan",
        });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();

const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (800 - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;

const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "KeyP", "Escape"]);

export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  onGameOver: (finalScore: number) => void,
  skin: SkinId = DEFAULT_SKIN,
): ArkanoidHandle {
  const ctx = canvas.getContext("2d")!;

  let palette = ARKANOID_SKINS[skin] ?? ARKANOID_SKINS[DEFAULT_SKIN];

  // Enciende el glow de la skin y lo apaga siempre al salir, para que no se
  // filtre al resto del frame. Nunca alrededor del loop de bloques: son hasta
  // 60 `drawImage` por frame y el shadowBlur ahí sale carísimo.
  function withGlow(color: string, draw: () => void) {
    if (palette.glow > 0) {
      ctx.shadowColor = color;
      ctx.shadowBlur = palette.glow;
    }
    draw();
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }

  const paddle: Paddle = { x: 0, y: 560, w: 81, h: 14 };
  const ball: Ball = { x: 0, y: 0, w: 16, h: 16, vx: 200, vy: -300 };

  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let lives = 3;
  let score = 0;
  let gameState: GameState = "playing";
  let currentLevel = 1;
  let isPaused = false;
  let gameOverReported = false;
  let animId: number | null = null;
  let lastTime: number | null = null;
  let destroyed = false;

  const keys = { ArrowLeft: false, ArrowRight: false };

  function initPaddle() {
    paddle.x = (canvas.width - paddle.w) / 2;
  }

  function initBall() {
    const speed = LEVELS[currentLevel - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    currentLevel = n;
    const level = LEVELS[n - 1];
    blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * level.speed;
    ball.vy = BASE_BALL_VY * level.speed;
  }

  function collideAABB(block: Block): boolean {
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }

  function togglePause() {
    if (gameState !== "playing") return;
    isPaused = !isPaused;
  }

  function onMouseMove(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    paddle.x = Math.max(
      0,
      Math.min(canvas.width - paddle.w, mouseX - paddle.w / 2),
    );
  }

  function onKeyDown(e: KeyboardEvent) {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (e.code === "ArrowLeft") keys.ArrowLeft = true;
    if (e.code === "ArrowRight") keys.ArrowRight = true;
    if (e.code === "KeyP" || e.code === "Escape") togglePause();
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code === "ArrowLeft") keys.ArrowLeft = false;
    if (e.code === "ArrowRight") keys.ArrowRight = false;
  }

  canvas.addEventListener("mousemove", onMouseMove);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function update(dt: number) {
    if (gameState !== "playing") return;

    if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys.ArrowRight)
      paddle.x = Math.min(
        canvas.width - paddle.w,
        paddle.x + PADDLE_SPEED * dt,
      );

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.w >= canvas.width) {
      ball.x = canvas.width - ball.w;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
    }

    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
    }

    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(block)) {
        block.alive = false;
        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        score += 10;
        ball.vy = -ball.vy;
        if (blocks.every((b) => !b.alive)) {
          if (currentLevel < 5) loadLevel(currentLevel + 1);
          else gameState = "win";
        }
        break;
      }
    }

    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    if (ball.y > canvas.height) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        gameState = "gameover";
      } else {
        initBall();
      }
    }
  }

  function drawOverlay(message: string) {
    ctx.fillStyle = palette.overlay;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = palette.overlayText;
    ctx.font = "bold 64px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    withGlow(palette.overlayText, () =>
      ctx.fillText(message, canvas.width / 2, canvas.height / 2),
    );
  }

  function drawPauseOverlay() {
    ctx.fillStyle = palette.pauseOverlay;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = palette.pauseText;
    ctx.font = "bold 56px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    withGlow(palette.pauseText, () =>
      ctx.fillText("PAUSA", canvas.width / 2, canvas.height / 2),
    );
  }

  function draw() {
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // El filtro se setea una sola vez para todo el bloque de sprites: cambiarlo
    // por cada `drawImage` obliga al canvas a recompilar el filtro en cada llamada.
    ctx.filter = palette.spriteFilter;

    for (const block of blocks) {
      if (block.alive)
        drawSprite(
          ctx,
          "block_" + block.color,
          block.x,
          block.y,
          block.w,
          block.h,
        );
    }

    for (const exp of explosions) {
      const frameIndex = Math.min(
        Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
        3,
      );
      drawFrame(
        ctx,
        EXPLOSION_FRAMES[exp.color][frameIndex],
        exp.x,
        exp.y,
        exp.w,
        exp.h,
      );
    }

    withGlow(palette.glowColor, () => {
      drawSprite(ctx, "paddle", paddle.x, paddle.y, paddle.w, paddle.h);
      drawSprite(ctx, "ball", ball.x, ball.y, ball.w, ball.h);
    });

    ctx.filter = "none";

    if (gameState === "playing") {
      ctx.fillStyle = palette.hud;
      ctx.font = "bold 18px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      withGlow(palette.hud, () => {
        ctx.fillText("Score: " + score, 10, 10);
        ctx.textAlign = "center";
        ctx.fillText("Nivel: " + currentLevel, canvas.width / 2, 10);
      });
      const ballSize = 16;
      const ballSpacing = 4;
      ctx.filter = palette.spriteFilter;
      for (let i = 0; i < lives; i++) {
        const bx = canvas.width - 10 - (lives - i) * (ballSize + ballSpacing);
        drawSprite(ctx, "ball", bx, 10, ballSize, ballSize);
      }
      ctx.filter = "none";
    }

    if (gameState === "gameover") drawOverlay("GAME OVER");
    if (gameState === "win") drawOverlay("¡Completaste el juego!");
    if (isPaused) drawPauseOverlay();
  }

  function reportGameOverOnce() {
    if (gameOverReported) return;
    gameOverReported = true;
    onGameOver(score);
  }

  function loop(timestamp: number) {
    if (lastTime === null) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (!isPaused) update(dt);
    draw();

    if (gameState === "gameover" || gameState === "win") {
      animId = null;
      reportGameOverOnce();
      return;
    }

    animId = requestAnimationFrame(loop);
  }

  function startLoop() {
    initPaddle();
    loadLevel(1);
    lastTime = null;
    animId = requestAnimationFrame(loop);
  }

  loadSpritesheet(() => {
    if (destroyed) return;
    startLoop();
  });

  return {
    destroy() {
      destroyed = true;
      if (animId !== null) cancelAnimationFrame(animId);
      animId = null;
      canvas.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
    restart() {
      lives = 3;
      score = 0;
      gameState = "playing";
      isPaused = false;
      gameOverReported = false;
      if (animId !== null) cancelAnimationFrame(animId);
      startLoop();
    },
    togglePause,
    // Sólo repinta: no reinicia la partida ni resetea el score. Si el loop ya
    // se detuvo (game over o victoria), fuerza un frame para que el cambio se vea.
    setSkin(next: SkinId) {
      palette = ARKANOID_SKINS[next] ?? ARKANOID_SKINS[DEFAULT_SKIN];
      if (animId === null && !destroyed) draw();
    },
  };
}
