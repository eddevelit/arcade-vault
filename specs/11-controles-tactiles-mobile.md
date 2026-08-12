# Spec 11 — Controles táctiles para mobile

- **Estado:** Implementado
- **Dependencias:** Spec 05 — Asteroides (patrón canónico del motor/componente que este spec extiende, no reemplaza). Spec 08 — Tetris (introdujo `lib/games/registry.ts`; este spec no lo toca). Spec 09 — Arkanoid (motor con `mousemove` sobre el canvas, patrón que se extiende con `touchmove` para el arrastre de paleta). Spec 10 — Serpiente (dejó explícitamente fuera de alcance "soporte táctil/mobile para los controles"; este spec cierra esa brecha, para los 4 juegos a la vez).
- **Fecha:** 2026-08-11
- **Objetivo:** Agregar controles táctiles (D-pad + hasta 2 botones de acción por juego, reutilizando el input de teclado existente vía eventos sintéticos) a los 4 juegos reales del catálogo (Asteroides, Tetris, Arkanoid, Serpiente), mostrados automáticamente solo en dispositivos táctiles y con pinch-zoom/scroll bloqueado durante la partida.

## Alcance

**Incluye:**

- Componente compartido nuevo `components/TouchControls.tsx`: D-pad de 4 direcciones (diseño en diamante, según la imagen de referencia) + hasta 2 botones de acción, configurable por juego (qué botones mostrar, su etiqueta de texto y a qué tecla física equivalen). Estética CRT retro del proyecto (reusa `.btn ghost`/`.btn yellow`, acento de color según el `color` del juego — `cyan`/`green`/`magenta`/`yellow`), no el verde neón plano de la captura (esa era solo referencia de layout).
- Detección de dispositivo táctil vía `matchMedia("(pointer: coarse)")`: el overlay solo se monta/muestra cuando da positivo. En dispositivos sin touch (mouse + teclado) no aparece nada nuevo en pantalla.
- Mecanismo de input: cada botón del D-pad/acciones despacha `KeyboardEvent` sintéticos (`keydown`/`keyup`) sobre `window`, con el mismo `key`/`code` que ya escucha cada motor — así **Asteroides, Tetris y Serpiente no cambian su lógica de input**, solo ganan el componente visual. Cada botón trackea su propio estado de press/release (multi-touch independiente, por `touch.identifier`) para permitir combinaciones simultáneas (ej. rotar + propulsar a la vez en Asteroides).
- Excepción Arkanoid: `lib/games/arkanoid.ts` gana un listener real de `touchmove`/`touchstart`/`touchend` sobre el canvas para el arrastre directo de la paleta (misma lógica de posición relativa que ya usa `mousemove`, sin duplicar código de movimiento de paleta). `touch-action: none` en el canvas + `preventDefault()` en esos handlers para que el arrastre no dispare scroll/zoom de la página.
- Mapeo de controles por juego (teclado físico sigue funcionando igual, en paralelo, siempre):
  - **Asteroides** — D-pad: ← → rotar, ↑ propulsar (↓ sin efecto, igual que hoy con teclado). 1 botón: **DISPARAR** (Espacio).
  - **Tetris** — D-pad: ← → mover, ↑ rotar, ↓ caída suave. 2 botones: **CAÍDA** (Espacio, caída instantánea) y **PAUSA** (P).
  - **Arkanoid** — sin D-pad (paleta por arrastre directo sobre el canvas). 1 botón: **PAUSA** (P).
  - **Serpiente** — D-pad: ← → ↑ ↓ cambian dirección. Sin botones de acción.
- Teclado y touch conviven siempre en paralelo — ningún listener de teclado se desactiva; el overlay es puramente aditivo, cubre también el caso híbrido (laptop con pantalla táctil).
- Bloqueo de pinch-zoom/scroll **solo durante la partida**: `export const viewport` local en `app/juego/[id]/jugar/page.tsx` (`maximumScale: 1, userScalable: false`), sin tocar el `viewport` del resto del sitio.
- Layout: el marco `.crt`/`.crt-screen` existente queda arriba sin cambios de tamaño/comportamiento; `TouchControls` se renderiza debajo, dentro del mismo componente de juego, replicando la disposición canvas-arriba/control-abajo de la imagen de referencia.
- Etiquetas de los botones de acción en texto corto mayúscula (`DISPARAR`, `PAUSA`, `CAÍDA`), consistente con el resto de la UI (`Press Start 2P` / clases `.btn`).

**No incluye:**

- Rediseño de responsividad general del sitio (nav, home, biblioteca, salón de la fama, formularios) — fuera de alcance, este spec es específicamente sobre controles de juego.
- Remapeo de teclas por el usuario o configuración de controles — el mapeo queda fijo, definido en este spec.
- Soporte para gamepad/mando físico Bluetooth — fuera de alcance.
- Gestos tipo swipe sobre el canvas — descartado a favor de D-pad + botones (única excepción: el arrastre directo de la paleta en Arkanoid, que no es un "gesto" sino el equivalente táctil de `mousemove`).
- Vibración/haptics ni sonido al presionar los botones táctiles — no se pidió, el proyecto no tiene audio en los juegos.
- Agregar pausa a Asteroides o Serpiente — decisión explícita del usuario: se mantiene el mapeo "como está", sin ampliar el alcance de esos motores.
- Los seis puntos de integración de "juego nuevo" (fila en `games`, registry, cover art, leaderboard) — no aplica, no se agrega ningún juego, solo se extienden los 4 existentes.
- Soporte u optimización específica para orientación landscape — se asume portrait como caso principal (igual que la imagen de referencia); el layout responsive existente se encarga del resto.
- Cambios en `lib/scores.ts`/`lib/scores-client.ts` — el flujo de guardar puntuación no se toca.

## Modelo de datos

Este spec no agrega tablas ni filas a Supabase (no es un juego nuevo). Las únicas estructuras nuevas son de UI/input, en el cliente.

**Confirmado en los 4 motores:** los cuatro leen `KeyboardEvent.code` (no `.key`), así que los eventos sintéticos deben fijar `code` explícitamente. Teclas reales en uso: `ArrowUp/Down/Left/Right`, `Space` (disparo en Asteroides, caída instantánea en Tetris), `KeyP` (pausa en Tetris/Arkanoid), `Escape` (pausa alternativa en Arkanoid, no hace falta duplicarla en touch).

**Componente nuevo — `components/TouchControls.tsx`:**

```ts
export type DPadDirection = "up" | "down" | "left" | "right";

// Mapeo fijo: el D-pad siempre despacha las flechas físicas, igual en los 4 juegos.
const DPAD_CODE: Record<DPadDirection, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

export interface TouchActionButton {
  id: string; // "shoot" | "drop" | "pause" | ...
  label: string; // texto mostrado, ej. "DISPARAR"
  code: string; // KeyboardEvent.code despachado, ej. "Space", "KeyP"
}

export interface TouchControlsProps {
  accent: "cyan" | "magenta" | "yellow" | "green"; // = game.color
  showDPad?: boolean; // default true; Arkanoid pasa false (paleta por arrastre)
  actions?: TouchActionButton[]; // default []; 0-2 botones según el juego
}

export default function TouchControls(
  props: TouchControlsProps,
): JSX.Element | null;
// Retorna null si matchMedia("(pointer: coarse)") es false (sin overlay en desktop).
```

Cada botón (D-pad y acciones) despacha `window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }))` en `touchstart`/`pointerdown` y el `keyup` equivalente en `touchend`/`touchcancel`/`pointercancel`/`pointerup`, con estado de press/release trackeado por `touch.identifier` de forma independiente por botón (multi-touch: presionar dos botones a la vez despacha dos pares de eventos independientes, sin que uno cancele al otro).

**Uso por juego (props concretas, sin config central — cada `*Game.tsx` ya es un clon independiente, sigue el mismo criterio):**

```tsx
// AsteroidsGame.tsx
<TouchControls accent="cyan" actions={[{ id: "shoot", label: "DISPARAR", code: "Space" }]} />

// TetrisGame.tsx
<TouchControls accent="green" actions={[
  { id: "drop", label: "CAÍDA", code: "Space" },
  { id: "pause", label: "PAUSA", code: "KeyP" },
]} />

// ArkanoidGame.tsx
<TouchControls accent="magenta" showDPad={false} actions={[{ id: "pause", label: "PAUSA", code: "KeyP" }]} />

// SerpienteGame.tsx
<TouchControls accent="yellow" />
```

**Extensión en `lib/games/arkanoid.ts`** (única excepción con lógica nueva de motor, no solo de UI):

```ts
function onTouchMove(e: TouchEvent) {
  e.preventDefault(); // evita scroll/zoom mientras se arrastra
  const touch = e.touches[0];
  if (!touch) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const touchX = (touch.clientX - rect.left) * scaleX;
  paddle.x = Math.max(
    0,
    Math.min(canvas.width - paddle.w, touchX - paddle.w / 2),
  );
}
canvas.addEventListener("touchmove", onTouchMove, { passive: false });
canvas.addEventListener("touchstart", onTouchMove, { passive: false });
// removeEventListener simétrico en destroy()
```

Reutiliza el mismo cálculo de posición relativa que `onMouseMove` (mismo bloque, sin duplicar la fórmula en un helper separado — es una única línea de diferencia: `touch.clientX` en vez de `e.clientX`).

**`app/juego/[id]/jugar/page.tsx` — viewport local:**

```ts
import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};
```

Aplica solo a esta ruta — el resto del sitio no declara `viewport` y mantiene el comportamiento default del navegador.

## Plan de implementación

1. **Componente base `TouchControls.tsx`** — Crear `components/TouchControls.tsx`: detección `matchMedia("(pointer: coarse)")` (retorna `null` si es `false`), D-pad en diamante (4 direcciones, siempre `ArrowUp/Down/Left/Right`) y hasta 2 botones de acción según `actions` prop. Cada botón despacha `KeyboardEvent` sintéticos (`keydown` en press, `keyup` en release) sobre `window`, con tracking de press/release por `touch.identifier` independiente por botón para permitir combinaciones simultáneas. No se integra todavía en ningún juego — el sistema queda intacto (componente nuevo sin consumidores, build sigue pasando).

2. **Estilos** — Agregar en `app/globals.css` las reglas del D-pad (disposición en diamante) y la barra de botones de acción, con la estética CRT existente (reusando el patrón de `.btn ghost`/`.btn yellow`) y acento de color parametrizado por la prop `accent`.

3. **Integrar en Asteroides** — En `components/AsteroidsGame.tsx`, montar `<TouchControls accent="cyan" actions={[{ id: "shoot", label: "DISPARAR", code: "Space" }]} />` debajo del `.crt`, y `touch-action: none` en el `<canvas>`. Verificar con Playwright en viewport mobile que el overlay aparece y controla la nave.

4. **Integrar en Tetris** — En `components/TetrisGame.tsx`, montar `<TouchControls accent="green" actions={[{ id: "drop", label: "CAÍDA", code: "Space" }, { id: "pause", label: "PAUSA", code: "KeyP" }]} />`, mismo criterio de `touch-action: none`. Verificar movimiento, rotación, caída instantánea y pausa táctil.

5. **Integrar en Serpiente** — En `components/SerpienteGame.tsx`, montar `<TouchControls accent="yellow" />` (sin `actions`, D-pad solo). Verificar cambio de dirección y que no se rompe la regla de no-reversa-180°.

6. **Arkanoid — arrastre de paleta + integración** — Extender `lib/games/arkanoid.ts` con `onTouchMove`/`onTouchStart` (mismo cálculo de posición relativa que `onMouseMove`, con `e.preventDefault()`) sobre el `<canvas>`, removidos simétricamente en `destroy()`. En `components/ArkanoidGame.tsx`, montar `<TouchControls accent="magenta" showDPad={false} actions={[{ id: "pause", label: "PAUSA", code: "KeyP" }]} />` y `touch-action: none` en el canvas. Verificar arrastre de paleta y pausa táctil.

7. **Bloqueo de zoom/scroll en la partida** — Agregar `export const viewport: Viewport` en `app/juego/[id]/jugar/page.tsx` (`maximumScale: 1, userScalable: false`). Confirmar que el resto del sitio (`/`, `/biblioteca`, `/juego/[id]`, etc.) no se ve afectado.

8. **Verificación end-to-end** — Recorrer los 4 `/juego/<id>/jugar` con Playwright emulando viewport táctil mobile (D-pad y botones controlan cada juego igual que el teclado, Arkanoid arrastra la paleta, pinch-zoom/scroll bloqueado) y con viewport desktop sin touch (overlay ausente, comportamiento idéntico al actual). Confirmar que el teclado físico sigue funcionando en paralelo en ambos casos. Correr `npm run build` y `npm run lint`.

## Criterios de aceptación

- [x] `npm run build` completa sin errores.
- [x] `npm run lint` no reporta errores.
- [x] En un viewport táctil (`pointer: coarse`), los 4 `/juego/<id>/jugar` muestran `TouchControls` debajo del marco `.crt`; en un viewport sin touch no aparece ningún overlay y el comportamiento es idéntico al actual.
- [x] Asteroides: el D-pad rota (← →) y propulsa (↑) la nave, el botón "DISPARAR" dispara; presionar rotar y propulsar a la vez funciona simultáneamente.
- [x] Tetris: el D-pad mueve (← →), rota (↑) y hace caída suave (↓); "CAÍDA" hace caída instantánea; "PAUSA" pausa/reanuda la partida.
- [x] Arkanoid: arrastrar el dedo sobre el canvas mueve la paleta a la posición del dedo (mismo comportamiento que el mouse); no se muestra D-pad; "PAUSA" pausa/reanuda la partida.
- [x] Serpiente: el D-pad cambia de dirección en las 4 flechas; la regla de no-reversa-180° se sigue respetando con input táctil.
- [x] El teclado físico sigue funcionando exactamente igual en los 4 juegos, con o sin el overlay táctil visible (dispositivos híbridos).
- [x] Presionar y soltar un botón táctil no deja el estado de tecla "trabado" (equivalente correcto de `keyup` tras cada `keydown` sintético).
- [x] Dentro de `/juego/[id]/jugar`, hacer pinch-zoom o swipe no hace zoom ni scroll de la página durante la partida; en el resto del sitio (`/`, `/biblioteca`, `/juego/[id]`, etc.) el zoom/scroll normal del navegador sigue disponible.
- [x] `destroy()` de cada motor sigue limpiando todos los listeners (incluidos los táctiles nuevos de Arkanoid) sin dejar loops ni handlers huérfanos al salir y volver a entrar a `/jugar`.
- [x] Ningún cambio visual ni funcional en `/`, `/biblioteca`, `/juego/[id]`, `/salon-de-la-fama`, `/acerca-de`, `/login` fuera de la ruta `/jugar`.
- [x] No se agregan filas nuevas a `games`, ni cambios a `lib/games/registry.ts`, `lib/scores.ts` o `lib/scores-client.ts`.

## Decisiones tomadas y descartadas

- **Cobertura: los 4 juegos reales a la vez, en un solo spec (tomada).** El usuario confirmó cubrir Asteroides/Tetris/Arkanoid/Serpiente juntos en vez de arrancar con un subconjunto. _Descartada:_ empezar con 1-2 juegos como piloto y dejar el resto para specs siguientes — hubiera dejado el catálogo a medias en mobile.

- **D-pad + hasta 2 botones de acción, sin gestos (tomada).** Confirmado por el usuario junto con la imagen de referencia (canvas arriba, control abajo). Es predecible, no compite con el scroll de la página, y se mapea 1 a 1 con las teclas que ya existen en cada motor. _Descartada:_ gestos tipo swipe sobre el canvas para dirección/acción — más alcance sin necesidad, salvo la única excepción confirmada (arrastre de paleta en Arkanoid, que no es un gesto sino el equivalente táctil de `mousemove`).

- **Detección `pointer: coarse`, overlay solo en touch (tomada).** Evita ocupar espacio de pantalla en desktop con mouse/teclado. _Descartada:_ mostrar el overlay siempre, en todos los dispositivos.

- **Arkanoid: arrastre directo sobre el canvas para la paleta (tomada).** Es el control más natural para una paleta y reutiliza el mismo cálculo de posición relativa que ya existe para `mousemove`. _Descartada:_ D-pad izquierda/derecha para Arkanoid, menos natural que el arrastre y menos fiel al control por mouse ya existente.

- **Pinch-zoom/scroll bloqueado solo durante la partida, vía `viewport` local en `app/juego/[id]/jugar/page.tsx` (tomada).** Confirmado explícitamente por el usuario. Protege el gameplay sin afectar el resto del sitio. _Descartada:_ viewport restrictivo global en `app/layout.tsx`, que hubiera bloqueado el zoom también en contenido/formularios donde el usuario podría necesitarlo.

- **Mecanismo de input: `KeyboardEvent` sintéticos despachados en `window`, reutilizando los listeners de teclado ya existentes (tomada).** Asteroides, Tetris y Serpiente no cambian ni una línea de su lógica de input — el D-pad/botones son, desde el punto de vista del motor, indistinguibles de teclas físicas. _Descartada:_ una API explícita por motor (`press(dir)`/`release(dir)`), que hubiera obligado a tocar los 4 motores y romper el patrón "solo escucha `window`" ya establecido.

- **Mapeo de botones "como está" — 0 a 2 según lo que cada juego ya soporta por teclado (tomada).** Asteroides 1 botón, Tetris 2, Arkanoid 1 (+ arrastre), Serpiente 0. _Descartada:_ agregar pausa táctil a Asteroides y Serpiente aunque hoy no exista esa mecánica en esos motores — hubiera ampliado el alcance de motores que este spec no toca por lo demás.

- **Estética CRT retro del proyecto para el D-pad/botones, no el verde neón de la imagen (tomada).** La imagen era solo referencia de layout (canvas arriba, control abajo), confirmado por el usuario. Se reusan `.btn ghost`/`.btn yellow` y la paleta `--cyan`/`--magenta`/`--yellow`/`--green`. _Descartada:_ replicar el estilo visual flat verde de la captura, que hubiera introducido una estética ajena al resto de la UI.

- **Componente único y compartido `TouchControls.tsx` (tomada).** El layout y mecanismo son idénticos en los 4 juegos; solo cambian props (`accent`, `showDPad`, `actions`). Evita duplicar el mismo JSX/lógica 4 veces. _Descartada:_ un overlay independiente por juego, que hubiera repetido el mismo patrón sin necesidad.

- **Sin archivo de configuración central para el mapeo por juego (tomada).** Cada `*Game.tsx` pasa sus propias props a `TouchControls` inline, igual que ya son clones independientes entre sí (no hay un `lib/games/registry`-like para mapeos de botones). _Descartada:_ un módulo `lib/games/touch-config.ts` centralizado — over-engineering para 4 configuraciones estáticas y fijas.

- **Etiquetas de texto corto en mayúscula para los botones de acción (tomada).** Consistente con el resto de la UI (`Press Start 2P`/`.btn`). _Descartada:_ íconos/glifos, más compactos pero requieren elegir y validar cada símbolo sin necesidad real dado el espacio disponible en el layout de la imagen de referencia.

- **Teclado físico y touch conviven siempre en paralelo (tomada).** Ningún listener de teclado se desactiva; el overlay es puramente aditivo. Cubre el caso híbrido (laptop con pantalla táctil). _Descartada:_ modo exclusivo donde detectar touch apaga el teclado — más simple de razonar pero rompe ese caso híbrido sin necesidad.

## Riesgos identificados

- **iOS Safari puede ignorar `userScalable: false` del `viewport`.** Desde iOS 10, Safari ignora `user-scalable=no` por accesibilidad, así que el meta viewport por sí solo no garantiza el bloqueo de pinch-zoom en todos los dispositivos. _Mitigación:_ el meta viewport es la defensa "best-effort" pero no la única — `touch-action: none` en el canvas y los contenedores de `TouchControls`, más `e.preventDefault()` en los handlers táctiles, son la defensa principal y funcionan independientemente del meta tag; se verifica explícitamente en el paso 8 del plan en un dispositivo/emulación iOS.

- **Eventos de mouse "fantasma" tras un toque en Arkanoid.** Algunos navegadores disparan eventos de mouse sintéticos (`mousemove`/`mousedown`) después de un evento táctil por compatibilidad, lo que podría hacer que `onMouseMove` y el nuevo `onTouchMove` compitan por la posición de la paleta en el mismo frame. _Mitigación:_ `e.preventDefault()` en `touchstart`/`touchmove` suprime esos eventos de mouse sintéticos en la mayoría de los navegadores; se verifica en el paso 8 del plan arrastrando la paleta y confirmando que no "tiembla" entre dos fuentes de posición.

- **Multi-touch mal trackeado en el D-pad.** Si los botones no distinguen touches por `identifier` (solo por "hay algún touch activo"), presionar dos botones a la vez podría hacer que soltar uno cancele el estado del otro, rompiendo combinaciones como rotar + propulsar en Asteroides. _Mitigación:_ cada botón de `TouchControls` trackea su propio `touch.identifier` en press/release, independiente de los demás botones; se verifica en el paso 3 del plan presionando dos controles simultáneamente.

- **`keyup` sintético no disparado tras un `touchcancel`.** Si el dedo se desliza fuera del botón o el sistema operativo interrumpe el gesto (notificación, cambio de app), un `touchend` podría no llegar a dispararse, dejando la tecla sintética "trabada" en estado presionado (ej. una nave que sigue rotando sola). _Mitigación:_ escuchar también `touchcancel` (además de `touchend`) para forzar el `keyup` sintético; se verifica en el paso 8 del plan interrumpiendo un press a mitad de gesto.

- **Listeners táctiles no limpiados al desmontar (misma clase de riesgo que specs 05/08/09/10).** Si `TouchControls` o el nuevo `touchmove`/`touchstart` de `lib/games/arkanoid.ts` no remueven sus listeners en el cleanup, salir e volver a entrar a `/jugar` dejaría handlers duplicados. _Mitigación:_ mismo criterio ya usado por los 4 motores — remoción explícita en `destroy()`/cleanup de `useEffect`; se verifica en el paso 8 del plan.

- **Particularidades de esta versión de Next.js (16.2.10) con el export `viewport` por ruta.** `AGENTS.md` advierte que esta versión tiene diferencias respecto a training data. _Mitigación:_ antes de escribir `export const viewport` en `app/juego/[id]/jugar/page.tsx`, revisar `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md` (o equivalente) para confirmar la forma exacta del tipo `Viewport` y que un `viewport` a nivel de página (no solo `layout.tsx`) es soportado y no colisiona con el `metadata` ya declarado en el layout raíz.
