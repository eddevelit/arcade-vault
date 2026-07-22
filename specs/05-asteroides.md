# Spec 05 — Asteroides (juego real)

- **Estado:** Aprobado
- **Dependencias:** Spec 01 — MVP Visual Screens (usa `lib/data.ts` `GAMES`, `lib/session.ts` `saveScore`/`useStoredUser`, las rutas `/juego/[id]` y `/juego/[id]/jugar`, y el patrón visual del modal de guardado `.modal-bd`/`.modal` ya establecidos ahí). No depende ni modifica los specs 02 (Home), 03 (Acerca de/Contacto) ni 04 (Supabase setup).
- **Fecha:** 2026-07-21
- **Objetivo:** Agregar "Asteroides" como un nuevo juego jugable de verdad al catálogo de Arcade Vault, portando el motor existente en `references/ClaudeCodeCourseGames/02-asteroids/game.js` a un componente cliente de Next.js que reemplaza la simulación falsa del reproductor solo para este juego (los otros 8 juegos, incluido ROCAS, no cambian), conservando el HUD nativo dibujado en canvas durante la partida y conectando el fin de partida al modal de guardado de puntuación existente.

## Alcance

**Incluye:**

- Nueva entrada en `GAMES` (`lib/data.ts`) para el juego: `id: "asteroides"`, `title: "ASTEROIDES"`, categoría `SHOOTER`, con `short`/`long` de copy nuevo (en español) que refleje el gameplay real (nave triangular, asteroides que se dividen en fragmentos, power-up de disparo triple, sin mencionar OVNIs ni nada que el juego no tenga).
- Integración completa al catálogo, igual que los otros 8 juegos: aparece en la grilla de biblioteca (`/`) con su `GameCard`, tiene página de detalle (`/juego/asteroides`) con leaderboard falso vía `seededScores`, y botón "JUGAR AHORA" que navega a `/juego/asteroides/jugar`.
- Nueva clase CSS `.cover-asteroides` en `globals.css` para el cover art de la biblioteca/detalle, siguiendo el patrón visual de las `.cover-*` existentes (gradiente + capa `::after`/`::before`), distinta de `.cover-rocas`.
- Puerto del motor de juego (`game.js`, clases `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle` y el loop) a un módulo TypeScript encapsulado (sin variables globales de módulo ni auto-arranque), que un componente cliente de React monta sobre un `<canvas>` propio.
- Nuevo componente `AsteroidsGame` (o similar) usado **solo** para `id === "asteroides"` en `app/juego/[id]/jugar/page.tsx`; el resto de juegos sigue usando `GamePlayer` (simulación fake) sin cambios.
- Durante la partida, el juego usa su HUD nativo (SCORE / NIVEL / vidas dibujados en el canvas, como ya hace `game.js`) — no se usa la barra `.player-hud` de React ni los botones PAUSA/FIN para este juego. Se agrega únicamente un control mínimo fuera del CRT para volver a la biblioteca sin terminar la partida.
- Al llegar a `gameover` dentro del motor, se detiene el loop y se muestra el modal existente (`.modal-bd`/`.modal`, mismo componente visual que usan los demás juegos) con input de iniciales y botón "GUARDAR PUNTUACIÓN", que persiste el resultado con `saveScore({ game: "asteroides", score, name })`; "JUGAR DE NUEVO" reinicia el motor desde cero y "VOLVER AL VAULT" navega a `/`.
- Limpieza correcta de listeners de teclado y `requestAnimationFrame` al desmontar el componente (navegación SPA fuera de `/juego/asteroides/jugar`), para no dejar loops o listeners huérfanos.
- Controles de teclado (`←` `→` `↑` `Espacio`) con `preventDefault` en las teclas usadas por el juego, para que `Espacio`/flechas no hagan scroll de la página mientras se juega.

**No incluye:**

- Cambios al juego ROCAS existente (sigue siendo la simulación fake, sin relación con este juego nuevo).
- Pausa real de la partida (tecla o botón) — el motor original no tiene ese estado y no se agrega en este spec.
- Sonido/audio, soporte táctil/mobile para los controles, o remapeo de teclas.
- Cambios al leaderboard falso (`seededScores`) para reflejar puntuaciones reales — el leaderboard de `/juego/asteroides` sigue siendo mock, igual que en los demás juegos.
- Sincronizar `best`/`plays` del catálogo con puntuaciones reales — quedan como valores decorativos fijos, igual que en los otros 8 juegos.
- Persistencia en Supabase — el guardado sigue siendo 100% `localStorage`, igual que el resto de la app (spec 04 fue solo infraestructura, sin consumidores todavía).
- Rediseño visual del CRT/marco del reproductor — se reutiliza tal cual (`.crt`, `.crt-screen`, `.crt-bottom`).

## Modelo de datos

**Nueva entrada en `lib/data.ts` (`GAMES`):**

```ts
{
  id: "asteroides",
  title: "ASTEROIDES",
  short: "Dispara, esquiva y sobrevive entre rocas que se multiplican.",
  long: "Tu nave triangular flota en un campo de asteroides sin bordes: todo lo que sale por un lado reaparece del otro. Rota, propulsa y dispara para partir rocas grandes en fragmentos cada vez más pequeños, sumando puntos por cada uno. Recolecta el power-up 3x para disparo triple temporal, y aprovecha los segundos de invencibilidad al reaparecer tras perder una vida.",
  cat: "SHOOTER",
  cover: "cover-asteroides",
  color: "cyan",
  best: 63500,
  plays: "9.8K",
}
```

No se agregan campos nuevos a la interfaz `Game` — usa la misma forma que los otros 8 juegos.

**Motor portado — `lib/games/asteroids.ts`:**

```ts
export interface AsteroidsHandle {
  destroy: () => void; // cancela el RAF y remueve los listeners de teclado
  restart: () => void; // reinicia el estado interno (equivalente a initGame()) y reanuda el loop
}

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  onGameOver: (finalScore: number) => void,
): AsteroidsHandle;
```

Encapsula todo lo que hoy son variables globales de módulo en `game.js` (`ship`, `bullets`, `asteroids`, `score`, `state`, etc.) dentro del closure de `createAsteroidsGame`, para poder tener una instancia por montaje del componente sin colisionar. Cuando el estado interno pasa a `'gameover'`, el loop deja de pedir el próximo `requestAnimationFrame` (el último frame queda congelado detrás del modal) y se invoca `onGameOver(score)` **una sola vez**; ya no se restaura por `Espacio` internamente — el reinicio pasa a ser explícito vía `restart()`.

**Componente — `components/AsteroidsGame.tsx`:**

```tsx
"use client";
interface AsteroidsGameProps {
  game: Game; // la entrada "asteroides" de lib/data.ts
}
export default function AsteroidsGame({
  game,
}: AsteroidsGameProps): JSX.Element;
```

Monta `createAsteroidsGame` sobre un `<canvas>` propio en `useEffect` (llamando `destroy()` en el cleanup), y reutiliza el mismo patrón de estado local que ya existe en `GamePlayer.tsx` para el modal de fin de partida (`over`, `nameOverride`, `saved`) y `saveScore`/`useStoredUser` de `lib/session.ts`.

No se introduce persistencia nueva: el guardado de puntuación sigue usando `av_scores` vía `saveScore({ game: "asteroides", score, name })`, igual que los demás juegos.

## Plan de implementación

1. **Motor del juego** — Crear `lib/games/asteroids.ts` portando `game.js` (`references/ClaudeCodeCourseGames/02-asteroids/game.js`): las clases (`Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`) y el estado del juego pasan al closure de `createAsteroidsGame(canvas, onGameOver)`, reemplazando `document.getElementById('canvas')` por el canvas recibido como parámetro. Se agrega `preventDefault()` en el `keydown` de `ArrowLeft`/`ArrowRight`/`ArrowUp`/`Space` para que no hagan scroll de la página, y se expone `{ destroy, restart }`. Al entrar en `state === 'gameover'` el loop deja de pedir el próximo frame e invoca `onGameOver(score)` una sola vez, reemplazando el restart automático con Espacio.

2. **Componente `AsteroidsGame`** — Crear `components/AsteroidsGame.tsx`: monta el `<canvas>` (800×600, coincide con el `aspect-ratio: 4/3` de `.crt-screen`) dentro del marco `.crt`/`.crt-screen`/`.crt-bottom` ya existente, llama a `createAsteroidsGame` en `useEffect` con `destroy()` en el cleanup, agrega un botón mínimo "VOLVER AL VAULT" fuera del CRT, y reutiliza el markup del modal de fin de partida (`.modal-bd`/`.modal`, input de iniciales, `saveScore`) que ya existe en `GamePlayer.tsx`, disparado por el callback `onGameOver`.

3. **Catálogo** — Agregar la entrada `asteroides` a `GAMES` en `lib/data.ts` con los valores definidos en el modelo de datos.

4. **Wiring de ruta** — En `app/juego/[id]/jugar/page.tsx`, renderizar `<AsteroidsGame game={game} />` cuando `game.id === "asteroides"` y `<GamePlayer game={game} />` para el resto, sin tocar el comportamiento de los otros 8 juegos (incluido ROCAS).

5. **Cover art** — Crear `.cover-asteroides` en `globals.css`, siguiendo el patrón de las `.cover-*` existentes (gradiente base + capas decorativas `::after`/`::before`), visualmente distinto de `.cover-rocas`.

6. **Verificación end-to-end** — Recorrer `/` (aparece la card ASTEROIDES), `/juego/asteroides` (detalle + leaderboard falso), `/juego/asteroides/jugar` (rotar, propulsar, disparar, romper asteroides, recoger el power-up 3x, perder las 3 vidas); confirmar que al perder la última vida se detiene el juego y aparece el modal con la puntuación final; guardar con iniciales y confirmar que persiste en `av_scores` y aparece en `/salon-de-la-fama` para "asteroides"; salir a mitad de partida y volver a entrar, confirmando que no queda ningún loop ni listener duplicado (sin drop de FPS ni inputs duplicados); correr `npm run build` y `npm run lint`.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores.
- [ ] `npm run lint` no reporta errores.
- [ ] `/` muestra la card "ASTEROIDES" en la grilla de biblioteca, con su propio cover art (`.cover-asteroides`, visualmente distinto de `.cover-rocas`).
- [ ] `/juego/asteroides` muestra la página de detalle estándar (tags, descripción, stat-strip, leaderboard falso de 10 filas vía `seededScores`), igual que los demás juegos.
- [ ] Botón "JUGAR AHORA" en el detalle navega a `/juego/asteroides/jugar`.
- [ ] `/juego/asteroides/jugar` muestra el juego real corriendo en el canvas dentro del marco CRT existente, con su propio HUD (SCORE, NIVEL, vidas) dibujado en pantalla.
- [ ] Los controles funcionan: `←`/`→` rotan la nave, `↑` propulsa, `Espacio` dispara; ninguna de estas teclas hace scroll de la página.
- [ ] Destruir un asteroide grande lo divide en dos medianos, y un mediano en dos pequeños; los pequeños desaparecen sin dividirse, sumando puntos según su tamaño.
- [ ] Recoger el power-up 3x activa disparo triple temporal, visible en el HUD.
- [ ] Perder una vida deja a la nave con parpadeo de invencibilidad temporal antes de volver a chocar; perder las 3 vidas detiene el juego (el loop se congela, no sigue corriendo de fondo).
- [ ] Al terminar la partida (0 vidas) aparece el modal de fin de partida (mismo estilo que los demás juegos) con la puntuación final y un input de iniciales.
- [ ] Guardar la puntuación en el modal la persiste en `localStorage` (`av_scores` con `game: "asteroides"`) y luego aparece en `/salon-de-la-fama` para ese juego.
- [ ] "JUGAR DE NUEVO" reinicia el motor desde cero (puntuación 0, 3 vidas, nivel 1) sin recargar la página.
- [ ] El botón "VOLVER AL VAULT" navega a `/` en cualquier momento de la partida (jugando o en el modal de fin de partida).
- [ ] Salir de `/juego/asteroides/jugar` a mitad de partida (navegando a otra ruta) y volver a entrar no deja loops ni listeners de teclado duplicados (verificar que no haya inputs dobles ni degradación de FPS al reingresar varias veces).
- [ ] Los otros 8 juegos del catálogo (incluido ROCAS) no cambian de comportamiento — siguen usando `GamePlayer` con la simulación fake.

## Decisiones tomadas y descartadas

- **Juego nuevo "asteroides", no un reemplazo de ROCAS (tomada).** El usuario aclaró explícitamente que no se trata del mismo juego, aunque ambos sean temática espacial/asteroides. _Descartada:_ adaptar/reemplazar ROCAS, que fue la lectura inicial antes de la aclaración — hubiera generado una entrada de catálogo con contenido incorrecto.

- **Integración completa al catálogo (biblioteca + detalle + reproductor real) (tomada).** Da paridad total con los demás 8 juegos (card, detalle con leaderboard falso, reproductor) sin dejar una ruta huérfana fuera del flujo normal de navegación. _Descartada:_ ruta jugable aislada sin pasar por biblioteca/detalle, por dejar el juego "escondido" y requerir un spec adicional después igualmente.

- **Slug y título en español, `asteroides`/`ASTEROIDES` (tomada).** Consistente con el resto de slugs y títulos del catálogo, todos en español. _Descartada:_ `asteroids`/`ASTEROIDS` en inglés, que hubiera introducido la única URL en inglés del sitio (excepto `/login`, ya señalado como excepción en el spec 03).

- **Cover art dedicado `.cover-asteroides` (tomada).** Evita que ROCAS y ASTEROIDES se vean idénticos en la grilla de biblioteca, siendo juegos distintos. _Descartada:_ reusar `.cover-rocas`, más rápido pero confuso para quien navegue el catálogo.

- **HUD nativo del canvas durante la partida, sin usar `.player-hud`/PAUSA/FIN (tomada).** Cambio mínimo sobre `game.js` — se preserva el HUD y el estilo visual del juego original tal cual fueron diseñados. _Descartada:_ sincronizar el HUD de React con el estado del motor frame a frame, que hubiera requerido agregar callbacks adicionales al motor sin un beneficio claro sobre el HUD ya existente.

- **Fin de partida vía el modal existente (`.modal-bd`) con input de iniciales (tomada).** Mantiene consistencia total con el flujo de guardado de puntuación de los demás juegos. _Descartadas:_ guardado automático sin confirmación (rompe la paridad de UX con el resto del catálogo) y dejar el guardado fuera de alcance (el juego quedaría sin poder aparecer nunca en el Salón de la Fama).

- **Sin pausa real en este spec (tomada).** El motor original (`game.js`) no tiene ese concepto (solo `'playing' | 'dead' | 'gameover'`); agregarlo es trabajo adicional no pedido. _Descartada:_ pausa con tecla dedicada, que solo tenía sentido si se elegía sincronizar el HUD de React (opción no elegida).

- **Motor portado a un closure (`createAsteroidsGame`) en vez de mantenerlo como script global (tomada).** Permite montar y desmontar una instancia por cada visita a `/juego/asteroides/jugar` sin colisionar variables globales ni dejar loops/listeners huérfanos tras navegar con el router de Next.js (SPA, sin recarga completa). _Descartada:_ mantener el patrón de variables de módulo globales del `game.js` original, que rompería (o duplicaría loops) si el componente se monta más de una vez en la misma sesión del navegador.

## Riesgos identificados

- **Listeners de teclado y `requestAnimationFrame` no limpiados al desmontar.** Como el motor original escucha `keydown`/`keyup` en `window` y corre un loop con `requestAnimationFrame`, si el componente no limpia correctamente al navegar fuera de `/juego/asteroides/jugar` (router SPA de Next.js, sin recarga completa), quedarían loops e inputs duplicados si se vuelve a entrar. _Mitigación:_ `createAsteroidsGame` debe exponer `destroy()` removiendo explícitamente ambos listeners y cancelando el frame pendiente (`cancelAnimationFrame`), invocado desde el cleanup del `useEffect`; se verifica explícitamente en el paso 6 del plan y en el criterio de aceptación correspondiente.

- **Overlay nativo "GAME OVER" del canvas visible detrás del modal de React.** Al pausar el loop en `gameover`, el último frame dibujado (que incluye el texto "GAME OVER" / "ESPACIO PARA REINICIAR" del `game.js` original) queda congelado detrás del modal `.modal-bd`, pudiendo duplicar visualmente el mensaje de fin de partida. _Mitigación:_ validar visualmente en el paso 6; si el resultado se ve confuso, ajustar el motor para omitir ese overlay específico cuando se usa embebido (parámetro o flag), sin tocar el resto del `draw()`.

- **Drift de comportamiento al portar de script global a closure.** Mover el estado del juego (variables de módulo en `game.js`) al closure de `createAsteroidsGame` es un refactor mecánico pero no trivial; un error de scope podría alterar sutilmente la física o el timing respecto al original. _Mitigación:_ portar función por función sin reescribir lógica de juego, y comparar el comportamiento contra `references/ClaudeCodeCourseGames/02-asteroids/index.html` abierto en paralelo durante la verificación del paso 6.

- **Particularidades de esta versión de Next.js con Client Components y `<canvas>`.** `AGENTS.md` advierte que esta versión (16.2.10) tiene diferencias respecto a versiones previas/training data. _Mitigación:_ si surge algún comportamiento inesperado al montar el canvas o con Turbopack durante la implementación, revisar la doc correspondiente en `node_modules/next/dist/docs/01-app/` antes de improvisar una solución.
