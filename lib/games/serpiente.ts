export interface SerpienteHandle {
  destroy: () => void;
  restart: () => void;
}

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

const GRID_LINE = "rgba(255, 255, 255, 0.06)";

export function createSerpienteGame(
  canvas: HTMLCanvasElement,
  onGameOver: (finalScore: number) => void,
): SerpienteHandle {
  const ctx = canvas.getContext("2d")!;

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
    ctx.strokeStyle = GRID_LINE;
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
    snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? "#8CFF7A" : "#3FA637";
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }

  function drawFood() {
    if (!fruitImage) return;
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
  }

  function drawHUD() {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px monospace";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE ${score}`, 10, 10);
    ctx.textAlign = "right";
    const speed = Math.round((1000 / tickInterval) * 10) / 10;
    ctx.fillText(`VELOCIDAD ${speed}`, canvas.width - 10, 10);
  }

  function draw() {
    ctx.fillStyle = "#0a0a0a";
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
      window.removeEventListener("keydown", onKeyDown);
    },
    restart() {
      resetState();
      if (animId !== null) cancelAnimationFrame(animId);
      startLoop();
    },
  };
}
