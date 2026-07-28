# Spec 08 — Tetris (juego real)

- **Estado:** Aprobado
- **Dependencias:** Spec 05 — Asteroides (juego real) (usa como referencia canónica el patrón `create<Nombre>Game`/`<Nombre>Handle` y el componente clon de `AsteroidsGame.tsx`). Spec 06 — Tabla de juegos en Supabase (la tabla `games` ya existe; este spec solo agrega una fila nueva). Spec 07 — Leaderboard real (`lib/scores.ts`/`lib/scores-client.ts` ya son genéricos por `game_id`; no se modifican). Modifica `app/juego/[id]/jugar/page.tsx`: introduce `lib/games/registry.ts` (nuevo), reemplazando el `if (game.id === "asteroides")` hardcodeado — Asteroides pasa a ser la primera entrada del registry, sin cambio de comportamiento visible.
- **Fecha:** 2026-07-28
- **Objetivo:** Agregar "Tetris" como segundo juego jugable real del catálogo, portando el motor de `references/ClaudeCodeCourseGames/03-tetris/game.js` (tablero + preview de siguiente pieza, HUD y pausa dibujados en canvas) a un componente cliente de Next.js, e introducir un registry de juegos que reemplaza el dispatcher hardcodeado para escalar a múltiples juegos reales.

## Alcance

**Incluye:**

- Nueva fila en la tabla `games` (Supabase) para el juego: `id: "tetris"`, `title: "TETRIS"`, categoría `PUZZLE`, `cover: "cover-tetris"`, `color: "green"`, con `short`/`long` de copy nuevo (en español) fiel al gameplay real (piezas que caen y rotan, líneas que se completan y desaparecen, velocidad que aumenta por nivel — sin mencionar power-ups ni nada que el juego no tenga), `sort_order` siguiente al de Asteroides.
- Integración completa al catálogo, igual que Asteroides: aparece en la grilla de biblioteca (`/`) con su `GameCard`, tiene página de detalle (`/juego/tetris`) con leaderboard real (`getTopScores`), y botón "JUGAR AHORA" que navega a `/juego/tetris/jugar`.
- Nueva clase CSS `.cover-tetris` en `globals.css`: grid de bloques de colores con acento `--green`, siguiendo el patrón `::after`/`::before` de los covers existentes, distinta de `.cover-rocas` y `.cover-asteroides`.
- Puerto del motor de juego (`game.js`, `references/ClaudeCodeCourseGames/03-tetris/`) a un módulo TypeScript encapsulado — `lib/games/tetris.ts`, factory `createTetrisGame(boardCanvas, nextCanvas, onGameOver): TetrisHandle` con `{ destroy, restart, togglePause }` (sin variables globales de módulo ni auto-arranque).
- HUD (SCORE/LINES/LEVEL) y el mensaje de PAUSA dibujados en el canvas del tablero (`ctx.fillText`), igual criterio que Asteroides — no se usa la barra `.player-hud` de React. El preview de la siguiente pieza se dibuja en su propio `<canvas>` (120×120), igual que el original.
- Nuevo componente `components/TetrisGame.tsx`, clon de `AsteroidsGame.tsx` (mismos hooks/estados/modal de fin de partida), que monta ambos canvas y llama a `createTetrisGame`.
- **Introducción de `lib/games/registry.ts`** (`GAME_COMPONENTS: Record<string, ComponentType<{ game: Game }>>`, componentes cargados vía `next/dynamic` con `ssr: false`), con entradas para `asteroides` y `tetris`. Refactor de `app/juego/[id]/jugar/page.tsx` para resolver `GAME_COMPONENTS[game.id] ?? GamePlayer`, reemplazando el `if` hardcodeado — sin cambio de comportamiento visible para Asteroides.
- Controles de teclado (`←` `→` mover, `↑`/`X` rotar, `↓` soft drop, `Espacio` hard drop, `P` pausa/reanudar) con `preventDefault` en las teclas usadas por el juego.
- Al llegar a `gameOver`, se detiene el loop y se muestra el modal existente (`.modal-bd`/`.modal`, mismo componente visual que usan los demás juegos) con input de iniciales y botón "GUARDAR PUNTUACIÓN", que persiste el resultado con `saveScore({ game: "tetris", score, name })` (`lib/scores-client.ts`); "JUGAR DE NUEVO" llama `restart()` y "VOLVER AL VAULT" navega a `/biblioteca`.
- Botón mínimo fuera del CRT para volver a la biblioteca sin terminar la partida (mismo patrón que Asteroides).
- Limpieza correcta de listeners de teclado y `requestAnimationFrame` al desmontar el componente (`destroy()`), para no dejar loops o listeners huérfanos.
- El leaderboard de `/juego/tetris` y `/salon-de-la-fama` funciona automáticamente en cuanto existe la fila en `games` — **no se modifica** `lib/scores.ts` ni `lib/scores-client.ts`.

**No incluye:**

- Cambios a Asteroides más allá del refactor mecánico de moverlo al registry (mismo comportamiento visible).
- El toggle de tema claro/oscuro del original (`localStorage: tetris-theme`) — Arcade Vault ya tiene su tema CRT fijo, no aplica.
- Sonido/audio, soporte táctil/mobile para los controles, o remapeo de teclas.
- Mejoras a la lógica de rotación/wall-kicks respecto al original — se porta tal cual (`rotateCW` + kicks `[0,±1,±2]`), sin ampliarla ni simplificarla.
- Sincronizar `best`/`plays` del catálogo con puntuaciones reales — quedan como valores decorativos fijos, igual que Asteroides.
- Rediseño visual del CRT/marco del reproductor — se reutiliza tal cual (`.crt`, `.crt-screen`, `.crt-bottom`).
- Persistencia en Supabase del leaderboard — ya existe y es genérica (spec 07); este spec no la toca.

## Modelo de datos

**Nueva fila en la tabla `games` (Supabase, vía `mcp_supabase apply_migration`):**

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, sort_order) values
('tetris', 'TETRIS', 'Encaja piezas, completa líneas y sube de nivel antes de que el tablero se desborde.', 'Las piezas caen una a una sobre un tablero de diez columnas: rótalas y desplázalas para completar líneas horizontales, que desaparecen sumando puntos según cuántas limpies de una sola vez. La velocidad de caída aumenta con cada nivel, y una vista previa te muestra siempre la próxima pieza para planificar tu siguiente movimiento. Pausa la partida en cualquier momento para tomar aire antes de que el ritmo se vuelva imposible.', 'PUZZLE', 'cover-tetris', 'green', 45200, '7.4K', 2)
on conflict (id) do nothing;
```

No se agregan columnas nuevas a `games` — usa el mismo esquema que introdujo el spec 06.

**Motor portado — `lib/games/tetris.ts`:**

```ts
export interface TetrisHandle {
  destroy: () => void; // cancela el RAF y remueve los listeners de teclado
  restart: () => void; // reinicia el estado interno (equivalente a init()) y reanuda el loop
  togglePause: () => void; // alterna paused; dibuja/oculta "PAUSA" en el canvas del tablero
}

export function createTetrisGame(
  boardCanvas: HTMLCanvasElement,
  nextCanvas: HTMLCanvasElement,
  onGameOver: (finalScore: number) => void,
): TetrisHandle;
```

Encapsula en el closure de `createTetrisGame` todo lo que hoy son variables globales de módulo en `game.js` (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.). Cuando `gameOver` pasa a `true`, el loop deja de pedir el próximo `requestAnimationFrame` y se invoca `onGameOver(score)` **una sola vez**; el reinicio deja de ser por el botón `#restart-btn` del original y pasa a ser explícito vía `restart()`. La pausa (`P` en el teclado) se preserva y pasa a controlarse tanto por teclado como por `togglePause()` desde el handle.

**Componente — `components/TetrisGame.tsx`:**

```tsx
"use client";
interface TetrisGameProps {
  game: Game; // la entrada "tetris" de Supabase
}
export default function TetrisGame({ game }: TetrisGameProps): JSX.Element;
```

Monta `createTetrisGame` sobre dos `<canvas>` propios (tablero 300×600 y preview 120×120) en `useEffect` (llamando `destroy()` en el cleanup), y reutiliza el mismo patrón de estado local que `AsteroidsGame.tsx` para el modal de fin de partida (`over`, `nameOverride`, `saved`, `saving`, `saveError`) y `saveScore` de `lib/scores-client.ts`.

**Registry — `lib/games/registry.ts` (nuevo):**

```ts
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { Game } from "@/lib/data";

export const GAME_COMPONENTS: Record<string, ComponentType<{ game: Game }>> = {
  asteroides: dynamic(() => import("@/components/AsteroidsGame"), {
    ssr: false,
  }),
  tetris: dynamic(() => import("@/components/TetrisGame"), { ssr: false }),
};
```

`app/juego/[id]/jugar/page.tsx` pasa a resolver `const Component = GAME_COMPONENTS[game.id] ?? GamePlayer; return <Component game={game} />;`, reemplazando el `if (game.id === "asteroides")` actual.

## Plan de implementación

1. **Motor del juego** — Crear `lib/games/tetris.ts` portando `game.js` (`references/ClaudeCodeCourseGames/03-tetris/game.js`): el estado (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `dropAccum`, `lastTime`, `animId`) pasa al closure de `createTetrisGame(boardCanvas, nextCanvas, onGameOver)`, reemplazando `document.getElementById('board')`/`('next-canvas')` por los canvas recibidos como parámetros. El HUD (`updateHUD()`, que hoy hace `textContent` sobre `#score`/`#lines`/`#level`) se reemplaza por texto dibujado en el canvas del tablero (`ctx.fillText`), mismo criterio que `drawHUD()` de `asteroids.ts`. `togglePause()` (que hoy muestra el overlay HTML compartido `#overlay`) pasa a dibujar "PAUSA" sobre el canvas del tablero y se expone como `togglePause()` en el handle. Se agrega `preventDefault()` en el `keydown` de `ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown`/`Space`/`KeyX`/`KeyP`. `endGame()` invoca `onGameOver(score)` una sola vez y detiene el loop. Se expone `{ destroy, restart, togglePause }`.

2. **Componente `TetrisGame`** — Crear `components/TetrisGame.tsx`: monta ambos `<canvas>` (tablero 300×600 dentro del marco `.crt`/`.crt-screen`/`.crt-bottom`, preview 120×120 en un panel lateral propio del componente) llama a `createTetrisGame` en `useEffect` con `destroy()` en el cleanup, agrega un botón mínimo "VOLVER AL VAULT" fuera del CRT, y reutiliza el markup del modal de fin de partida (`.modal-bd`/`.modal`, input de iniciales, `saveScore`) que ya existe en `AsteroidsGame.tsx`, disparado por el callback `onGameOver`.

3. **Registry** — Crear `lib/games/registry.ts` con `GAME_COMPONENTS` mapeando `asteroides` y `tetris` a sus componentes vía `next/dynamic` (`ssr: false`). Refactorizar `app/juego/[id]/jugar/page.tsx` para resolver el componente desde el registry (`GAME_COMPONENTS[game.id] ?? GamePlayer`) en vez del `if` hardcodeado. Verificar que Asteroides sigue funcionando igual tras el refactor.

4. **Catálogo** — Insertar la fila `tetris` en la tabla `games` de Supabase vía `mcp_supabase apply_migration`, con los valores definidos en el modelo de datos. Verificar con `list_tables`/`execute_sql` que la tabla ahora tiene 2 filas.

5. **Cover art** — Crear `.cover-tetris` en `globals.css`: grid de bloques de colores con acento `--green`, siguiendo el patrón de las `.cover-*` existentes (gradiente base + capas decorativas `::after`/`::before`), visualmente distinto de `.cover-rocas` y `.cover-asteroides`.

6. **Leaderboard** — Sin implementación propia: al existir la fila del paso 4, `/juego/tetris` y `/salon-de-la-fama` muestran el leaderboard real automáticamente vía `getTopScores`/`getAllTopScores`/`saveScore`, ya genéricos por `game_id` (spec 07). Este paso es solo de verificación.

7. **Verificación end-to-end** — Recorrer `/` (aparece la card TETRIS), `/juego/tetris` (detalle + leaderboard real, vacío al inicio), `/juego/tetris/jugar` (mover, rotar, soft drop, hard drop, pausar/reanudar con `P`, completar líneas, subir de nivel, ver el preview de la siguiente pieza); confirmar que al llenarse el tablero se detiene el juego y aparece el modal con la puntuación final; guardar con iniciales y confirmar que aparece en el leaderboard real de `/juego/tetris` y `/salon-de-la-fama`; salir a mitad de partida y volver a entrar, confirmando que no queda ningún loop ni listener duplicado; confirmar que `/juego/asteroides` y `/juego/asteroides/jugar` siguen funcionando igual tras el refactor del registry; correr `npm run build` y `npm run lint`.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores.
- [ ] `npm run lint` no reporta errores.
- [ ] `/` muestra la card "TETRIS" en la grilla de biblioteca, con su propio cover art (`.cover-tetris`, visualmente distinto de `.cover-rocas` y `.cover-asteroides`).
- [ ] `/juego/tetris` muestra la página de detalle estándar (tags, descripción, stat-strip, leaderboard real vía `getTopScores`), igual que Asteroides.
- [ ] Botón "JUGAR AHORA" en el detalle navega a `/juego/tetris/jugar`.
- [ ] `/juego/tetris/jugar` muestra el juego real corriendo en el canvas del tablero dentro del marco CRT existente, con su propio HUD (SCORE, LINES, LEVEL) dibujado en pantalla, y un canvas de preview mostrando la siguiente pieza.
- [ ] Los controles funcionan: `←`/`→` mueven la pieza, `↑`/`X` rotan, `↓` hace soft drop sumando puntos, `Espacio` hace hard drop; ninguna de estas teclas hace scroll de la página.
- [ ] Completar una o más líneas las elimina del tablero, suma puntos según `LINE_SCORES × nivel`, y el nivel sube cada 10 líneas acumuladas (aumentando la velocidad de caída).
- [ ] Presionar `P` pausa la partida (el loop deja de avanzar, aparece "PAUSA" dibujado en el canvas) y volver a presionar `P` la reanuda.
- [ ] Que una pieza nueva colisione al aparecer (tablero lleno) detiene el juego y aparece el modal de fin de partida con la puntuación final.
- [ ] Guardar la puntuación en el modal la persiste en Supabase (tabla `scores`, `game_id: "tetris"`) y aparece en el leaderboard real de `/juego/tetris` y en el tab correspondiente de `/salon-de-la-fama`.
- [ ] "JUGAR DE NUEVO" reinicia el motor desde cero (puntuación 0, tablero vacío, nivel 1) sin recargar la página.
- [ ] El botón "VOLVER AL VAULT" navega a `/biblioteca` en cualquier momento de la partida (jugando, pausado o en el modal de fin de partida).
- [ ] Salir de `/juego/tetris/jugar` a mitad de partida y volver a entrar no deja loops ni listeners de teclado duplicados.
- [ ] `/juego/asteroides` y `/juego/asteroides/jugar` siguen funcionando exactamente igual después del refactor del registry (`lib/games/registry.ts`).
- [ ] `lib/scores.ts` y `lib/scores-client.ts` no cambian — el leaderboard de Tetris funciona sin tocarlos.

## Decisiones tomadas y descartadas

- **Segundo juego real, extendiendo el patrón de Asteroides, no un caso especial (tomada).** Tetris reusa el mismo contrato (`create<Nombre>Game`/`<Nombre>Handle`, componente clon con el mismo modal de fin de partida) que dejó establecido el spec 05. _Descartada:_ diseñar un flujo de integración distinto para Tetris "porque es diferente" (2 canvas, pausa) — la variabilidad se absorbe dentro del mismo patrón, no inventando uno nuevo.

- **Categoría `PUZZLE` (tomada).** Encaje de piezas y líneas, sin combate ni disparo — la categoría que mejor describe el gameplay real. _Descartada:_ `ARCADE`, demasiado genérica habiendo una categoría más precisa disponible.

- **Color `green` (tomada).** Asteroides ya usa `cyan`; un acento distinto evita que las dos cards reales se confundan visualmente en la grilla. _Descartada:_ `magenta`/`yellow`, disponibles pero sin preferencia particular sobre `green`.

- **HUD (SCORE/LINES/LEVEL) dibujado en el canvas del tablero, no expuesto a React (tomada).** Mismo criterio que Asteroides: cambio mínimo sobre el motor original, consistente con el único juego real que ya existe en el catálogo. _Descartada:_ exponer el estado como props/hooks de React y reusar markup HTML tipo panel lateral (más fiel al `index.html` original), que introduce un patrón de HUD distinto del ya establecido sin un beneficio claro.

- **Pausa real preservada, con tecla `P` (tomada).** El original de Tetris sí tiene esa mecánica; omitirla sería una regresión de gameplay real respecto a la referencia, a diferencia de Asteroides (que nunca la tuvo). _Descartada:_ omitir la pausa por "consistencia" con Asteroides — ese motor nunca tuvo pausa que preservar, así que no aplica el mismo razonamiento aquí.

- **Mensaje de "PAUSA" dibujado en el canvas del tablero, no un overlay HTML de React (tomada).** Consistente con la decisión de HUD en canvas: todo el feedback de estado del juego (HUD + pausa + fin de partida congelado) vive en el mismo lugar. _Descartada:_ un `<div>` de overlay propio del componente, que hubiera introducido una segunda superficie de "mensaje de estado" además del canvas y del modal de React.

- **Se mantienen los 2 canvas del original (tablero 300×600 + preview 120×120) (tomada).** Fiel al diseño original, cambio mínimo de estructura. _Descartada:_ fusionar todo en un solo canvas dibujando el preview como parte del HUD, que hubiera sido más simple de montar pero se aleja más del original sin necesidad.

- **Slug `tetris` tal cual, sin traducir (tomada).** "Tetris" es un nombre propio ya usado como tal en español (no se traduce), consistente con la decisión del spec 05 de mantener el catálogo en español sin que esto implique forzar una traducción de un nombre propio. _Descartada:_ `bloques`, alternativa genérica sin necesidad real de evitar el nombre original.

- **Cover art con concepto fijado en este spec (grid de bloques de colores) (tomada).** Da una dirección visual clara y verificable como criterio de aceptación, en vez de dejarlo abierto. _Descartada:_ dejar la dirección visual sin definir para decidirla durante `/spec-impl` (posiblemente con `/frontend-design`), que hubiera sido más flexible pero menos verificable en este spec.

- **Introducción de `lib/games/registry.ts` en este mismo spec (tomada).** Es el primer juego nuevo desde Asteroides — el momento correcto de pagar el refactor del dispatcher (`if` hardcodeado → registry) una sola vez, antes de que un tercer juego real obligue a elegir entre seguir apilando `if`s o refactorizar bajo presión. _Descartada:_ agregar otro `if (game.id === "tetris")` y posponer el refactor a un spec futuro — hubiera sido más rápido ahora pero acumula la misma deuda que este spec ya está en posición de resolver.

- **Toggle de tema claro/oscuro del original, descartado (tomada).** Arcade Vault ya tiene un tema CRT fijo; el toggle no tiene un lugar coherente dentro de esa estética. _Descartada:_ portarlo igual "porque estaba en el original" — no aporta nada dentro del marco visual ya establecido por el resto del catálogo.

- **Sin cambios a `lib/scores.ts`/`lib/scores-client.ts` (tomada).** Ya son genéricos por `game_id` desde el spec 07; agregar la fila en `games` basta para que el leaderboard de Tetris funcione. _Descartada:_ escribir código específico de Tetris en esos módulos "para asegurarse", que reintroduciría acoplamiento que el spec 07 ya eliminó deliberadamente.

## Riesgos identificados

- **Listeners de teclado y `requestAnimationFrame` no limpiados al desmontar.** Igual que en el spec 05: si `createTetrisGame` no limpia correctamente al navegar fuera de `/juego/tetris/jugar` (router SPA de Next.js, sin recarga completa), quedarían loops e inputs duplicados al volver a entrar. _Mitigación:_ `destroy()` debe remover explícitamente el listener de `keydown` y cancelar el frame pendiente (`cancelAnimationFrame`), invocado desde el cleanup del `useEffect`; se verifica en el paso 7 del plan y en el criterio de aceptación correspondiente.

- **Mensaje "PAUSA" dibujado en canvas visible detrás del modal de fin de partida.** El spec 05 encontró este mismo tipo de problema con el overlay nativo "GAME OVER" de Asteroides (texto congelado detrás del modal, con backdrop 70% opaco) y lo resolvió eliminando ese dibujo. _Mitigación:_ el motor no debe dibujar ningún mensaje de "GAME OVER" propio en el canvas (el modal de React es la única fuente de ese mensaje, igual que en Asteroides); la pausa nunca puede activarse con `gameOver === true` (el original ya lo bloquea con `if (gameOver) return;` en `togglePause()`), así que ambos mensajes no deberían solaparse — se verifica visualmente en el paso 7.

- **Layout de dos canvas dentro de un marco CRT pensado para uno solo.** `.crt-screen` tiene `aspect-ratio: 4/3` fijo pensado para el tablero de Asteroides; sumar el canvas de preview (120×120) sin rediseñar el marco puede quedar visualmente apretado o desbordado. _Mitigación:_ el preview se ubica fuera de `.crt-screen` (en un panel propio del componente, junto al botón "VOLVER AL VAULT"), sin modificar las clases `.crt`/`.crt-screen`/`.crt-bottom` existentes; se ajusta el layout durante la implementación y se verifica visualmente en el paso 7.

- **Refactor del registry rompe el comportamiento de Asteroides.** Mover `app/juego/[id]/jugar/page.tsx` de un `if` hardcodeado a `lib/games/registry.ts` es un cambio mecánico pero toca la ruta que hoy funciona en producción para el único juego real existente. _Mitigación:_ el paso 3 del plan exige verificar explícitamente que `/juego/asteroides`/`/juego/asteroides/jugar` siguen funcionando igual tras el refactor, antes de dar por completo el spec; hay un criterio de aceptación dedicado a esto.

- **`next/dynamic` con `ssr: false` cambia cómo se carga el componente del juego respecto al import directo actual.** Si `AsteroidsGame` se importaba de forma estática antes del registry, pasar a carga diferida vía `next/dynamic` puede introducir un estado de carga/flicker que no existía. _Mitigación:_ verificar visualmente en el paso 7 que no hay parpadeo ni pantalla en blanco perceptible al entrar a `/juego/asteroides/jugar` o `/juego/tetris/jugar`; si aparece, es aceptable como comportamiento conocido de code-splitting (no se agrega un spinner dedicado en este spec salvo que sea muy notorio).

- **Drift de comportamiento al portar `dropInterval`, wall-kicks y scoring de script global a closure.** Mover el estado del juego al closure de `createTetrisGame` es un refactor mecánico pero no trivial; un error de scope podría alterar sutilmente el timing de caída o el puntaje. _Mitigación:_ portar función por función sin reescribir lógica de juego, y comparar el comportamiento contra `references/ClaudeCodeCourseGames/03-tetris/index.html` abierto en paralelo durante la verificación del paso 7.

- **Particularidades de esta versión de Next.js (16.2.10) con `next/dynamic`, `ssr: false` y múltiples `<canvas>` en un Client Component.** `AGENTS.md` advierte que esta versión tiene diferencias respecto a versiones previas/training data. _Mitigación:_ si surge algún comportamiento inesperado con la carga diferida del registry o con el montaje de los dos canvas, revisar `node_modules/next/dist/docs/01-app/` antes de improvisar una solución.
