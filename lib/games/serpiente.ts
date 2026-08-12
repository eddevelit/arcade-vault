import { DEFAULT_SKIN, type SkinId } from "@/lib/games/skins";

export interface SerpienteHandle {
  destroy: () => void;
  restart: () => void;
  setSkin: (skin: SkinId) => void;
}

export interface SerpientePalette {
  bg: string;
  grid: string;
  snakeHead: string;
  snakeBody: string;
  hud: string;
  /** Tinte de la fruta; `null` deja el sprite original sin teñir. */
  fruitTint: string | null;
  /** shadowBlur del glow; 0 desactiva el efecto por completo. */
  glow: number;
}

const SERPIENTE_SKINS: Record<SkinId, SerpientePalette> = {
  clasico: {
    bg: "#0a0a0a",
    grid: "rgba(255, 255, 255, 0.06)",
    snakeHead: "#8CFF7A",
    snakeBody: "#3FA637",
    hud: "#fff",
    fruitTint: null,
    glow: 0,
  },
  neon: {
    bg: "#06020e",
    grid: "rgba(255, 0, 255, 0.10)",
    snakeHead: "#ff0",
    snakeBody: "#0ff",
    hud: "#0ff",
    fruitTint: "#f0f",
    glow: 10,
  },
  retro: {
    bg: "#140c00",
    grid: "rgba(255, 176, 0, 0.10)",
    snakeHead: "#ffd980",
    snakeBody: "#c98a00",
    hud: "#ffb000",
    fruitTint: "#ffb000",
    glow: 0,
  },
};

type Direction = "up" | "down" | "left" | "right";

interface Cell {
  x: number;
  y: number;
}

const COLS = 40;
const ROWS = 30;
const CELL = 20;

const INITIAL_LENGTH = 3;
const INITIAL_TICK_INTERVAL = 150;
const MIN_TICK_INTERVAL = 60;
const TICK_DECREASE = 4;
const POINTS_PER_FRUIT = 10;

const DIRECTION_VECTORS: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

// Coordenadas dentro de fruits.png (spritesheet 3790×442px, fila de frutas y=136–295),
// tomadas de sprites.js. Se usa una única fruta fija: manzana.
const FRUIT_SPRITE = { x: 2786, y: 136, w: 110, h: 160 } as const;

export function createSerpienteGame(
  canvas: HTMLCanvasElement,
  onGameOver: (finalScore: number) => void,
  skin: SkinId = DEFAULT_SKIN,
): SerpienteHandle {
  const ctx = canvas.getContext("2d")!;

  let palette = SERPIENTE_SKINS[skin] ?? SERPIENTE_SKINS[DEFAULT_SKIN];

  // Enciende el glow de la skin y lo apaga siempre al salir, para que no se
  // filtre al resto del frame (HUD y grilla incluidos).
  function withGlow(color: string, draw: () => void) {
    if (palette.glow > 0) {
      ctx.shadowColor = color;
      ctx.shadowBlur = palette.glow;
    }
    draw();
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }

  let snake: Cell[] = [];
  let food: Cell = { x: 0, y: 0 };
  let direction: Direction = "right";
  let pendingDirection: Direction = "right";
  let score = 0;
  let tickInterval = INITIAL_TICK_INTERVAL;
  let gameOver = false;
  let gameOverReported = false;

  let fruitImage: HTMLImageElement | null = null;
  let destroyed = false;

  // Versión teñida del sprite de la fruta, cacheada por color de tinte. Se
  // construye en el primer dibujo posterior a un cambio de skin, nunca en la
  // carga de la imagen, para no tocar el arranque asíncrono del loop.
  let tintedFruit: HTMLCanvasElement | null = null;
  let tintedFruitKey: string | null = null;

  let animId: number | null = null;
  let lastTime: number | null = null;
  let accumulator = 0;

  function resetState() {
    const startX = Math.floor(COLS / 2);
    const startY = Math.floor(ROWS / 2);
    snake = Array.from({ length: INITIAL_LENGTH }, (_, i) => ({
      x: startX - i,
      y: startY,
    }));
    direction = "right";
    pendingDirection = "right";
    score = 0;
    tickInterval = INITIAL_TICK_INTERVAL;
    gameOver = false;
    gameOverReported = false;
    placeFood();
  }

  function placeFood() {
    const occupied = new Set(snake.map((s) => `${s.x},${s.y}`));
    const free: Cell[] = [];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    food = free[Math.floor(Math.random() * free.length)];
  }

  function endGame() {
    gameOver = true;
  }

  function tick() {
    direction = pendingDirection;
    const vector = DIRECTION_VECTORS[direction];
    const head = snake[0];
    const newHead: Cell = { x: head.x + vector.x, y: head.y + vector.y };

    if (
      newHead.x < 0 ||
      newHead.x >= COLS ||
      newHead.y < 0 ||
      newHead.y >= ROWS
    ) {
      endGame();
      return;
    }

    const ateFood = newHead.x === food.x && newHead.y === food.y;
    // Si no come, la cola se libera este mismo tick, así que no cuenta como colisión.
    const bodyToCheck = ateFood ? snake : snake.slice(0, -1);
    const selfCollision = bodyToCheck.some(
      (seg) => seg.x === newHead.x && seg.y === newHead.y,
    );
    if (selfCollision) {
      endGame();
      return;
    }

    snake.unshift(newHead);
    if (ateFood) {
      score += POINTS_PER_FRUIT;
      tickInterval = Math.max(MIN_TICK_INTERVAL, tickInterval - TICK_DECREASE);
      placeFood();
    } else {
      snake.pop();
    }
  }

  function drawGrid() {
    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL, 0);
      ctx.lineTo(c * CELL, ROWS * CELL);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(COLS * CELL, r * CELL);
      ctx.stroke();
    }
  }

  function drawSnake() {
    // Un solo bloque de glow por grupo: encender la sombra por segmento sería
    // caro con la serpiente ya larga.
    withGlow(palette.snakeBody, () => {
      ctx.fillStyle = palette.snakeBody;
      for (let i = 1; i < snake.length; i++) {
        const seg = snake[i];
        ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
      }
    });
    withGlow(palette.snakeHead, () => {
      const head = snake[0];
      ctx.fillStyle = palette.snakeHead;
      ctx.fillRect(head.x * CELL + 1, head.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }

  // Tiñe el sprite con blend `color`: reemplaza matiz y saturación pero conserva
  // la luminosidad original, así la fruta mantiene su sombreado. El `destination-in`
  // final restaura el canal alpha, que el fillRect había pisado.
  function buildTintedFruit(tint: string): HTMLCanvasElement | null {
    if (!fruitImage) return null;
    const off = document.createElement("canvas");
    off.width = FRUIT_SPRITE.w;
    off.height = FRUIT_SPRITE.h;
    const octx = off.getContext("2d");
    if (!octx) return null;

    const args = [
      FRUIT_SPRITE.x,
      FRUIT_SPRITE.y,
      FRUIT_SPRITE.w,
      FRUIT_SPRITE.h,
      0,
      0,
      FRUIT_SPRITE.w,
      FRUIT_SPRITE.h,
    ] as const;

    octx.drawImage(fruitImage, ...args);
    octx.globalCompositeOperation = "color";
    octx.fillStyle = tint;
    octx.fillRect(0, 0, off.width, off.height);
    octx.globalCompositeOperation = "destination-in";
    octx.drawImage(fruitImage, ...args);
    octx.globalCompositeOperation = "source-over";
    return off;
  }

  function drawFood() {
    if (!fruitImage) return;
    const tint = palette.fruitTint;

    if (!tint) {
      ctx.drawImage(
        fruitImage,
        FRUIT_SPRITE.x,
        FRUIT_SPRITE.y,
        FRUIT_SPRITE.w,
        FRUIT_SPRITE.h,
        food.x * CELL,
        food.y * CELL,
        CELL,
        CELL,
      );
      return;
    }

    if (tintedFruitKey !== tint) {
      tintedFruit = buildTintedFruit(tint);
      tintedFruitKey = tint;
    }
    if (!tintedFruit) return;

    withGlow(tint, () =>
      ctx.drawImage(tintedFruit!, food.x * CELL, food.y * CELL, CELL, CELL),
    );
  }

  function drawHUD() {
    ctx.font = "bold 18px monospace";
    ctx.textBaseline = "top";
    withGlow(palette.hud, () => {
      ctx.fillStyle = palette.hud;
      ctx.textAlign = "left";
      ctx.fillText(`SCORE ${score}`, 10, 10);
      ctx.textAlign = "right";
      const speed = Math.round((1000 / tickInterval) * 10) / 10;
      ctx.fillText(`VELOCIDAD ${speed}`, canvas.width - 10, 10);
    });
  }

  function draw() {
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawSnake();
    drawFood();
    drawHUD();
  }

  function reportGameOverOnce() {
    if (gameOverReported) return;
    gameOverReported = true;
    onGameOver(score);
  }

  function loop(timestamp: number) {
    if (lastTime === null) lastTime = timestamp;
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    accumulator += dt;
    while (accumulator >= tickInterval && !gameOver) {
      accumulator -= tickInterval;
      tick();
    }

    draw();

    if (gameOver) {
      animId = null;
      reportGameOverOnce();
      return;
    }

    animId = requestAnimationFrame(loop);
  }

  function startLoop() {
    lastTime = null;
    accumulator = 0;
    animId = requestAnimationFrame(loop);
  }

  function onKeyDown(e: KeyboardEvent) {
    const newDirection = KEY_TO_DIRECTION[e.code];
    if (!newDirection) return;
    e.preventDefault();
    if (gameOver) return;
    // Se valida contra `direction` (la ya aplicada), no contra pendingDirection,
    // para no permitir una reversa de 180° acumulada en dos inputs del mismo tick.
    if (OPPOSITE_DIRECTION[newDirection] === direction) return;
    pendingDirection = newDirection;
  }

  window.addEventListener("keydown", onKeyDown);

  resetState();

  const image = new Image();
  image.onload = () => {
    if (destroyed) return;
    fruitImage = image;
    startLoop();
  };
  image.onerror = () => {
    console.error("No se pudo cargar fruits.png");
  };
  image.src = "/games/serpiente/fruits.png";

  return {
    destroy() {
      destroyed = true;
      if (animId !== null) cancelAnimationFrame(animId);
      animId = null;
      tintedFruit = null;
      tintedFruitKey = null;
      window.removeEventListener("keydown", onKeyDown);
    },
    restart() {
      resetState();
      if (animId !== null) cancelAnimationFrame(animId);
      startLoop();
    },
    // Sólo repinta: no reinicia la partida, el score ni la velocidad acumulada.
    // Con la partida terminada el loop ya no corre, así que se fuerza un frame.
    setSkin(next: SkinId) {
      palette = SERPIENTE_SKINS[next] ?? SERPIENTE_SKINS[DEFAULT_SKIN];
      if (animId === null && fruitImage) draw();
    },
  };
}
