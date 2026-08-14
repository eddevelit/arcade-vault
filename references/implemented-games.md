# Juegos implementados — Arcade Vault

Catálogo real de juegos jugables, leído de la tabla `public.games` de Supabase.
Última actualización: 2026-08-14.

## Resumen

| #   | `id`         | Título     | Categoría | Color     | Cover CSS           | Spec                              |
| --- | ------------ | ---------- | --------- | --------- | ------------------- | --------------------------------- |
| 1   | `asteroides` | ASTEROIDES | SHOOTER   | `cyan`    | `.cover-asteroides` | [05](../specs/05-asteroides.md)   |
| 2   | `tetris`     | TETRIS     | PUZZLE    | `green`   | `.cover-tetris`     | [08](../specs/08-tetris.md)       |
| 3   | `arkanoid`   | ARKANOID   | ARCADE    | `magenta` | `.cover-arkanoid`   | [09](../specs/09-arkanoid.md)     |
| 4   | `serpiente`  | SERPIENTE  | ARCADE    | `yellow`  | `.cover-serpiente`  | [10](../specs/10-serpiente.md)    |
| 5   | `frogger`    | FROGGER    | ARCADE    | `lime`    | `.cover-frogger`    | [12](../specs/12-frogger-core.md) |

Los cinco están registrados en `lib/games/registry.ts` (`GAME_COMPONENTS`), así que `GameLauncher` monta su motor real en `/juego/<id>/jugar` en vez del reproductor simulado `GamePlayer`.

---

## 1. ASTEROIDES — `asteroides`

- **Categoría:** SHOOTER · **Color:** `cyan` · **Cover:** `.cover-asteroides` · **`sort_order`:** 1
- **Corto:** Dispara, esquiva y sobrevive entre rocas que se multiplican.
- **Largo:** Tu nave triangular flota en un campo de asteroides sin bordes: todo lo que sale por un lado reaparece del otro. Rota, propulsa y dispara para partir rocas grandes en fragmentos cada vez más pequeños, sumando puntos por cada uno. Recolecta el power-up 3x para disparo triple temporal, y aprovecha los segundos de invencibilidad al reaparecer tras perder una vida.

**Implementación**

|                 |                                                                      |
| --------------- | -------------------------------------------------------------------- |
| Motor           | `lib/games/asteroids.ts` — `createAsteroidsGame` / `AsteroidsHandle` |
| Componente      | `components/AsteroidsGame.tsx`                                       |
| Canvas          | 1 canvas de 800×600                                                  |
| Controles       | ← → rotar · ↑ propulsar · Espacio disparar                           |
| Assets externos | Ninguno (todo dibujado con vectores)                                 |
| HUD             | Dibujado en canvas                                                   |
| Pausa           | No                                                                   |

Es la **referencia canónica** del patrón: cualquier juego nuevo clona la estructura de este motor y de este componente.

---

## 2. TETRIS — `tetris`

- **Categoría:** PUZZLE · **Color:** `green` · **Cover:** `.cover-tetris` · **`sort_order`:** 2
- **Corto:** Encaja piezas, completa líneas y sube de nivel antes de que el tablero se desborde.
- **Largo:** Las piezas caen una a una sobre un tablero de diez columnas: rótalas y desplázalas para completar líneas horizontales, que desaparecen sumando puntos según cuántas limpies de una sola vez. La velocidad de caída aumenta con cada nivel, y una vista previa te muestra siempre la próxima pieza para planificar tu siguiente movimiento. Pausa la partida en cualquier momento para tomar aire antes de que el ritmo se vuelva imposible.

**Implementación**

|                 |                                                                             |
| --------------- | --------------------------------------------------------------------------- |
| Motor           | `lib/games/tetris.ts` — `createTetrisGame` / `TetrisHandle`                 |
| Componente      | `components/TetrisGame.tsx`                                                 |
| Canvas          | 2 canvas: tablero 300×600 + preview de siguiente pieza 120×120              |
| Controles       | ← → mover · ↓ caída rápida · ↑ rotar · Espacio caída instantánea · P pausar |
| Assets externos | Ninguno                                                                     |
| HUD             | Dibujado en canvas                                                          |
| Pausa           | Sí (P)                                                                      |

Este spec introdujo `lib/games/registry.ts`, reemplazando el `if (game.id === "asteroides")` hardcodeado del dispatcher.

---

## 3. ARKANOID — `arkanoid`

- **Categoría:** ARCADE · **Color:** `magenta` · **Cover:** `.cover-arkanoid` · **`sort_order`:** 3
- **Corto:** Rebota la pelota, rompe bloques y despeja los cinco niveles antes de perder tus tres vidas.
- **Largo:** Controlá la paleta con el mouse o las flechas para mantener la pelota en juego: cada bloque que rompés suma puntos y libera una pequeña explosión de color. Despejá el tablero completo para avanzar de nivel, con la velocidad de la pelota subiendo un poco en cada uno de los cinco niveles disponibles. Perdés una vida cada vez que la pelota cae por debajo de la paleta, y la partida termina al perder las tres o al completar el último nivel. Pausá en cualquier momento con P o Escape.

**Implementación**

|                 |                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| Motor           | `lib/games/arkanoid.ts` — `createArkanoidGame` / `ArkanoidHandle` (+ `lib/games/arkanoid-sprites.ts`) |
| Componente      | `components/ArkanoidGame.tsx`                                                                         |
| Canvas          | 1 canvas de 800×600                                                                                   |
| Controles       | Mouse (`mousemove`) o ← → mover paleta · P / Escape pausar                                            |
| Assets externos | `public/games/arkanoid/spritesheet-breakout.png` (paleta, pelota, bloques, explosiones)               |
| HUD             | Dibujado en canvas                                                                                    |
| Pausa           | Sí (P / Escape)                                                                                       |

Único juego con **carga asíncrona de assets**: el loop no arranca hasta que el spritesheet cargó, y `destroy()` debe poder cancelar limpio aunque se llame antes.

---

## 4. SERPIENTE — `serpiente`

- **Categoría:** ARCADE · **Color:** `yellow` · **Cover:** `.cover-serpiente` · **`sort_order`:** 4
- **Corto:** Guiá una serpiente que crece con cada fruta, sin chocar contra las paredes ni contra tu propia cola.
- **Largo:** Controlá una serpiente que se desliza sobre una grilla, cambiando de dirección con las flechas para alcanzar la fruta y sumar puntos. Cada fruta comida suma un segmento a tu cuerpo y acelera un poco el ritmo de la partida, haciendo cada vez más difícil esquivarte a vos mismo. La partida termina en cuanto la cabeza toca el borde del tablero o cualquier parte de tu propio cuerpo — cuanto más larga la serpiente, mayor el desafío.

**Implementación**

|                 |                                                                       |
| --------------- | --------------------------------------------------------------------- |
| Motor           | `lib/games/serpiente.ts` — `createSerpienteGame` / `SerpienteHandle`  |
| Componente      | `components/SerpienteGame.tsx`                                        |
| Canvas          | 1 canvas de 800×600                                                   |
| Controles       | ← → ↑ ↓ cambiar dirección                                             |
| Assets externos | `public/games/serpiente/fruits.png` (spritesheet, solo para la fruta) |
| HUD             | Dibujado en canvas                                                    |
| Pausa           | No                                                                    |

Único juego **diseñado desde cero**: no hubo `game.js` de referencia, solo el spritesheet de frutas.

---

## 5. FROGGER — `frogger`

- **Categoría:** ARCADE · **Color:** `lime` · **Cover:** `.cover-frogger` · **`sort_order`:** 5
- **Corto:** Cruza la carretera y el río sin convertirte en papilla.
- **Largo:** Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.

**Implementación**

|                 |                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Motor           | `lib/games/frogger.ts` — `createFroggerGame(canvas, onGameOver, skin?)` / `FroggerHandle` (`destroy` / `restart` / `setSkin`) |
| Componente      | `components/FroggerGame.tsx`                                                                                                  |
| Canvas          | 1 canvas de 640×560 (grilla 16×14 de 40px), `.crt-screen` con `aspect-ratio: 8 / 7` propio (no el 4/3 compartido)             |
| Controles       | ← → ↑ ↓ saltar (celda a celda) · P / Escape pausar · táctil: `TouchControls` (D-pad + botón PAUSA → `KeyP`)                   |
| Assets externos | Ninguno (todo dibujado con primitivas canvas)                                                                                 |
| HUD             | Dibujado en canvas (score, nivel, vidas, barra de tiempo de ronda)                                                            |
| Pausa           | Sí (P / Escape)                                                                                                               |
| Skins           | `clasico` (default) · `neon` · `retro` — selector en el componente, preferencia en `localStorage` bajo `av_skin_frogger`      |
| Mobile          | Verificado 2026-08-14 en 375×667 · 430×932 · 768×1024 (táctil) y 1440×900 (control, sin touch) — ver nota abajo               |

**Estado mobile (2026-08-14).** `/juego/frogger` y `/juego/frogger/jugar` verificados con Playwright en los cuatro perfiles, portrait. Se corrigieron dos cosas en `components/FroggerGame.tsx`: el `.crt-screen` no declaraba relación de aspecto propia y estiraba el tablero un 17% a lo ancho (4/3 heredado vs 8/7 real del canvas) — ahora usa `aspectRatio: "8 / 7"` inline, mismo patrón que Tetris con su `1 / 2`, con un tope de `maxWidth: 900` en el `.crt` para que al desestirarse no crezca de alto en desktop; y no montaba `TouchControls`, así que en táctil el juego era injugable — ahora monta `<TouchControls accent="green" actions={[{ id: "pause", label: "PAUSA", code: "KeyP" }]} />` según spec 11 (D-pad = flechas, `KeyP` es la tecla real del motor). El `accent` es `green` y no `lime` (el `color` del juego) porque la union de `TouchControls` no contempla `lime`; queda como pendiente de alcance compartido. El teclado físico sigue funcionando en paralelo en los perfiles táctiles, y `destroy()` no cambió (no se tocó `lib/games/frogger.ts`).

`color: 'lime'` requirió ampliar el `CHECK` de `games.color` (antes sólo cyan/magenta/yellow/green) vía `apply_migration`, y agregar el token `--lime` en `app/globals.css` junto a los demás colores del tema. El spec original (`specs/game-jam/frogger/01-frogger-core.md`, movido a `specs/12-frogger-core.md`) describía props `paused/onScoreChange/onLivesChange/onLevelChange/onGameOver` y una play-page dedicada (`app/games/frogger/play/page.tsx`); se implementó en cambio siguiendo el patrón real de los otros cuatro juegos — `{ game }` + `create<Nombre>Game(canvas, onGameOver) → {destroy, restart}` + HUD sólo en canvas + ruta genérica `/juego/frogger/jugar` vía registry — por ser el patrón efectivamente vigente en el repo.

---

## Estado del leaderboard

Puntuaciones reales en la tabla `scores` (FK `scores.game_id → games.id`), al 2026-08-14:

| `id`         | Partidas guardadas | Jugadores distintos | Mejor puntuación real |
| ------------ | -----------------: | ------------------: | --------------------: |
| `asteroides` |                  2 |                   2 |                18 030 |
| `tetris`     |                  2 |                   2 |                 1 060 |
| `arkanoid`   |                  2 |                   2 |                   650 |
| `serpiente`  |                  1 |                   1 |                   100 |
| `frogger`    |                  2 |                   2 |                   100 |

Son datos de prueba de la verificación end-to-end de cada spec, no tráfico real.

### Nota sobre las columnas `best` y `plays`

`games.best` y `games.plays` son **decorativas** y no se sincronizan con `scores`:

| `id`         | `games.best` | `games.plays` |
| ------------ | -----------: | ------------: |
| `asteroides` |            0 |         `"0"` |
| `tetris`     |       45 200 |      `"7.4K"` |
| `arkanoid`   |       38 900 |      `"6.1K"` |
| `serpiente`  |        4 200 |      `"7.5K"` |
| `frogger`    |            0 |         `"0"` |

Dónde se usa cada una:

- `GameCard` (home, biblioteca, salón de la fama) muestra `game.best` — o sea, el valor **decorativo** de la tabla.
- `/juego/[id]` muestra `getGameStats()` — partidas y mejor puntuación **reales** calculadas desde `scores`.

Por eso ASTEROIDES aparece con `0` en las tarjetas pese a tener la mejor puntuación real del catálogo: su fila se insertó con valores en cero y las demás con valores inventados.

---

## Cómo agregar un juego nuevo

Usá el skill `/nuevo-juego` (`.claude/skills/nuevo-juego/SKILL.md`), que genera el spec cubriendo los seis puntos de integración: motor → componente → entrada en el registry → fila en `games` → cover CSS → leaderboard (automático por el FK, no requiere código). Después `/spec-impl NN-<slug>` lo implementa.

Los 8 juegos del array `GAMES` en `lib/data.ts` (BLOQUE BUSTER, CAÍDA, SERPENTINA, GLOTÓN, INVASORES, ROCAS, RANARIA, DUELO PIXEL) son **maquetas del MVP visual sin consumidores** — no están en Supabase, no son alcanzables y no deben confundirse con los cinco juegos de arriba.
