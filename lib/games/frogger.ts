export interface FroggerHandle {
  destroy: () => void;
  restart: () => void;
}

const COLS = 16;
const ROWS = 14;
const CELL = 40;
const W = COLS * CELL; // 640
const H = ROWS * CELL; // 560

// Zonas (índice de fila, 0 = arriba)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

const JUMP_MS = 120;
const N_GOALS = 5;
const GOAL_COLS = [1, 4, 7, 10, 13]; // columna inicial de cada boca (2 celdas de ancho)
const START_COL = 8;

const LEVEL_SPEED_MULT = 1.15;
const ROUND_TIME_BASE = 15; // segundos
const MIN_ROUND_TIME = 7;

type Direction = "up" | "down" | "left" | "right";

const DIR_KEYS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const DIR_DELTA: Record<Direction, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};

interface Entity {
  baseCol: number;
  width: number;
  type: "car" | "truck" | "log" | "turtle";
}

interface Lane {
  row: number;
  speed: number; // celdas por segundo
  dir: 1 | -1;
  entities: Entity[];
  patternLen: number;
  offset: number;
  kind: "road" | "river";
  submerged?: boolean;
  submergeT?: number;
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  fromCol: number;
  fromRow: number;
  targetCol: number;
  targetRow: number;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

function entityCol(lane: Lane, e: Entity): number {
  return mod(e.baseCol + lane.offset, lane.patternLen);
}

function buildLanes(level: number): Lane[] {
  const mult = Math.pow(LEVEL_SPEED_MULT, level - 1);
  const lanes: Lane[] = [];

  const roadBaseSpeeds = [1.5, 2.2, 3, 2.6, 4];
  const roadDirs: (1 | -1)[] = [1, -1, 1, -1, 1];
  const roadTypes: Array<"car" | "truck"> = [
    "car",
    "truck",
    "car",
    "car",
    "truck",
  ];
  for (let i = 0; i < 5; i++) {
    const type = roadTypes[i];
    const width = type === "truck" ? 2 : 1;
    const gap = 4;
    const startCol = (i % 2) * 2 - gap;
    const entities: Entity[] = [];
    let col = startCol;
    while (col < COLS + gap) {
      entities.push({ baseCol: col, width, type });
      col += gap;
    }
    lanes.push({
      row: ROW_ROAD_TOP + i,
      speed: roadBaseSpeeds[i] * mult,
      dir: roadDirs[i],
      entities,
      patternLen: col - startCol,
      offset: 0,
      kind: "road",
    });
  }

  const riverBaseSpeeds = [1, 1.6, 2.2, 1.3, 2.6, 1.8];
  const riverDirs: (1 | -1)[] = [-1, 1, -1, 1, -1, 1];
  const riverTypes: Array<"log" | "turtle"> = [
    "log",
    "turtle",
    "log",
    "turtle",
    "log",
    "turtle",
  ];
  for (let i = 0; i < 6; i++) {
    const type = riverTypes[i];
    const entities: Entity[] = [];
    let startCol: number;
    let col: number;
    if (type === "log") {
      const widths = [3, 2, 4];
      startCol = (i % 2) * 2 - 3;
      col = startCol;
      let wi = 0;
      while (col < COLS + 4) {
        const width = widths[wi % widths.length];
        entities.push({ baseCol: col, width, type });
        col += width + 2;
        wi++;
      }
    } else {
      const groupSizes = [2, 3, 2];
      startCol = (i % 2) * 3 - 3;
      col = startCol;
      let gi = 0;
      while (col < COLS + 3) {
        const size = groupSizes[gi % groupSizes.length];
        entities.push({ baseCol: col, width: size, type });
        col += size + 3;
        gi++;
      }
    }
    lanes.push({
      row: ROW_RIVER_TOP + i,
      speed: riverBaseSpeeds[i] * mult,
      dir: riverDirs[i],
      entities,
      patternLen: col - startCol,
      offset: 0,
      kind: "river",
      submerged: false,
      submergeT: i * 400,
    });
  }

  return lanes;
}

function timeForLevel(level: number): number {
  return Math.max(MIN_ROUND_TIME, ROUND_TIME_BASE - (level - 1));
}

function checkRoadCollision(frog: Frog, lanes: Lane[]): boolean {
  for (const lane of lanes) {
    if (lane.kind !== "road" || lane.row !== frog.row) continue;
    for (const e of lane.entities) {
      const col = entityCol(lane, e);
      if (frog.col >= col - 0.001 && frog.col < col + e.width - 0.001) {
        return true;
      }
    }
  }
  return false;
}

function getSupport(frog: Frog, lanes: Lane[]): Lane | null {
  for (const lane of lanes) {
    if (lane.kind !== "river" || lane.row !== frog.row) continue;
    for (const e of lane.entities) {
      if (e.type === "turtle" && lane.submerged) continue;
      const col = entityCol(lane, e);
      if (frog.col >= col - 0.001 && frog.col < col + e.width - 0.001) {
        return lane;
      }
    }
  }
  return null;
}

function goalIndexForCol(col: number): number | null {
  for (let i = 0; i < GOAL_COLS.length; i++) {
    if (col === GOAL_COLS[i] || col === GOAL_COLS[i] + 1) return i;
  }
  return null;
}

export function createFroggerGame(
  canvas: HTMLCanvasElement,
  onGameOver: (finalScore: number) => void,
): FroggerHandle {
  const ctx = canvas.getContext("2d")!;

  const keysDown: Record<string, boolean> = {};
  let pendingDir: Direction | null = null;
  let paused = false;

  function onKeyDown(e: KeyboardEvent) {
    if (e.code === "KeyP" || e.code === "Escape") {
      paused = !paused;
      return;
    }
    const dir = DIR_KEYS[e.code];
    if (dir) {
      e.preventDefault();
      if (!keysDown[e.code]) pendingDir = dir;
    }
    keysDown[e.code] = true;
  }
  function onKeyUp(e: KeyboardEvent) {
    keysDown[e.code] = false;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  let lanes: Lane[] = [];
  let frog: Frog = {
    col: START_COL,
    row: ROW_START,
    animating: false,
    animT: 0,
    fromCol: START_COL,
    fromRow: ROW_START,
    targetCol: START_COL,
    targetRow: ROW_START,
  };
  let score = 0;
  let lives = 3;
  let level = 1;
  let goalsFilled: boolean[] = [];
  let roundTimeMs = 0;
  let roundTimeMax = 0;
  let minRowReached = ROW_START;
  let state: "playing" | "gameover" = "playing";
  let gameOverReported = false;

  function resetFrogPosition() {
    frog = {
      col: START_COL,
      row: ROW_START,
      animating: false,
      animT: 0,
      fromCol: START_COL,
      fromRow: ROW_START,
      targetCol: START_COL,
      targetRow: ROW_START,
    };
    minRowReached = ROW_START;
  }

  function killFrog() {
    lives--;
    if (lives <= 0) {
      state = "gameover";
      if (!gameOverReported) {
        gameOverReported = true;
        onGameOver(score);
      }
      return;
    }
    resetFrogPosition();
    roundTimeMs = roundTimeMax * 1000;
  }

  function completeRound() {
    score += 200;
    level++;
    lanes = buildLanes(level);
    goalsFilled = new Array(N_GOALS).fill(false);
    roundTimeMax = timeForLevel(level);
    roundTimeMs = roundTimeMax * 1000;
    resetFrogPosition();
  }

  function resolveLanding() {
    if (frog.row < minRowReached) {
      score += (minRowReached - frog.row) * 10;
      minRowReached = frog.row;
    }

    if (frog.row >= ROW_ROAD_TOP && frog.row <= ROW_ROAD_BOT) {
      if (checkRoadCollision(frog, lanes)) killFrog();
      return;
    }

    if (frog.row >= ROW_RIVER_TOP && frog.row <= ROW_RIVER_BOT) {
      if (!getSupport(frog, lanes)) killFrog();
      return;
    }

    if (frog.row === ROW_GOALS) {
      const goalIndex = goalIndexForCol(frog.col);
      if (goalIndex === null || goalsFilled[goalIndex]) {
        killFrog();
        return;
      }
      goalsFilled[goalIndex] = true;
      score += 50 + Math.floor(roundTimeMs / 1000) * 10;
      if (goalsFilled.every(Boolean)) {
        completeRound();
      } else {
        resetFrogPosition();
      }
    }
  }

  function update(dt: number) {
    if (state === "gameover" || paused) return;

    const dtSec = dt / 1000;

    for (const lane of lanes) {
      lane.offset += lane.speed * lane.dir * dtSec;
      if (lane.entities[0]?.type === "turtle") {
        lane.submergeT = (lane.submergeT ?? 0) + dt;
        lane.submerged = mod(lane.submergeT, 4500) >= 3000;
      }
    }

    if (frog.animating) {
      frog.animT += dt;
      if (frog.animT >= JUMP_MS) {
        frog.animating = false;
        frog.col = frog.targetCol;
        frog.row = frog.targetRow;
        resolveLanding();
      }
    } else if (pendingDir) {
      const delta = DIR_DELTA[pendingDir];
      pendingDir = null;
      const targetCol = frog.col + delta.dc;
      const targetRow = frog.row + delta.dr;
      if (
        targetCol >= 0 &&
        targetCol < COLS &&
        targetRow >= ROW_GOALS &&
        targetRow <= ROW_START
      ) {
        frog.animating = true;
        frog.animT = 0;
        frog.fromCol = frog.col;
        frog.fromRow = frog.row;
        frog.targetCol = targetCol;
        frog.targetRow = targetRow;
      }
    } else if (frog.row >= ROW_RIVER_TOP && frog.row <= ROW_RIVER_BOT) {
      const support = getSupport(frog, lanes);
      if (!support) {
        killFrog();
      } else {
        frog.col += support.speed * support.dir * dtSec;
        if (frog.col < -0.4 || frog.col > COLS - 0.6) killFrog();
      }
    }

    if (gameOverReported) return;

    roundTimeMs -= dt;
    if (roundTimeMs <= 0) killFrog();
  }

  function drawEntity(e: Entity, lane: Lane, x: number, y: number) {
    const w = e.width * CELL;
    const h = CELL;
    if (e.type === "car") {
      const palette = ["#ff3b3b", "#ffd23b", "#3b8bff"];
      ctx.fillStyle = palette[Math.abs(Math.round(e.baseCol)) % palette.length];
      ctx.fillRect(x + 3, y + 8, w - 6, h - 16);
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(x + 10, y + h - 8, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + w - 10, y + h - 8, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === "truck") {
      ctx.fillStyle = "#999";
      ctx.fillRect(x + 2, y + 6, w - 4, h - 12);
      ctx.fillStyle = "#555";
      ctx.fillRect(x + 2, y + 6, CELL - 6, h - 12);
    } else if (e.type === "log") {
      ctx.fillStyle = "#7a4a20";
      ctx.fillRect(x + 2, y + 10, w - 4, h - 20);
      ctx.strokeStyle = "#5c3714";
      ctx.lineWidth = 1;
      for (let lx = x + 8; lx < x + w - 6; lx += 10) {
        ctx.beginPath();
        ctx.moveTo(lx, y + 10);
        ctx.lineTo(lx, y + h - 10);
        ctx.stroke();
      }
    } else {
      ctx.globalAlpha = lane.submerged ? 0.3 : 1;
      for (let i = 0; i < e.width; i++) {
        const cx = x + i * CELL + CELL / 2;
        const cy = y + CELL / 2;
        ctx.fillStyle = "#2f8f4e";
        ctx.beginPath();
        ctx.ellipse(cx, cy, 15, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawFrog() {
    let col = frog.col;
    let row = frog.row;
    let lift = 0;
    if (frog.animating) {
      const t = Math.min(frog.animT / JUMP_MS, 1);
      col = frog.fromCol + (frog.targetCol - frog.fromCol) * t;
      row = frog.fromRow + (frog.targetRow - frog.fromRow) * t;
      lift = -Math.sin(t * Math.PI) * 6;
    }
    const x = col * CELL + CELL / 2;
    const y = row * CELL + CELL / 2 + lift;
    ctx.fillStyle = "#39ff6a";
    ctx.beginPath();
    ctx.ellipse(x, y, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x - 6, y - 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 6, y - 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(x - 6, y - 6, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 6, y - 6, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHUD() {
    ctx.fillStyle = "#fff";
    ctx.font = "15px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE  ${score}`, 10, 20);
    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${level}`, W / 2, 20);
    ctx.textAlign = "left";
    for (let i = 0; i < lives; i++) {
      ctx.fillStyle = "#39ff6a";
      ctx.beginPath();
      ctx.ellipse(W - 18 - i * 22, 12, 8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const ratio = Math.max(0, roundTimeMs / (roundTimeMax * 1000));
    ctx.fillStyle =
      ratio > 0.5 ? "#39ff6a" : ratio > 0.2 ? "#ffd23b" : "#ff3b3b";
    ctx.fillRect(0, 0, W * ratio, 4);
  }

  function draw() {
    ctx.fillStyle = "#0a3d0a";
    ctx.fillRect(0, ROW_GOALS * CELL, W, CELL);
    ctx.fillStyle = "#00294d";
    ctx.fillRect(
      0,
      ROW_RIVER_TOP * CELL,
      W,
      (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL,
    );
    ctx.fillStyle = "#0f5c1f";
    ctx.fillRect(0, ROW_SAFE_MID * CELL, W, CELL);
    ctx.fillStyle = "#111";
    ctx.fillRect(
      0,
      ROW_ROAD_TOP * CELL,
      W,
      (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL,
    );
    ctx.fillStyle = "#0f5c1f";
    ctx.fillRect(0, ROW_START * CELL, W, CELL);

    for (let i = 0; i < GOAL_COLS.length; i++) {
      const gx = GOAL_COLS[i] * CELL;
      ctx.fillStyle = goalsFilled[i] ? "#062b06" : "#134d13";
      ctx.fillRect(gx, ROW_GOALS * CELL, CELL * 2, CELL);
      ctx.strokeStyle = "#d4af37";
      ctx.lineWidth = 2;
      ctx.strokeRect(gx + 2, ROW_GOALS * CELL + 2, CELL * 2 - 4, CELL - 4);
      if (goalsFilled[i]) {
        ctx.fillStyle = "#39ff6a";
        ctx.beginPath();
        ctx.ellipse(
          gx + CELL,
          ROW_GOALS * CELL + CELL / 2,
          14,
          11,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }

    for (const lane of lanes) {
      for (const e of lane.entities) {
        const col = entityCol(lane, e);
        if (col + e.width < -1 || col > COLS + 1) continue;
        drawEntity(e, lane, col * CELL, lane.row * CELL);
      }
    }

    drawFrog();
    drawHUD();

    if (paused) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 24px monospace";
      ctx.textAlign = "center";
      ctx.fillText("PAUSA", W / 2, H / 2);
    }
  }

  let rafId: number | null = null;
  let lastTime: number | null = null;

  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  }

  function initGame() {
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    paused = false;
    gameOverReported = false;
    goalsFilled = new Array(N_GOALS).fill(false);
    lanes = buildLanes(level);
    roundTimeMax = timeForLevel(level);
    roundTimeMs = roundTimeMax * 1000;
    resetFrogPosition();
    pendingDir = null;
  }

  initGame();
  start();

  return {
    destroy() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
    restart() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      initGame();
      start();
    },
  };
}
