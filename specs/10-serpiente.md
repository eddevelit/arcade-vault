# Spec 10 — Serpiente (juego real)

- **Estado:** Aprobado
- **Dependencias:** Spec 05 — Asteroides (patrón canónico `create<Nombre>Game`/`<Nombre>Handle` y componente clon). Spec 06 — Tabla de juegos en Supabase (la tabla `games` ya existe; este spec solo agrega una fila). Spec 07 — Leaderboard real (`lib/scores.ts`/`lib/scores-client.ts` ya son genéricos por `game_id`; no se modifican). Spec 08 — Tetris (introdujo `lib/games/registry.ts`; este spec solo agrega una entrada nueva, sin tocar el dispatcher de `app/juego/[id]/jugar/page.tsx` de nuevo).
- **Fecha:** 2026-08-06
- **Objetivo:** Agregar "Serpiente" como cuarto juego jugable real del catálogo, diseñado desde cero (no existe un `game.js` de referencia en `references/ClaudeCodeCourseGames/` para este juego — solo se dispone del spritesheet `fruits.png` y su atlas `sprites.js` en `references/source-assets/snake-assets/`) con la mecánica clásica de Snake en grilla, usando ese spritesheet exclusivamente para dibujar la fruta, agregando una entrada nueva al registry ya existente.

## Alcance

**Incluye:**

- Nueva fila en la tabla `games` (Supabase) para el juego: `id: "serpiente"`, `title: "SERPIENTE"`, categoría `ARCADE`, `cover: "cover-serpiente"`, `color: "yellow"`, con `short`/`long` de copy nuevo (en español) fiel al gameplay real (serpiente en grilla que crece al comer fruta, acelera gradualmente, game over al chocar contra el borde o contra su propio cuerpo), `sort_order` siguiente al de Arkanoid (4).
- Integración completa al catálogo, igual que Asteroides/Tetris/Arkanoid: aparece en la grilla de biblioteca (`/`) con su `GameCard`, tiene página de detalle (`/juego/serpiente`) con leaderboard real (`getTopScores`), y botón "JUGAR AHORA" que navega a `/juego/serpiente/jugar`.
- Nueva clase CSS `.cover-serpiente` en `globals.css`: cuerpo de serpiente en zigzag sobre una grilla sutil de fondo, con la fruta destacada en acento `yellow`, siguiendo el patrón `::after`/`::before` de los covers existentes, distinta de `.cover-rocas`/`.cover-asteroides`/`.cover-tetris`/`.cover-arkanoid`.
- Puerto del spritesheet `fruits.png` (de `references/source-assets/snake-assets/`) a `public/games/serpiente/fruits.png`, referenciado por ruta absoluta. Como el juego usa una **única fruta fija** (decisión ya tomada), se porta únicamente el recorte `{x, y, w, h}` correspondiente a esa fruta desde `sprites.js` — no se porta el atlas completo de 22 frutas ni un helper de sprites separado (a diferencia de `arkanoid-sprites.ts`, innecesario aquí por no haber múltiples sprites ni animación).
- Motor de juego nuevo — `lib/games/serpiente.ts`, factory `createSerpienteGame(canvas, onGameOver): SerpienteHandle` con `{ destroy, restart }` (sin variables globales de módulo). Diseñado desde cero (no hay `game.js` de referencia): movimiento en grilla de 40×30 celdas de 20px sobre un canvas de 800×600, serpiente que crece un segmento por fruta comida, velocidad (intervalo entre ticks) que decrece gradualmente con cada fruta comida. Carga la imagen `fruits.png` de forma asíncrona antes de arrancar el loop (`Image().onload`); si `destroy()` se llama antes de que la carga termine, se cancela el arranque pendiente sin dejar listeners huérfanos (mismo criterio de seguridad que el caso C, aplicado aquí a una carga mucho más simple).
- Controles de teclado (`←` `→` `↑` `↓`) que cambian la dirección de movimiento, con `preventDefault()` para que no hagan scroll de la página; no se permite invertir 180° en un solo tick (ej. ir a la derecha y presionar izquierda de inmediato no debe chocar contra el propio segundo segmento), regla estándar de Snake para evitar una colisión instantánea e injusta.
- HUD (Score / velocidad) dibujado en el canvas (`ctx.fillText`), mismo criterio que Asteroides/Tetris/Arkanoid — no se usa la barra `.player-hud` de React.
- Sin pausa real (decisión confirmada) — el motor solo tiene los estados necesarios para jugar y terminar la partida.
- Al colisionar la cabeza contra el borde del tablero o contra cualquier segmento de su propio cuerpo, el loop se detiene e invoca `onGameOver(score)` **una sola vez**, mostrando el modal existente (`.modal-bd`/`.modal`) con input de iniciales y botón "GUARDAR PUNTUACIÓN", que persiste el resultado con `saveScore({ game: "serpiente", score, name })` (`lib/scores-client.ts`); "JUGAR DE NUEVO" llama `restart()` (reinicia serpiente a su largo/posición inicial, velocidad inicial y score 0) y "VOLVER AL VAULT" navega a `/biblioteca`.
- Nuevo componente `components/SerpienteGame.tsx`, clon de `AsteroidsGame.tsx`/`TetrisGame.tsx`/`ArkanoidGame.tsx` (mismos hooks/estados/modal de fin de partida), que monta el canvas y llama a `createSerpienteGame`. Botón mínimo fuera del CRT para volver a la biblioteca sin terminar la partida.
- Limpieza correcta de listeners de teclado y `requestAnimationFrame` al desmontar el componente (`destroy()`), incluyendo la cancelación de la carga de imagen pendiente si el componente se desmonta antes de que termine.
- **Entrada nueva en `lib/games/registry.ts`** (ya existe desde el spec 08): se agrega `serpiente: dynamic(() => import("@/components/SerpienteGame"), { ssr: false })` al mapa `GAME_COMPONENTS`, sin tocar `app/juego/[id]/jugar/page.tsx` (el dispatcher por registry ya existe).
- El leaderboard de `/juego/serpiente` y `/salon-de-la-fama` funciona automáticamente en cuanto existe la fila en `games` — **no se modifica** `lib/scores.ts` ni `lib/scores-client.ts`.

**No incluye:**

- Sonido/audio — ningún asset de audio se agrega a `public/games/serpiente/`.
- Pausa real (tecla dedicada) — decisión explícita, el motor no tiene ese estado.
- Variedad de frutas / selección aleatoria entre las 22 del atlas — se usa una única fruta fija que reaparece en posición aleatoria (decisión ya tomada); el resto del atlas de `sprites.js` no se porta.
- Wrap-around en los bordes del tablero — chocar contra el borde es game over, no reaparición del lado opuesto.
- Obstáculos adicionales, power-ups, o multijugador — fuera de alcance, no forman parte de la mecánica clásica acordada.
- Soporte táctil/mobile para los controles, o remapeo de teclas.
- Sincronizar `best`/`plays` del catálogo con puntuaciones reales — quedan como valores decorativos fijos, igual que los demás juegos.
- Rediseño visual del CRT/marco del reproductor — se reutiliza tal cual (`.crt`, `.crt-screen`, `.crt-bottom`).
- Persistencia distinta a Supabase para el leaderboard — ya existe y es genérica (spec 07); este spec no la toca.
- Refactor del registry — ya existe desde el spec 08; este spec solo agrega una entrada al mapa.

## Modelo de datos

**Nueva fila en la tabla `games` (Supabase, vía `mcp_supabase apply_migration`):**

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, sort_order) values
('serpiente', 'SERPIENTE', 'Guiá una serpiente que crece con cada fruta, sin chocar contra las paredes ni contra tu propia cola.', 'Controlá una serpiente que se desliza sobre una grilla, cambiando de dirección con las flechas para alcanzar la fruta y sumar puntos. Cada fruta comida suma un segmento a tu cuerpo y acelera un poco el ritmo de la partida, haciendo cada vez más difícil esquivarte a vos mismo. La partida termina en cuanto la cabeza toca el borde del tablero o cualquier parte de tu propio cuerpo — cuanto más larga la serpiente, mayor el desafío.', 'ARCADE', 'cover-serpiente', 'yellow', 4200, '7.5K', 4)
on conflict (id) do nothing;
```

No se agregan columnas nuevas a `games` — usa el mismo esquema que introdujo el spec 06.

**Asset portado a `public/games/serpiente/`:**

- `fruits.png` (spritesheet completo, se copia tal cual desde `references/source-assets/snake-assets/fruits.png` — más simple que recortar la imagen fuente, aunque el juego solo dibuje un recorte de ella).

**Recorte de fruta usado — dentro de `lib/games/serpiente.ts` (sin módulo de sprites separado):**

```ts
// Coordenadas dentro de fruits.png (spritesheet 3790×442px, fila de frutas y=136–295),
// tomadas de sprites.js. Se usa una única fruta fija: manzana.
const FRUIT_SPRITE = { x: 2786, y: 136, w: 110, h: 160 } as const;
```

No se porta `sprites.js` completo ni el resto del atlas (22 frutas) — solo este recorte, ya que el juego usa una única fruta fija que reaparece en posición aleatoria (decisión ya tomada). No se crea un `lib/games/serpiente-sprites.ts` separado (a diferencia de `arkanoid-sprites.ts`): al ser un solo recorte estático sin animación ni múltiples sprites, no se justifica un módulo de dibujo aparte del motor.

**Motor nuevo — `lib/games/serpiente.ts`:**

```ts
export interface SerpienteHandle {
  destroy: () => void; // cancela el RAF, cancela la carga de fruits.png si no terminó todavía, y remueve los listeners de teclado
  restart: () => void; // reinicia la serpiente (largo inicial, posición central del tablero, dirección inicial), la velocidad inicial y el score a 0; reanuda el loop
}

export function createSerpienteGame(
  canvas: HTMLCanvasElement,
  onGameOver: (finalScore: number) => void,
): SerpienteHandle;
```

Encapsula en el closure de `createSerpienteGame` todo el estado del juego (`snake: {x,y}[]`, `direction`, `pendingDirection`, `food: {x,y}`, `score`, `tickInterval`, `gameOver`). Tablero de 40×30 celdas de 20px sobre un canvas de 800×600. El arranque del loop queda condicionado a que `fruits.png` termine de cargar (`Image().onload`); si `destroy()` se invoca antes de que la carga termine, se descarta el arranque pendiente sin dejar listeners registrados. Cada fruta comida: agrega un segmento a `snake`, suma puntos al `score`, reduce `tickInterval` (acelera el juego) y reubica `food` en una celda libre aleatoria. Al detectar colisión de la cabeza contra el borde del tablero o contra cualquier segmento del propio cuerpo, el loop deja de pedir el próximo `requestAnimationFrame` e invoca `onGameOver(score)` **una sola vez**. Cambiar de dirección vía teclado no permite una inversión de 180° instantánea (ej. yendo a la derecha, presionar izquierda no tiene efecto hasta que la serpiente avanza en otra dirección válida).

**Componente — `components/SerpienteGame.tsx`:**

```tsx
"use client";
interface SerpienteGameProps {
  game: Game; // la entrada "serpiente" de Supabase
}
export default function SerpienteGame({
  game,
}: SerpienteGameProps): JSX.Element;
```

Monta `createSerpienteGame` sobre un `<canvas>` propio (800×600, mismo criterio que Asteroides/Arkanoid) en `useEffect` (llamando `destroy()` en el cleanup), y reutiliza el mismo patrón de estado local que `AsteroidsGame.tsx`/`TetrisGame.tsx`/`ArkanoidGame.tsx` para el modal de fin de partida (`over`, `nameOverride`, `saved`, `saving`, `saveError`) y `saveScore` de `lib/scores-client.ts`.

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
  serpiente: dynamic(() => import("@/components/SerpienteGame"), {
    ssr: false,
  }),
};
```

`app/juego/[id]/jugar/page.tsx` no cambia — ya resuelve `GAME_COMPONENTS[game.id] ?? GamePlayer` desde el spec 08.

## Plan de implementación

1. **Assets** — Copiar `fruits.png` (de `references/source-assets/snake-assets/`) a `public/games/serpiente/fruits.png`.

2. **Motor del juego** — Crear `lib/games/serpiente.ts`: el estado (`snake`, `direction`, `pendingDirection`, `food`, `score`, `tickInterval`, `gameOver`) pasa al closure de `createSerpienteGame(canvas, onGameOver)`. Tablero de 40×30 celdas de 20px sobre el canvas recibido (800×600). El loop no arranca hasta que `fruits.png` termina de cargar (`Image().onload`); si `destroy()` se llama antes, se descarta el arranque pendiente sin dejar listeners. Cada fruta comida agrega un segmento, suma al `score`, reduce `tickInterval` y reubica `food` en una celda libre aleatoria. Cambiar de dirección vía teclado ignora una inversión de 180° instantánea. Se agrega `preventDefault()` en `keydown` de `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`. Al detectar colisión contra el borde o contra el propio cuerpo, el loop se detiene e invoca `onGameOver(score)` una sola vez. Se expone `{ destroy, restart }`, con `restart()` reiniciando serpiente/velocidad/score a sus valores iniciales y relanzando el loop.

3. **Componente `SerpienteGame`** — Crear `components/SerpienteGame.tsx`: monta el `<canvas>` (800×600) dentro del marco `.crt`/`.crt-screen`/`.crt-bottom` existente, llama a `createSerpienteGame` en `useEffect` con `destroy()` en el cleanup, agrega el botón mínimo "VOLVER AL VAULT" fuera del CRT, y reutiliza el markup del modal de fin de partida (`.modal-bd`/`.modal`, input de iniciales, `saveScore`) de `AsteroidsGame.tsx`/`TetrisGame.tsx`/`ArkanoidGame.tsx`, disparado por el callback `onGameOver`.

4. **Registry** — Agregar la entrada `serpiente: dynamic(() => import("@/components/SerpienteGame"), { ssr: false })` al mapa `GAME_COMPONENTS` en `lib/games/registry.ts`. No se toca `app/juego/[id]/jugar/page.tsx` (el dispatcher por registry ya existe desde el spec 08).

5. **Catálogo** — Insertar la fila `serpiente` en la tabla `games` de Supabase vía `mcp_supabase apply_migration`, con los valores definidos en el modelo de datos. Verificar con `list_tables`/`execute_sql` que la tabla ahora tiene 4 filas.

6. **Cover art** — Crear `.cover-serpiente` en `globals.css`: cuerpo de serpiente en zigzag sobre una grilla sutil de fondo, con la fruta destacada en acento `yellow`, siguiendo el patrón de las `.cover-*` existentes (gradiente base + capas decorativas `::after`/`::before`), visualmente distinta de `.cover-rocas`/`.cover-asteroides`/`.cover-tetris`/`.cover-arkanoid`.

7. **Leaderboard** — Sin implementación propia: al existir la fila del paso 5, `/juego/serpiente` y `/salon-de-la-fama` muestran el leaderboard real automáticamente vía `getTopScores`/`getAllTopScores`/`saveScore`, ya genéricos por `game_id` (spec 07). Este paso es solo de verificación.

8. **Verificación end-to-end** — Recorrer `/` (aparece la card SERPIENTE), `/juego/serpiente` (detalle + leaderboard real, vacío al inicio), `/juego/serpiente/jugar` (mover con las 4 flechas, comer la fruta y ver que la serpiente crece y el juego acelera, chocar contra el borde del tablero y, por separado, contra el propio cuerpo, confirmando que cada caso dispara game over); confirmar que al terminar la partida se detiene el juego y aparece el modal con la puntuación final; guardar con iniciales y confirmar que aparece en el leaderboard real de `/juego/serpiente` y en el tab correspondiente de `/salon-de-la-fama`; salir a mitad de partida (incluso durante la carga async de `fruits.png`) y volver a entrar, confirmando que no queda loop, listener de teclado duplicado, ni arranque pendiente; confirmar que `/juego/asteroides`, `/juego/tetris` y `/juego/arkanoid` (y sus rutas `/jugar`) siguen funcionando igual tras agregar la entrada al registry; correr `npm run build` y `npm run lint`.

## Criterios de aceptación

- [x] `npm run build` completa sin errores.
- [x] `npm run lint` no reporta errores.
- [x] `/` muestra la card "SERPIENTE" en la grilla de biblioteca, con su propio cover art (`.cover-serpiente`, visualmente distinto de `.cover-rocas`/`.cover-asteroides`/`.cover-tetris`/`.cover-arkanoid`).
- [x] `/juego/serpiente` muestra la página de detalle estándar (tags, descripción, stat-strip, leaderboard real vía `getTopScores`), igual que Asteroides/Tetris/Arkanoid.
- [x] Botón "JUGAR AHORA" en el detalle navega a `/juego/serpiente/jugar`.
- [x] `/juego/serpiente/jugar` muestra el juego real corriendo en el canvas dentro del marco CRT existente, con su propio HUD (Score/velocidad) dibujado en pantalla; `fruits.png` carga antes de que arranque el loop.
- [x] Las 4 flechas cambian la dirección de la serpiente; ninguna hace scroll de la página. Presionar la dirección opuesta a la actual no provoca una colisión instantánea contra el propio segundo segmento (se ignora la inversión de 180°).
- [x] Comer la fruta hace crecer la serpiente un segmento, suma puntos al score, reubica la fruta en una posición libre aleatoria, y acelera levemente el ritmo del juego.
- [x] Chocar la cabeza contra el borde del tablero detiene el juego y dispara el fin de partida.
- [x] Chocar la cabeza contra cualquier segmento del propio cuerpo detiene el juego y dispara el fin de partida.
- [x] Al terminar la partida (por cualquiera de las dos colisiones) aparece el modal de fin de partida (mismo estilo que los demás juegos) con la puntuación final y un input de iniciales.
- [x] Guardar la puntuación en el modal la persiste en Supabase (tabla `scores`, `game_id: "serpiente"`) y aparece en el leaderboard real de `/juego/serpiente` y en el tab correspondiente de `/salon-de-la-fama`.
- [x] "JUGAR DE NUEVO" reinicia el motor desde cero (serpiente en su largo/posición inicial, velocidad inicial, puntuación 0) sin recargar la página.
- [x] El botón "VOLVER AL VAULT" navega a `/biblioteca` en cualquier momento de la partida (jugando o en el modal de fin de partida).
- [x] Salir de `/juego/serpiente/jugar` a mitad de partida (incluso durante la carga async de `fruits.png`) y volver a entrar no deja loops, listeners de teclado duplicados, ni arranques pendientes.
- [x] `/juego/asteroides`, `/juego/tetris` y `/juego/arkanoid` (y sus rutas `/jugar`) siguen funcionando exactamente igual después de agregar la entrada `serpiente` al registry.
- [x] `lib/scores.ts` y `lib/scores-client.ts` no cambian — el leaderboard de Serpiente funciona sin tocarlos.
- [x] Ningún archivo de audio (`.mp3`) se agrega a `public/games/serpiente/`.

## Decisiones tomadas y descartadas

- **Diseñado desde cero, sin motor de referencia (tomada).** A diferencia de Asteroides/Tetris/Arkanoid, `references/ClaudeCodeCourseGames/` no tiene una carpeta `snake`/`01-snake` con `game.js` — el material disponible (`references/source-assets/snake-assets/`) es solo un spritesheet de frutas y su atlas de coordenadas. Se diseña la mecánica clásica de Snake desde cero, reutilizando el spritesheet únicamente para el dibujo de la fruta. _Descartada:_ asumir o inventar un origen inexistente, o forzar un porteo de "caso A/B/C" cuando no hay código fuente que portar.

- **Mecánica clásica de Snake en grilla (tomada).** Serpiente que crece al comer, dirección controlada por flechas, mismo gameplay reconocible del juego original. _Descartada:_ variantes no confirmadas por el usuario (ej. sin crecimiento, con obstáculos).

- **Game over al chocar contra el borde, sin wrap-around (tomada).** Comportamiento clásico de Snake, confirmado explícitamente por el usuario. _Descartada:_ wrap-around estilo Asteroides, que se aleja del Snake tradicional y no fue lo pedido.

- **Velocidad creciente con cada fruta comida (tomada).** Da sensación de progreso y dificultad creciente, mismo criterio conceptual que el nivel de Asteroides/Arkanoid, aplicado aquí como aceleración continua del `tickInterval` en vez de niveles discretos. _Descartada:_ velocidad constante durante toda la partida, más simple pero menos desafiante a medida que la serpiente crece.

- **Fruta fija que reaparece, en vez de variedad aleatoria del atlas completo (tomada).** Simplifica el porteo (un solo recorte de `fruits.png` en vez de portar el atlas de 22 frutas) sin perder gameplay real; confirmado explícitamente por el usuario. _Descartada:_ fruta aleatoria entre varias del atlas, opción válida pero de mayor alcance sin necesidad real para el gameplay.

- **Recorte de fruta elegido: manzana (`apple`, `{x:2786,y:136,w:110,h:160}`) (tomada).** Es la fruta más icónica y reconocible asociada a Snake; decisión menor de estilo dentro de la variante ya elegida (fruta fija), no requirió confirmación explícita adicional. _Descartada:_ ninguna alternativa concreta fue evaluada — es un detalle estético de bajo impacto dentro de una decisión mayor ya tomada por el usuario.

- **Categoría `ARCADE` / color `yellow` (tomada).** ARCADE es fiel al gameplay (reflejos/grilla, sin puzzle ni disparo); `yellow` es el único de los 4 colores del sistema (`cyan`/`magenta`/`yellow`/`green`) todavía sin usar en el catálogo real, evitando que Serpiente se confunda visualmente con los 3 juegos existentes. _Descartada:_ cualquier color ya usado, que hubiera duplicado el acento de otro juego real.

- **Slug/título en español: `serpiente`/`SERPIENTE` (tomada).** A diferencia de Tetris/Arkanoid (nombres propios de juegos reales), "snake" es un término genérico sin marca asociada, así que se traduce siguiendo el mismo criterio que `asteroides`/`rocas`. _Descartada:_ `snake`/`SNAKE`, que hubiera introducido una URL en inglés sin la justificación de "nombre propio" que sí aplica a Tetris/Arkanoid.

- **HUD dibujado en el canvas, sin usar `.player-hud` de React (tomada).** Consistencia visual total con los 3 juegos reales existentes; Serpiente no tiene un HUD complejo que justifique exponerlo como estado de React (a diferencia de la duda planteada en el caso B del skill para Tetris). _Descartada:_ HUD en markup HTML fuera del canvas, que rompe el patrón visual ya establecido sin necesidad técnica.

- **Sin pausa real (tomada).** Mismo criterio que Asteroides: motor nuevo y simple, sin pedido explícito de pausa, reduce alcance. _Descartada:_ pausa con tecla dedicada (patrón ya usado en Tetris/Arkanoid), que hubiera ampliado el alcance sin necesidad confirmada.

- **Canvas 800×600 con grilla de 20×20px (40×30 celdas) (tomada).** Mismas dimensiones que Asteroides/Arkanoid, coincide con el `aspect-ratio: 4/3` de `.crt-screen` ya existente; el tamaño de celda da un tablero con suficiente margen de juego. _Descartada:_ dimensiones o tamaño de celda distintos, sin necesidad real de apartarse del estándar ya usado por los otros juegos reales.

- **Sin invertir dirección 180° instantáneamente (tomada).** Regla estándar de Snake para evitar que la serpiente choque contra su propio segundo segmento por un input accidental; no fue preguntada explícitamente al usuario por ser una regla intrínseca de la mecánica clásica ya confirmada (punto 1). _Descartada:_ permitir la inversión instantánea, que generaría muertes injustas percibidas como bug, no como gameplay.

- **`fruits.png` completo copiado a `public/games/serpiente/`, sin recortar la imagen fuente (tomada).** Más simple que generar un recorte estático del spritesheet original; el costo de peso extra es marginal. _Descartada:_ pre-recortar solo el sprite de manzana como imagen aparte, optimización innecesaria para un solo asset.

- **Sin módulo de sprites separado (`lib/games/serpiente-sprites.ts`) (tomada).** A diferencia de `arkanoid-sprites.ts` (múltiples sprites, frames de animación, helper de dibujo reutilizable), Serpiente usa un único recorte estático sin animación — no se justifica una separación de archivos. _Descartada:_ replicar el patrón de Arkanoid tal cual, que agregaría un archivo sin responsabilidad propia real.

- **Solo se agrega una entrada al registry existente, sin refactor del dispatcher (tomada).** El spec 08 ya introdujo `lib/games/registry.ts`; este es el tercer spec en beneficiarse de ese refactor sin pagarlo de nuevo (después de Arkanoid). _Descartada:_ cualquier cambio a `app/juego/[id]/jugar/page.tsx`, innecesario dado que el dispatcher por registry ya resuelve `serpiente` en cuanto existe la entrada en el mapa.

- **`best`/`plays` decorativos: `4200`/`"7.5K"` (tomada).** Valores plausibles para un juego cuyo puntaje se acumula de a poco por fruta (a diferencia de los miles por explosiones de Asteroides/Arkanoid), consistentes con el resto del catálogo (valores fijos, no sincronizados con datos reales). _Descartada:_ reusar una escala de puntaje similar a la de los juegos de disparo, poco fiel al ritmo real de scoring de Snake.

## Riesgos identificados

- **Listeners de teclado y `requestAnimationFrame` no limpiados al desmontar.** Igual que en los specs 05/08/09: si `createSerpienteGame` no limpia correctamente al navegar fuera de `/juego/serpiente/jugar` (router SPA de Next.js, sin recarga completa), quedarían loops e inputs duplicados al volver a entrar. _Mitigación:_ `destroy()` debe remover explícitamente el listener de `keydown` y cancelar el frame pendiente (`cancelAnimationFrame`), invocado desde el cleanup del `useEffect`; se verifica en el paso 8 del plan y en el criterio de aceptación correspondiente.

- **Condición de carrera en la carga asíncrona de `fruits.png`.** El loop no arranca hasta que la imagen termina de cargar (`Image().onload`); si el componente se desmonta antes de que eso ocurra (navegación muy rápida hacia/desde `/juego/serpiente/jugar`), el callback podría dispararse después del `destroy()` y arrancar un loop huérfano sobre un canvas ya desmontado. _Mitigación:_ `destroy()` marca un flag interno que el callback de carga revisa antes de arrancar el loop; se verifica explícitamente en el paso 8 del plan (salir a mitad de la carga y confirmar que no arranca nada después).

- **Inversión de dirección dentro del mismo tick ("bug clásico" de Snake).** Si la validación de "no reversa 180°" compara el nuevo input contra la última dirección _recibida_ en vez de contra la dirección _efectivamente aplicada_ en el tick anterior, presionar dos teclas en rápida sucesión dentro del mismo intervalo permitiría invertir el sentido y auto-colisionar de forma injusta contra el segundo segmento. _Mitigación:_ mantener `pendingDirection` separado de `direction`, aplicar como máximo un cambio de dirección por tick, y validar la reversa contra `direction` (la ya aplicada), no contra el último `keydown` recibido; se verifica en el paso 8 del plan presionando direcciones opuestas rápidamente.

- **La fruta reaparece sobre un segmento del cuerpo de la serpiente.** Si la reubicación aleatoria de `food` no excluye las celdas ocupadas por `snake`, la fruta podría spawnear sobre el propio cuerpo, quedando inalcanzable hasta que la serpiente se mueva o generando un comportamiento visualmente confuso. _Mitigación:_ filtrar las celdas candidatas excluyendo todas las ocupadas por `snake` antes de elegir la posición aleatoria de la fruta; se verifica en el paso 8 del plan jugando varias rondas y observando que la fruta siempre aparece en una celda libre.

- **Particularidades de esta versión de Next.js (16.2.10) con Client Components, `<canvas>` y carga async de imágenes.** `AGENTS.md` advierte que esta versión tiene diferencias respecto a versiones previas/training data. _Mitigación:_ si surge algún comportamiento inesperado al montar el canvas, con Turbopack, o con la carga de `fruits.png` dentro de un Client Component, revisar `node_modules/next/dist/docs/01-app/` antes de improvisar una solución.
