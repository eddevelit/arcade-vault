---
name: nuevo-juego
description: Diseña el spec para agregar un juego jugable nuevo (con su leaderboard) a Arcade Vault e integrarlo en la plataforma. Hace preguntas de aclaración específicas de juegos y construye el spec sección por sección. El juego puede venir o no de references/ClaudeCodeCourseGames/. Al terminar, apruébalo y córrelo con /spec-impl.
disable-model-invocation: true
argument-hint: "nombre del juego o carpeta de referencia (ej. tetris, 03-tetris) — opcional"
allowed-tools: Bash(ls:*), Bash(cat:*), Read, Grep, Glob
---

# /nuevo-juego — Diseñador de specs para juegos + leaderboard de Arcade Vault

Este skill es un `/spec` especializado: sigue el mismo método spec-driven (preguntas primero, spec sección por sección después), pero trae incorporado el conocimiento de **cómo se integra un juego jugable nuevo en Arcade Vault** — el patrón que dejaron establecido los specs 05 (Asteroides real), 06 (tabla `games` en Supabase) y 07 (leaderboard real).

**No escribes código aquí.** El único output de este comando es un archivo `specs/NN-<slug>.md` en estado `Draft`. La implementación real la hace `/spec-impl NN-<slug>` después de que el usuario apruebe el spec.

## Filosofía

Agregar un juego real y su leaderboard toca siempre los mismos puntos de integración. Si alguno se omite (la fila en Supabase, el cover CSS, la limpieza de listeners del motor), el juego queda a medias — visible pero roto, o invisible aunque el código exista. Este skill existe para que ningún spec de juego nuevo se olvide de uno de esos puntos, y para que las preguntas de aclaración cubran las decisiones específicas de un motor de juego (no solo las genéricas de cualquier feature).

---

## Referencia de arquitectura: los 6 puntos de integración

Todo spec generado por este skill debe cubrir estos seis puntos (o justificar explícitamente por qué alguno no aplica). Son el resultado de lo que los specs 05/06/07 ya implementaron y verificaron end-to-end.

### 1. Motor del juego — `lib/games/<slug>.ts`

Módulo puro de canvas 2D, sin React, encapsulado en una **factory** (nunca variables globales de módulo — se rompería si el componente se monta más de una vez en la sesión):

```ts
export interface <Nombre>Handle {
  destroy: () => void; // cancela el RAF y remueve TODOS los listeners (teclado y, si aplica, mouse)
  restart: () => void; // reinicia el estado interno y reanuda el loop
}

export function create<Nombre>Game(
  canvas: HTMLCanvasElement,
  onGameOver: (finalScore: number) => void,
): <Nombre>Handle;
```

Reglas fijas, sin importar el motor de origen:

- Todo el estado (posiciones, score, vidas, nivel, flags) vive en el closure de la factory.
- `onGameOver(score)` se invoca **una sola vez**, cuando el motor entra en su estado terminal; el loop deja de pedir el próximo `requestAnimationFrame` ahí (último frame congelado detrás del modal de React).
- `preventDefault()` en las teclas que usa el juego (flechas, espacio, etc.) para que no hagan scroll de la página.
- `destroy()` cancela el RAF pendiente y remueve explícitamente cada listener agregado (`keydown`/`keyup`/`mousemove`/`click`), sin depender del garbage collector.
- El reinicio deja de ser interno (tecla/botón del juego original) y pasa a ser el método explícito `restart()`, invocado por React.

Clonar la estructura de `lib/games/asteroids.ts` como referencia canónica (caso A, ver tabla de abajo).

### 2. Componente cliente — `components/<Nombre>Game.tsx`

Clon de `components/AsteroidsGame.tsx`: mismo contrato de props (`{ game: Game }`), mismos hooks (`useStoredUser`, `canvasRef`, `handleRef`), mismos estados (`over`, `finalScore`, `nameOverride`, `saved`, `saving`, `saveError`), mismo modal de fin de partida (`.modal-bd`/`.modal`, input de iniciales, botón "GUARDAR PUNTUACIÓN" → `saveScore` de `lib/scores-client.ts`), mismo marco `.crt`/`.crt-screen`/`.crt-bottom`. Lo único que cambia es qué factory se monta en el `useEffect` y las dimensiones del `<canvas>`.

### 3. Registry (dispatcher) — `lib/games/registry.ts`

`app/juego/[id]/jugar/page.tsx` hoy decide con un `if` hardcodeado:

```ts
if (game.id === "asteroides") return <AsteroidsGame game={game} />;
return <GamePlayer game={game} />;
```

Esto no escala a N juegos reales. El patrón a instaurar es un registry:

```ts
// lib/games/registry.ts
import dynamic from "next/dynamic";

export const GAME_COMPONENTS: Record<string, ComponentType<{ game: Game }>> = {
  asteroides: dynamic(() => import("@/components/AsteroidsGame"), {
    ssr: false,
  }),
  // <slug>: dynamic(() => import("@/components/<Nombre>Game"), { ssr: false }),
};
```

`ssr: false` porque el motor toca `canvas`/`window` directamente. `app/juego/[id]/jugar/page.tsx` pasa a resolver `GAME_COMPONENTS[game.id] ?? GamePlayer`.

**Antes de escribir el plan del spec, verifica si el registry ya existe** (`Glob` sobre `lib/games/registry.ts` o `Grep` de `GAME_COMPONENTS`):

- **No existe todavía:** el plan de implementación incluye, como paso propio, el refactor de `app/juego/[id]/jugar/page.tsx` para introducir el registry (reemplazando el `if` actual) — es un refactor que se paga una sola vez.
- **Ya existe:** el plan solo agrega una entrada nueva al mapa; no se toca el dispatcher de nuevo.

### 4. Fila en la tabla `games` de Supabase

La fuente de verdad del catálogo es la tabla `games` en Supabase (remota; no hay DDL versionado en el repo — se accede vía MCP `supabase`). El spec debe especificar el `insert` completo:

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, sort_order) values
('<slug>', '<TÍTULO>', '<short>', '<long>', '<CAT>', 'cover-<slug>', '<color>', <best>, '<plays>', <siguiente_sort_order>)
on conflict (id) do nothing;
```

Aplicado con `mcp_supabase apply_migration` durante `/spec-impl`, siguiendo el mismo patrón que el spec 06.

### 5. Cover art — `.cover-<slug>` en `app/globals.css`

Sigue el patrón ya establecido (`.cover-rocas`, `.cover-asteroides`): fondo con gradiente base + capas decorativas `::after`/`::before` (formas via `radial-gradient`/`clip-path`/glyph + `drop-shadow`), usando las variables de color existentes (`--cyan`, `--magenta`, `--yellow`, `--green`). Debe ser visualmente distinto de todos los covers existentes. Si el usuario quiere ayuda con la dirección visual del cover, sugerir apoyarse en el skill `/frontend-design` durante la implementación (no aquí).

### 6. Leaderboard — automático, no se toca

`lib/scores.ts` (`getTopScores`, `getAllTopScores`, `getGameStats`) y `lib/scores-client.ts` (`saveScore`) ya son **genéricos por `game_id`** (tabla `scores` + vistas `best_scores`/`ranked_scores`, FK `scores.game_id → games.id`). En cuanto existe la fila del punto 4, `/juego/<slug>` y `/salon-de-la-fama` muestran el leaderboard real de ese juego sin ningún cambio de código. **El plan del spec debe decirlo explícitamente** ("el leaderboard funciona automáticamente por el FK; no se modifica `lib/scores.ts` ni `lib/scores-client.ts`") para que nadie lo re-implemente por error.

---

## Guía de porteo por caso de motor

Los juegos de `references/ClaudeCodeCourseGames/` (y cualquier otro `game.js` vanilla que llegue) caen en uno de tres casos. Clasifica el caso en la Fase 1 y ajusta las preguntas/plan según corresponda.

| Caso                           | Ejemplo        | Rasgos                                                                                                                                                                                                                                                 | Transformación al portar                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — canvas-HUD**             | `02-asteroids` | HUD dibujado en canvas (`ctx.fillText`); clases con `update(dt)`/`draw()`; input `keydown`/`keyup` en `window` vía `e.code`; `dt` en segundos, clamp ~0.05; reinicio original por tecla (Espacio).                                                     | Caso base, ya resuelto por `lib/games/asteroids.ts`. HUD se mantiene dibujándose en canvas (no se sincroniza con React). Reinicio por tecla se reemplaza por `restart()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **B — HUD-en-DOM**             | `03-tetris`    | HUD por `textContent` en `<div>` fuera del canvas; puede haber **más de un canvas** (ej. tablero + "next piece"); input discreto por evento (sin `keys` sostenido); reinicio original por botón HTML; puede tener pausa real.                          | Decisión a tomar con el usuario: ¿el HUD se sigue pintando en canvas (como asteroides, más simple) o se expone como estado de React (`score`/`lines`/`level`/`next`) para reusar markup HTML? Si hay 2 canvas, el componente monta ambos `<canvas>` y la factory recibe ambos elementos. El botón de reinicio original se convierte en `restart()` invocado por el modal de React, no por el markup del juego.                                                                                                                                                                                                                               |
| **C — assets + mouse + async** | `04-arkanoid`  | Depende de assets externos (spritesheet PNG, sonidos `.mp3`, un `levels.js` separado); arranque **asíncrono** (loop arranca tras cargar el spritesheet); input de **mouse** (`mousemove`/`click`) además de teclado; puede no tener reinicio original. | Assets se mueven a `public/games/<slug>/` e importan/referencian por ruta absoluta; el arranque async queda dentro de la factory (ej. `create<Nombre>Game` no arranca el loop hasta que el spritesheet cargó, pero `destroy()` debe poder cancelar limpio aunque se llame antes de que termine de cargar). Listeners de mouse se registran/limpian igual que los de teclado. Si no había `restart()` original, se agrega desde cero siguiendo el mismo criterio que los otros casos (reset de estado + relanzar loop). Sonido queda fuera de alcance salvo que el usuario lo pida explícitamente (documentarlo en "No incluye" si se omite). |

Común a los tres casos, sin excepción: canvas + `requestAnimationFrame` + variable `score` explícita + estado que hoy vive en globales de script y pasa a vivir en el closure de la factory.

---

## Fase 1 — Contexto

Antes de preguntar nada:

1. Lee `CLAUDE.md` y `AGENTS.md` del repo (ya cargados como contexto de proyecto si este skill corre dentro de Claude Code).
2. `ls specs/` para ver la numeración existente y calcular el próximo `NN` (contiguo al último spec).
3. Lee `specs/05-asteroides.md`, `specs/06-tabla-juegos-supabase.md` y `specs/07-leaderboard-real.md` como specs canónicos de este patrón — su nivel de detalle (Alcance/Modelo de datos/Plan/Criterios/Decisiones/Riesgos) es el estándar a igualar.
4. Verifica si `lib/games/registry.ts` ya existe (`Glob`/`Grep`) — determina si el plan incluye el refactor del dispatcher o solo una entrada nueva (punto 3 de la arquitectura).
5. Si `$ARGUMENTS` nombra o sugiere una carpeta de `references/ClaudeCodeCourseGames/` (ej. `tetris`, `03-tetris`, `arkanoid`), localízala, lee su `game.js`, `index.html` y `CLAUDE.md`/`README.md` si existen, y clasifícala en el caso A/B/C de la tabla de arriba antes de pasar a preguntas — así las preguntas de la Fase 2 ya llegan con contexto concreto en vez de genérico.
6. Si `$ARGUMENTS` viene vacío o no coincide con ninguna carpeta de referencia, no asumas origen — pregúntalo explícitamente en la Fase 2 (el juego puede diseñarse desde cero, sin partir de `references/`).

## Fase 2 — Preguntas de aclaración

Igual que `/spec`: bloques de 3 a 5 preguntas, esperando respuesta antes de continuar, en el mismo idioma del prompt inicial. Cubre como mínimo estas categorías (agrupa/omite según lo que ya se dedujo en la Fase 1):

**Origen del juego** (si no quedó resuelto en Fase 1):

- ¿Parte de una carpeta de `references/ClaudeCodeCourseGames/`, o se diseña desde cero?
- Si es desde cero: ¿hay una descripción del gameplay, o el skill debe proponer una mecánica simple basada en la categoría elegida?

**Identidad de catálogo:**

- `id` (slug en español, kebab-case, consistente con `asteroides`) y `title` (MAYÚSCULAS).
- `cat`: `ARCADE` | `PUZZLE` | `SHOOTER` | `VERSUS`.
- `color`: `cyan` | `magenta` | `yellow` | `green` (evitar el mismo color que juegos ya en Supabase, hoy solo `asteroides`/`cyan`, salvo que el usuario lo pida).
- `best`/`plays` decorativos (mismo criterio que specs anteriores: valores fijos, no se sincronizan con datos reales).
- Copy `short` (una frase) y `long` (un párrafo) en español, fiel al gameplay real del motor portado — sin inventar mecánicas que no existan.

**Motor** (usa la clasificación de caso A/B/C ya hecha en Fase 1, o determínala aquí si el juego es desde cero):

- Dimensiones de canvas (uno o más).
- Controles: solo teclado, o también mouse.
- ¿El HUD se dibuja en canvas o se expone como estado de React? (relevante sobre todo en caso B).
- ¿Hay mecánica de pausa real? (el motor de asteroides no la tiene; si el juego origen sí, decidir si se preserva).
- Assets externos (imágenes/sonido) — ¿se portan tal cual, se omiten, o se rehacen? (relevante en caso C).

**Cover art:**

- Concepto visual para `.cover-<slug>`, distinto de los covers existentes.

**Confirmaciones de integración** (para que queden explícitas en el spec, no asumidas):

- Confirmar que el leaderboard es automático (punto 6) y no requiere trabajo adicional.
- Confirmar si este spec asume el refactor del registry (primera vez) o solo agrega una entrada.

Sigue las mismas reglas de `/spec` para formular preguntas: concretas, con 2–4 opciones cuando corresponda marcando la recomendación, y señalando si alguna respuesta abre alcance de otro spec (ej. "sonido/multijugador" → fuera de este spec).

**Cuándo parar de preguntar:** cuando puedas responder sin asumir nada:

1. ¿Qué archivos van a aparecer o cambiar? (los 6 puntos de integración, resueltos con nombres concretos)
2. ¿Cuál es el primer paso ejecutable y cuál el último?
3. ¿Cómo se verifica que el juego quedó jugable end-to-end, con leaderboard real?

## Fase 3 — Construir el spec sección por sección

Sigue la estructura y el nivel de detalle de `specs/05-asteroides.md`/`06-tabla-juegos-supabase.md`/`07-leaderboard-real.md` (que ya están implementados y sirven de gold standard para este repo), no la plantilla genérica en inglés — este repo usa header en bullets (`- **Estado:** / **Dependencias:** / **Fecha:** / **Objetivo:**`), secciones `## Alcance` (**Incluye**/**No incluye**), `## Modelo de datos`, `## Plan de implementación`, `## Criterios de aceptación`, `## Decisiones tomadas y descartadas`, `## Riesgos identificados`.

Orden estricto, una sección a la vez, mostrada y confirmada antes de seguir:

1. **Header** — estado `Draft`, dependencias (spec 06 siempre, spec 07 si el juego necesita leaderboard —siempre lo necesita—, y cualquier spec de juego anterior si ya existe el registry), fecha, objetivo en una sola frase.
2. **Alcance** — Incluye/No incluye, con los 6 puntos de integración explícitos en "Incluye" y cualquier cosa fuera de foco (sonido, pausa real, mobile, etc.) explícita en "No incluye".
3. **Modelo de datos** — el `insert` SQL de la fila `games` (punto 4), la firma de `create<Nombre>Game`/`<Nombre>Handle` (punto 1), y si aplica el snippet del registry (punto 3).
4. **Plan de implementación** — pasos numerados, cada uno dejando el sistema funcional. Cubre en orden: motor → componente → (refactor del registry si aplica, o entrada nueva) → migración SQL de la fila → cover CSS → verificación end-to-end. Menciona explícitamente que el leaderboard no requiere paso propio (punto 6).
5. **Criterios de aceptación** — checklist booleana, siguiendo el estilo de los specs 05-07 (build/lint, aparición en biblioteca/detalle/salón de la fama, controles funcionando, guardado de puntuación real, limpieza de listeners al desmontar).
6. **Decisiones tomadas y descartadas** — con foco en las decisiones específicas de motor (caso A/B/C, HUD en canvas vs React, registry nuevo vs existente).
7. **Riesgos identificados** — como mínimo: listeners/RAF no limpiados al desmontar (mismo riesgo que el spec 05), y cualquier riesgo propio del caso de motor (ej. carga async de assets en caso C).

Reglas heredadas de `/spec`, sin excepción: no generar el spec completo de una — sección por sección, con confirmación; no poner en el plan nada fuera del alcance acordado; no asumir nombres de archivo o decisiones no confirmadas por el usuario.

## Fase 4 — Guardar

1. Confirma el número `NN` (calculado en Fase 1) y el slug con el usuario antes de escribir.
2. Crea `specs/NN-<slug>.md` con las secciones aprobadas, estado `Draft`.
3. No marques el spec como `Aprobado` — eso lo hace el usuario tras releerlo.
4. Confirma al usuario:
   - Ruta del archivo creado.
   - Recordatorio: el spec está en `Draft`; cambiarlo a `Aprobado` antes de implementarlo.
   - Próximo paso: `/spec-impl NN-<slug>` para implementarlo (creará su propia rama `spec-NN-<slug>`).
5. **Detente ahí.** No propongas implementar el spec, escribir código, ni tocar Supabase en esta misma corrida.

## Reglas duras

- **Nunca escribas código durante este comando.** Solo el `.md` del spec al final.
- **Nunca propongas implementar el spec después de guardarlo.** Eso es trabajo de `/spec-impl`.
- **Nunca asumas decisiones que el usuario no confirmó** (slug, categoría, color, caso de motor, si el registry ya existe) — pregunta.
- **Nunca generes el spec completo en una sola respuesta.** Sección por sección, con confirmación.
- **Nunca omitas alguno de los 6 puntos de integración sin justificarlo explícitamente** en el spec (típicamente en "No incluye" o en Riesgos) — es la garantía de que el juego no queda a medio integrar.
