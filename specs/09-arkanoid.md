# Spec 09 — Arkanoid (juego real)

- **Estado:** APROBADO
- **Dependencias:** Spec 05 — Asteroides (patrón canónico `create<Nombre>Game`/`<Nombre>Handle` y componente clon). Spec 06 — Tabla de juegos en Supabase (la tabla `games` ya existe; este spec solo agrega una fila). Spec 07 — Leaderboard real (`lib/scores.ts`/`lib/scores-client.ts` ya son genéricos por `game_id`; no se modifican). Spec 08 — Tetris (introdujo `lib/games/registry.ts`; este spec solo agrega una entrada nueva, sin tocar el dispatcher de `app/juego/[id]/jugar/page.tsx` de nuevo).
- **Fecha:** 2026-07-28
- **Objetivo:** Agregar "Arkanoid" como tercer juego jugable real del catálogo, portando el motor de `references/ClaudeCodeCourseGames/04-arkanoid/game.js` (paleta/pelota con sprites, 5 niveles de bloques, control por mouse y teclado, pausa real) a un componente cliente de Next.js, agregando una entrada nueva al registry ya existente.

## Alcance

**Incluye:**

- Nueva fila en la tabla `games` (Supabase) para el juego: `id: "arkanoid"`, `title: "ARKANOID"`, categoría `ARCADE`, `cover: "cover-arkanoid"`, `color: "magenta"`, con `short`/`long` de copy nuevo (en español) fiel al gameplay real (paleta que sigue el mouse/teclado, pelota que rebota, bloques de colores que se rompen, 5 niveles con velocidad creciente — sin mencionar sonido ni power-ups, que el juego no tiene), `sort_order` siguiente al de Tetris.
- Integración completa al catálogo, igual que Asteroides y Tetris: aparece en la grilla de biblioteca (`/`) con su `GameCard`, tiene página de detalle (`/juego/arkanoid`) con leaderboard real (`getTopScores`), y botón "JUGAR AHORA" que navega a `/juego/arkanoid/jugar`.
- Nueva clase CSS `.cover-arkanoid` en `globals.css`: silueta de paleta + pelota + una fila de bloques de colores, acento `magenta`, siguiendo el patrón `::after`/`::before` de los covers existentes, distinta de `.cover-rocas`/`.cover-asteroides`/`.cover-tetris`.
- Puerto de los assets visuales del juego (`assets/spritesheet.js`, `assets/spritesheet-breakout.png`) a `public/games/arkanoid/`, referenciados por ruta absoluta; el helper de dibujo (`loadSpritesheet`, `drawSprite`, `drawFrame`, `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`) se porta a un módulo TypeScript propio.
- Puerto de `levels.js` (5 niveles, `LEVELS` con `blocks[]` y `speed`) como datos dentro de `lib/games/arkanoid.ts`, sin cambios de contenido respecto al original.
- Puerto del motor de juego (`game.js`) a un módulo TypeScript encapsulado — `lib/games/arkanoid.ts`, factory `createArkanoidGame(canvas, onGameOver): ArkanoidHandle` con `{ destroy, restart, togglePause }` (sin variables globales de módulo ni auto-arranque). El arranque es asíncrono (el loop no arranca hasta que el spritesheet terminó de cargar), y `destroy()` puede llamarse limpio aunque se invoque antes de que la carga termine (cancela el arranque pendiente).
- HUD (Score/Nivel/vidas) dibujado en el canvas (`ctx.fillText`), igual criterio que Asteroides/Tetris — no se usa la barra `.player-hud` de React.
- Pausa real preservada (tecla `P`/`Escape`), mostrando "PAUSA" dibujado en el canvas (mismo criterio que Tetris). El menú de clic para saltar directo a cualquiera de los 5 niveles **no se porta** — es una función de debug/testing del original, no gameplay real.
- Controles de paleta por mouse (`mousemove` sobre el canvas) y teclado (`←`/`→`), ambos activos simultáneamente, igual que el original. `preventDefault()` en `ArrowLeft`/`ArrowRight`/`P`/`Escape`.
- Nuevo componente `components/ArkanoidGame.tsx`, clon de `AsteroidsGame.tsx`/`TetrisGame.tsx` (mismos hooks/estados/modal de fin de partida), que monta el canvas y llama a `createArkanoidGame`.
- **Entrada nueva en `lib/games/registry.ts`** (ya existe desde el spec 08): se agrega `arkanoid: dynamic(() => import("@/components/ArkanoidGame"), { ssr: false })` al mapa `GAME_COMPONENTS`, sin tocar `app/juego/[id]/jugar/page.tsx` (el dispatcher por registry ya existe).
- Tanto llegar a `gameState === 'gameover'` (perder las 3 vidas) como a `gameState === 'win'` (completar los 5 niveles) detienen el loop e invocan `onGameOver(score)` una sola vez, mostrando el modal existente (`.modal-bd`/`.modal`) con input de iniciales y botón "GUARDAR PUNTUACIÓN", que persiste el resultado con `saveScore({ game: "arkanoid", score, name })` (`lib/scores-client.ts`); "JUGAR DE NUEVO" llama `restart()` (nuevo, no existía en el original) y "VOLVER AL VAULT" navega a `/biblioteca`.
- Botón mínimo fuera del CRT para volver a la biblioteca sin terminar la partida (mismo patrón que los demás juegos).
- Limpieza correcta de listeners de teclado y mouse (`keydown`/`keyup`/`mousemove`) y `requestAnimationFrame` al desmontar el componente (`destroy()`), para no dejar loops o listeners huérfanos.
- El leaderboard de `/juego/arkanoid` y `/salon-de-la-fama` funciona automáticamente en cuanto existe la fila en `games` — **no se modifica** `lib/scores.ts` ni `lib/scores-client.ts`.

**No incluye:**

- Sonido/audio (`ball-bounce.mp3`, `break-sound.mp3` del original) — se omite por completo, ningún asset de audio se porta a `public/games/arkanoid/`.
- El menú de clic para saltar directo a un nivel durante la pausa (`canvas.addEventListener('click', ...)` del original) — se documenta como descartado, no es gameplay real del juego.
- Cambios a Asteroides o Tetris más allá de la entrada nueva en el registry (mismo comportamiento visible para ambos).
- Soporte táctil/mobile para los controles, o remapeo de teclas.
- Mejoras a la física de rebote/colisión respecto al original — se porta tal cual (rebote simple invirtiendo `vy`, sin ángulo variable según punto de impacto en la paleta).
- Sincronizar `best`/`plays` del catálogo con puntuaciones reales — quedan como valores decorativos fijos, igual que los demás juegos.
- Rediseño visual del CRT/marco del reproductor — se reutiliza tal cual (`.crt`, `.crt-screen`, `.crt-bottom`).
- Persistencia en Supabase del leaderboard — ya existe y es genérica (spec 07); este spec no la toca.
- Refactor del registry — ya existe desde el spec 08; este spec solo agrega una entrada al mapa.

## Modelo de datos

**Nueva fila en la tabla `games` (Supabase, vía `mcp_supabase apply_migration`):**

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, sort_order) values
('arkanoid', 'ARKANOID', 'Rebota la pelota, rompe bloques y despeja los cinco niveles antes de perder tus tres vidas.', 'Controlá la paleta con el mouse o las flechas para mantener la pelota en juego: cada bloque que rompés suma puntos y libera una pequeña explosión de color. Despejá el tablero completo para avanzar de nivel, con la velocidad de la pelota subiendo un poco en cada uno de los cinco niveles disponibles. Perdés una vida cada vez que la pelota cae por debajo de la paleta, y la partida termina al perder las tres o al completar el último nivel. Pausá en cualquier momento con P o Escape.', 'ARCADE', 'cover-arkanoid', 'magenta', 38900, '6.1K', 3)
on conflict (id) do nothing;
```

No se agregan columnas nuevas a `games` — usa el mismo esquema que introdujo el spec 06.

**Assets portados a `public/games/arkanoid/`:**

- `spritesheet-breakout.png` (imagen única con todos los sprites).
- `levels.js` **no** se copia como archivo estático — su contenido (`LEVELS`, 5 niveles) se porta como datos TypeScript dentro de `lib/games/arkanoid.ts`.
- Los sonidos (`ball-bounce.mp3`, `break-sound.mp3`) **no se portan** (fuera de alcance, ver "No incluye").

**Helper de sprites — `lib/games/arkanoid-sprites.ts`:**

Puerto directo de `assets/spritesheet.js`, mismo API (`loadSpritesheet(cb)`, `drawSprite(ctx, name, x, y, w, h)`, `drawFrame(ctx, frame, x, y, w, h)`, constantes `SPRITES`/`EXPLOSION_FRAMES`/`EXPLOSION_DURATION`), apuntando a la imagen en `public/games/arkanoid/spritesheet-breakout.png`. Módulo separado (no dentro de `arkanoid.ts`) siguiendo la misma división de archivos que tiene el original (`spritesheet.js` aparte de `game.js`).

**Motor portado — `lib/games/arkanoid.ts`:**

```ts
export interface ArkanoidHandle {
  destroy: () => void; // cancela el RAF, cancela el arranque async pendiente si el spritesheet no cargó todavía, y remueve los listeners de teclado y mouse
  restart: () => void; // reinicia el estado interno (nivel 1, 3 vidas, score 0) y reanuda el loop; no existía en el original
  togglePause: () => void; // alterna paused; dibuja/oculta "PAUSA" en el canvas
}

export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  onGameOver: (finalScore: number) => void,
): ArkanoidHandle;
```

Encapsula en el closure de `createArkanoidGame` todo lo que hoy son variables globales de módulo en `game.js` (`paddle`, `ball`, `blocks`, `explosions`, `lives`, `score`, `gameState`, `currentLevel`, `isPaused`, `keys`). El arranque es asíncrono: `createArkanoidGame` llama a `loadSpritesheet(cb)` (de `arkanoid-sprites.ts`) y el loop no arranca hasta que ese callback se dispara; si `destroy()` se invoca antes de que la carga termine, el callback pendiente se ignora (no arranca el loop ni queda ningún listener registrado). Tanto `gameState === 'gameover'` como `gameState === 'win'` detienen el loop (deja de pedirse el próximo `requestAnimationFrame`) e invocan `onGameOver(score)` **una sola vez**. El menú de clic para saltar de nivel durante la pausa no se porta (se elimina el listener `canvas.addEventListener('click', ...)` del original junto con `drawPauseOverlay`'s botones); la pausa solo dibuja el texto "PAUSA" centrado.

**Componente — `components/ArkanoidGame.tsx`:**

```tsx
"use client";
interface ArkanoidGameProps {
  game: Game; // la entrada "arkanoid" de Supabase
}
export default function ArkanoidGame({ game }: ArkanoidGameProps): JSX.Element;
```

Monta `createArkanoidGame` sobre un `<canvas>` propio (800×600, mismo criterio que Asteroides) en `useEffect` (llamando `destroy()` en el cleanup), y reutiliza el mismo patrón de estado local que `AsteroidsGame.tsx`/`TetrisGame.tsx` para el modal de fin de partida (`over`, `nameOverride`, `saved`, `saving`, `saveError`) y `saveScore` de `lib/scores-client.ts`.

**Registry — `lib/games/registry.ts` (ya existe, solo se agrega una entrada):**

```ts
export const GAME_COMPONENTS: Record<string, ComponentType<{ game: Game }>> = {
  asteroides: dynamic(() => import("@/components/AsteroidsGame"), {
    ssr: false,
  }),
  tetris: dynamic(() => import("@/components/TetrisGame"), { ssr: false }),
  arkanoid: dynamic(() => import("@/components/ArkanoidGame"), {
    ssr: false,
  }),
};
```

`app/juego/[id]/jugar/page.tsx` no cambia — ya resuelve `GAME_COMPONENTS[game.id] ?? GamePlayer` desde el spec 08.

## Plan de implementación

1. **Assets** — Copiar `assets/spritesheet-breakout.png` (de `references/ClaudeCodeCourseGames/04-arkanoid/assets/`) a `public/games/arkanoid/spritesheet-breakout.png`. Portar `assets/spritesheet.js` a `lib/games/arkanoid-sprites.ts`, mismo API (`loadSpritesheet`, `drawSprite`, `drawFrame`, `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`), apuntando a la ruta absoluta `/games/arkanoid/spritesheet-breakout.png`.

2. **Motor del juego** — Crear `lib/games/arkanoid.ts` portando `game.js` y los datos de `levels.js` (`references/ClaudeCodeCourseGames/04-arkanoid/`): el estado (`paddle`, `ball`, `blocks`, `explosions`, `lives`, `score`, `gameState`, `currentLevel`, `isPaused`, `keys`) pasa al closure de `createArkanoidGame(canvas, onGameOver)`, reemplazando `document.getElementById('game')` por el canvas recibido. El arranque queda condicionado al callback de `loadSpritesheet` (de `arkanoid-sprites.ts`); si `destroy()` se llama antes de que cargue, se descarta el arranque pendiente sin dejar listeners. Se elimina el listener `canvas.addEventListener('click', ...)` y los botones de salto de nivel de `drawPauseOverlay` (la pausa solo dibuja "PAUSA" centrado). Se agrega `preventDefault()` en `keydown` de `ArrowLeft`/`ArrowRight`/`KeyP`/`Escape`. Tanto `gameState === 'gameover'` como `gameState === 'win'` detienen el loop e invocan `onGameOver(score)` una sola vez. Se expone `{ destroy, restart, togglePause }`, con `restart()` nuevo (reinicia a nivel 1, 3 vidas, score 0 y relanza el loop).

3. **Componente `ArkanoidGame`** — Crear `components/ArkanoidGame.tsx`: monta el `<canvas>` (800×600) dentro del marco `.crt`/`.crt-screen`/`.crt-bottom` existente, llama a `createArkanoidGame` en `useEffect` con `destroy()` en el cleanup, agrega el botón mínimo "VOLVER AL VAULT" fuera del CRT, y reutiliza el markup del modal de fin de partida (`.modal-bd`/`.modal`, input de iniciales, `saveScore`) de `AsteroidsGame.tsx`/`TetrisGame.tsx`, disparado por el callback `onGameOver`.

4. **Registry** — Agregar la entrada `arkanoid: dynamic(() => import("@/components/ArkanoidGame"), { ssr: false })` al mapa `GAME_COMPONENTS` en `lib/games/registry.ts`. No se toca `app/juego/[id]/jugar/page.tsx` (el dispatcher por registry ya existe desde el spec 08).

5. **Catálogo** — Insertar la fila `arkanoid` en la tabla `games` de Supabase vía `mcp_supabase apply_migration`, con los valores definidos en el modelo de datos. Verificar con `list_tables`/`execute_sql` que la tabla ahora tiene 3 filas.

6. **Cover art** — Crear `.cover-arkanoid` en `globals.css`: silueta de paleta + pelota + una fila de bloques de colores, acento `magenta`, siguiendo el patrón de las `.cover-*` existentes (gradiente base + capas decorativas `::after`/`::before`), visualmente distinta de `.cover-rocas`/`.cover-asteroides`/`.cover-tetris`.

7. **Leaderboard** — Sin implementación propia: al existir la fila del paso 5, `/juego/arkanoid` y `/salon-de-la-fama` muestran el leaderboard real automáticamente vía `getTopScores`/`getAllTopScores`/`saveScore`, ya genéricos por `game_id` (spec 07). Este paso es solo de verificación.

8. **Verificación end-to-end** — Recorrer `/` (aparece la card ARKANOID), `/juego/arkanoid` (detalle + leaderboard real, vacío al inicio), `/juego/arkanoid/jugar` (mover la paleta con mouse y con flechas, romper bloques, ver la explosión de color, completar el nivel 1 y avanzar de nivel con velocidad mayor, pausar/reanudar con `P`/`Escape` viendo "PAUSA" en el canvas sin menú de niveles); confirmar que perder las 3 vidas detiene el juego y muestra el modal con la puntuación final; confirmar que completar los 5 niveles (`gameState === 'win'`) también detiene el juego y muestra el modal; guardar con iniciales y confirmar que aparece en el leaderboard real de `/juego/arkanoid` y `/salon-de-la-fama`; salir a mitad de partida y volver a entrar, confirmando que no queda ningún loop, listener de teclado/mouse duplicado, ni arranque pendiente del spritesheet; confirmar que `/juego/asteroides` y `/juego/tetris` (y sus rutas `/jugar`) siguen funcionando igual tras agregar la entrada al registry; correr `npm run build` y `npm run lint`.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores.
- [ ] `npm run lint` no reporta errores.
- [ ] `/` muestra la card "ARKANOID" en la grilla de biblioteca, con su propio cover art (`.cover-arkanoid`, visualmente distinto de `.cover-rocas`/`.cover-asteroides`/`.cover-tetris`).
- [ ] `/juego/arkanoid` muestra la página de detalle estándar (tags, descripción, stat-strip, leaderboard real vía `getTopScores`), igual que Asteroides y Tetris.
- [ ] Botón "JUGAR AHORA" en el detalle navega a `/juego/arkanoid/jugar`.
- [ ] `/juego/arkanoid/jugar` muestra el juego real corriendo en el canvas dentro del marco CRT existente, con su propio HUD (Score, Nivel, vidas) dibujado en pantalla; el spritesheet carga antes de que arranque el loop.
- [ ] La paleta responde tanto al movimiento del mouse sobre el canvas como a `←`/`→`; ninguna tecla usada por el juego hace scroll de la página.
- [ ] La pelota rebota contra paredes, paleta y bloques; romper un bloque lo elimina, dispara su animación de explosión y suma puntos.
- [ ] Completar todos los bloques de un nivel avanza al siguiente (velocidad de la pelota mayor), hasta el nivel 5.
- [ ] Presionar `P` o `Escape` pausa la partida (el loop deja de avanzar, aparece "PAUSA" dibujado en el canvas, sin ningún botón de salto de nivel) y volver a presionar la reanuda.
- [ ] Perder las 3 vidas detiene el juego y aparece el modal de fin de partida con la puntuación final.
- [ ] Completar el nivel 5 (`gameState === 'win'`) también detiene el juego y aparece el mismo modal de fin de partida con la puntuación final.
- [ ] Guardar la puntuación en el modal la persiste en Supabase (tabla `scores`, `game_id: "arkanoid"`) y aparece en el leaderboard real de `/juego/arkanoid` y en el tab correspondiente de `/salon-de-la-fama`.
- [ ] "JUGAR DE NUEVO" reinicia el motor desde cero (puntuación 0, 3 vidas, nivel 1) sin recargar la página.
- [ ] El botón "VOLVER AL VAULT" navega a `/biblioteca` en cualquier momento de la partida (jugando, pausado o en el modal de fin de partida).
- [ ] Salir de `/juego/arkanoid/jugar` a mitad de partida (incluso durante la carga async del spritesheet) y volver a entrar no deja loops, listeners de teclado/mouse duplicados, ni arranques pendientes.
- [ ] `/juego/asteroides` y `/juego/tetris` (y sus rutas `/jugar`) siguen funcionando exactamente igual después de agregar la entrada `arkanoid` al registry.
- [ ] `lib/scores.ts` y `lib/scores-client.ts` no cambian — el leaderboard de Arkanoid funciona sin tocarlos.
- [ ] Ningún archivo de audio (`.mp3`) se agrega a `public/games/arkanoid/`.

## Decisiones tomadas y descartadas

- **Tercer juego real, caso C (assets + mouse + async), extendiendo el patrón sin inventar uno nuevo (tomada).** Arkanoid reusa el mismo contrato (`create<Nombre>Game`/`<Nombre>Handle`, componente clon con el mismo modal de fin de partida) que dejaron establecido Asteroides (caso A) y Tetris (caso B); la variabilidad propia de este caso (spritesheet, arranque async, mouse) se absorbe dentro del mismo patrón. _Descartada:_ tratar Arkanoid como un caso especial con un flujo de integración distinto.

- **Slug `arkanoid` tal cual, sin traducir (tomada).** Mismo criterio que "Tetris": es un nombre propio de un juego real, no se fuerza una traducción. _Descartada:_ `rompe-bloques`, alternativa genérica sin necesidad real de evitar el nombre original.

- **Categoría `ARCADE` (tomada).** Acción de reflejos con paleta/pelota, sin disparo ni versus. _Descartada:_ `PUZZLE`, menos fiel al gameplay real (no hay resolución de acertijos, solo reflejos y timing).

- **Color `magenta` (tomada).** Asteroides ya usa `cyan` y Tetris `green`; un tercer acento distinto evita que las tres cards reales se confundan en la grilla. _Descartada:_ `yellow`, disponible pero sin preferencia particular sobre `magenta`.

- **Sonido omitido por completo (tomada).** Sigue el criterio general del skill para el caso C: el audio queda fuera de alcance salvo pedido explícito, y no se pidió. _Descartada:_ portar `ball-bounce.mp3`/`break-sound.mp3`, que hubiera ampliado el alcance de este spec sin que se solicitara.

- **Pausa real preservada, sin el menú de salto de nivel por clic (tomada).** La pausa (`P`/`Escape`) es gameplay real y ya tiene precedente en Tetris; el menú de clic para saltar directo a cualquiera de los 5 niveles es una función de debug/testing del original (no una mecánica pensada para el jugador final), así que se descarta. _Descartada:_ portar el menú de salto de nivel tal cual, que hubiera expuesto una forma de "hacer trampa" saltando niveles sin jugarlos, inconsistente con competir por puntaje real en el leaderboard.

- **Controles combinados: mouse + teclado (tomada).** Fiel al original, que ya combina ambos sin conflicto (el mouse setea la posición absoluta, las flechas la desplazan). _Descartada:_ solo teclado (consistente con Asteroides/Tetris, pero se aleja innecesariamente del original, que fue diseñado alrededor del control por mouse).

- **HUD (Score/Nivel/vidas) dibujado en el canvas, no expuesto a React (tomada).** Mismo criterio que Asteroides y Tetris: cambio mínimo sobre el motor original, consistencia visual con los demás juegos reales del catálogo. _Descartada:_ exponer el estado como props/hooks de React, que introduce un patrón de HUD distinto sin beneficio claro sobre el ya establecido.

- **`gameState === 'win'` también dispara `onGameOver` (tomada).** Completar los 5 niveles es, igual que perder las 3 vidas, un estado terminal del motor (el loop deja de avanzar); tratarlo como "fin de partida" permite guardar esa puntuación en el leaderboard igual que cualquier otra. _Descartada:_ un tratamiento visual distinto para "ganar" (ej. una pantalla de victoria propia), que hubiera sido más fiel al mensaje `'¡Completaste el juego!'` del original pero agrega una segunda superficie de "fin de partida" fuera del modal ya establecido, sin que se haya pedido.

- **`restart()` agregado desde cero (tomada).** El original no tenía ningún mecanismo de reinicio (ni tecla ni botón); se agrega siguiendo el mismo criterio que Asteroides/Tetris (reset de estado a nivel 1/3 vidas/score 0 + relanzar el loop), invocado por "JUGAR DE NUEVO" del modal de React.

- **Helper de sprites en un módulo TypeScript separado (`lib/games/arkanoid-sprites.ts`) (tomada).** Refleja la misma separación de archivos que tiene el original (`spritesheet.js` aparte de `game.js`), y mantiene `arkanoid.ts` enfocado en el estado/loop del juego. _Descartada:_ inline del helper de sprites dentro de `arkanoid.ts`, que hubiera mezclado dos responsabilidades (dibujo de sprites vs. lógica de juego) en un solo archivo.

- **`levels.js` portado como datos TypeScript dentro de `arkanoid.ts`, no como archivo estático aparte (tomada).** Es solo un array de configuración sin lógica ni estado propio; no justifica un módulo separado como sí lo justifica el helper de sprites (que tiene funciones y carga de imagen). _Descartada:_ mantenerlo como `lib/games/arkanoid-levels.ts` separado, opción válida pero innecesaria dado su tamaño y falta de lógica propia.

- **Arranque asíncrono manejado dentro de la factory, con `destroy()` cancelando el arranque pendiente (tomada).** Necesario porque el original no arranca el loop hasta que `loadSpritesheet` termina; si el componente se desmonta durante esa carga (navegación rápida), no debe arrancar un loop húerfano después del `destroy()`. _Descartada:_ ignorar este caso (asumir que la carga siempre es más lenta que cualquier navegación), que hubiera dejado una condición de carrera real no cubierta por ningún criterio de aceptación.

- **Solo se agrega una entrada al registry existente, sin refactor del dispatcher (tomada).** El spec 08 ya introdujo `lib/games/registry.ts` y migró `app/juego/[id]/jugar/page.tsx` a resolverlo dinámicamente; este spec es el primero en beneficiarse de ese refactor sin pagarlo de nuevo. _Descartada:_ cualquier cambio a `app/juego/[id]/jugar/page.tsx`, innecesario dado que el dispatcher por registry ya resuelve `arkanoid` en cuanto existe la entrada en el mapa.

## Riesgos identificados

- **Listeners de teclado/mouse y `requestAnimationFrame` no limpiados al desmontar.** Igual que en los specs 05 y 08: si `createArkanoidGame` no limpia correctamente al navegar fuera de `/juego/arkanoid/jugar` (router SPA de Next.js, sin recarga completa), quedarían loops e inputs duplicados al volver a entrar — agravado aquí por tener tres listeners (`keydown`, `keyup`, `mousemove`) en vez de dos. _Mitigación:_ `destroy()` debe remover explícitamente los tres listeners y cancelar el frame pendiente (`cancelAnimationFrame`), invocado desde el cleanup del `useEffect`; se verifica en el paso 8 del plan y en el criterio de aceptación correspondiente.

- **Condición de carrera en el arranque asíncrono del spritesheet.** El loop no arranca hasta que `loadSpritesheet` invoca su callback; si el componente se desmonta antes de que eso ocurra (navegación muy rápida hacia/desde `/juego/arkanoid/jugar`), el callback podría dispararse después del `destroy()` y arrancar un loop huérfano sobre un canvas ya desmontado. _Mitigación:_ `destroy()` marca un flag interno que el callback de `loadSpritesheet` revisa antes de arrancar el loop; se verifica explícitamente en el paso 8 del plan (salir a mitad de la carga y confirmar que no arranca nada después).

- **Coordenadas de mouse dependientes del tamaño real del canvas en pantalla.** El original calcula la posición de la paleta escalando `event.clientX` contra `canvas.getBoundingClientRect()` (`scaleX = canvas.width / rect.width`); si el canvas se renderiza dentro de `.crt-screen` con un tamaño CSS distinto a 800×600 (por el `aspect-ratio` del marco existente), un error en el porteo de ese cálculo dejaría el control por mouse desalineado respecto a la posición visual del cursor. _Mitigación:_ portar el cálculo de escala tal cual, sin modificarlo, y verificar visualmente en el paso 8 que la paleta sigue el cursor con precisión dentro del marco CRT.

- **Remover el menú de salto de nivel sin dejar código muerto o referencias rotas.** Quitar el listener de `click` y los botones de `drawPauseOverlay` implica tocar varias constantes (`PAUSE_BTN_*`) y la función `loadLevel` usada por ese menú (que también se reutiliza para el avance normal de nivel); un porteo descuidado podría dejar constantes sin usar o romper el avance normal de nivel al remover código de más. _Mitigación:_ revisar que `loadLevel` se conserva intacta (la sigue llamando el avance normal al despejar un nivel) y que solo se elimina el listener de `click` y el dibujo de los botones, no la función que ambos comparten; se verifica en el paso 8 (avanzar de nivel jugando normalmente).

- **Nuevo estado terminal (`win`) sin precedente en Asteroides/Tetris.** Ninguno de los dos juegos reales anteriores tiene un estado de "victoria" distinto de "game over"; tratar `win` como equivalente a `gameover` para efectos de `onGameOver` es una decisión nueva de este spec (ver Decisiones) que no tiene un caso previo verificado en este repo. _Mitigación:_ criterio de aceptación dedicado a completar el nivel 5 y confirmar que el modal aparece igual que al perder las 3 vidas; se verifica manualmente en el paso 8 (jugar hasta completar los 5 niveles).

- **Particularidades de esta versión de Next.js (16.2.10) con `next/dynamic`, `ssr: false` y carga async de imágenes dentro de un Client Component.** `AGENTS.md` advierte que esta versión tiene diferencias respecto a versiones previas/training data. _Mitigación:_ si surge algún comportamiento inesperado con la carga del spritesheet o el montaje del canvas, revisar `node_modules/next/dist/docs/01-app/` antes de improvisar una solución.
