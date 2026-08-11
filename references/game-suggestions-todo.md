# Sugerencias de juegos — Arcade Vault

Bitácora del agente `game-planner` (`.claude/agents/game-planner.md`).
Se lee **antes** de proponer cualquier juego nuevo y se actualiza al final de cada corrida.
Catálogo ya implementado: [`implemented-games.md`](implemented-games.md).

## Índice de veredictos

| Veredicto      | Significado                                                   |
| -------------- | ------------------------------------------------------------- |
| `Recomendado`  | Ganador de su corrida; pendiente de que el usuario lo apruebe |
| `Alternativa`  | Quedó 2º o 3º; sigue siendo válido para corridas futuras      |
| `Descartado`   | El usuario lo rechazó — no volver a proponerlo                |
| `Implementado` | Ya está en el catálogo (con su número de spec)                |

## Estado de sugerencias

Vista rápida de todo lo propuesto hasta ahora. Es lo primero que consulta el agente.

| Juego       | Slug          | Categoría | Veredicto     | Corrida | Razón (1 línea)                                                                  |
| ----------- | ------------- | --------- | ------------- | ------- | -------------------------------------------------------------------------------- |
| DUELO PIXEL | `duelo-pixel` | VERSUS    | `Recomendado` | 1       | Única categoría vacía + el porteo más barato; score resuelto como rally endless. |
| INVASORES   | `invasores`   | SHOOTER   | `Alternativa` | 1       | Score natural impecable, pero repite SHOOTER y se parece mucho a `asteroides`.   |
| RANARIA     | `ranaria`     | ARCADE    | `Alternativa` | 1       | Mecánica de esquivar nueva, pero ARCADE ya tiene dos juegos y cuesta más.        |

## Historial de corridas

Razonamiento completo de cada corrida. Se agrega al final, nunca se reescribe ni se resume.

<!-- Plantilla de una corrida — copiar y llenar:

### Corrida N — YYYY-MM-DD

**Catálogo al momento:** …
**Huecos detectados:** …
**Shortlist:** 1) … 2) … 3) …
**Recomendado:** … — porque …
**Resolución del usuario:** _(pendiente)_

-->

### Corrida 1 — 2026-08-10

**Catálogo al momento:** 4 juegos reales con motor en `lib/games/` y fila en `games` — `asteroides` (SHOOTER, `cyan`, spec 05), `tetris` (PUZZLE, `green`, spec 08), `arkanoid` (ARCADE, `magenta`, spec 09), `serpiente` (ARCADE, `yellow`, spec 10). Próximo `sort_order`: 5. Próximo spec: 11.

**Huecos detectados:**

- **Categorías:** ARCADE 2 · PUZZLE 1 · SHOOTER 1 · **VERSUS 0** ← único hueco duro.
- **Colores:** los cuatro tomados; el quinto juego repite uno por fuerza, así que se elige el del juego visualmente más distinto.
- **Mecánica:** ya cubiertos teclado (3) y mouse (1), tiempo real continuo (2) y grilla por tick (2), endless (3) y niveles finitos (1). Sin cubrir: duelo 1v1 contra oponente/IA, oleadas estructuradas, gravedad/plataformas.
- **Material portable:** agotado. Las tres carpetas de `references/ClaudeCodeCourseGames/` (`02-asteroids`, `03-tetris`, `04-arkanoid`) y `references/source-assets/snake-assets/` ya están consumidas. Todos los candidatos de esta corrida son desde cero, como `serpiente`.
- **Leaderboard:** `scores.score` entero y monótono; el riesgo está en VERSUS, que no tiene score creciente natural.

**Shortlist:**

1. **DUELO PIXEL — `duelo-pixel`** · VERSUS / `green` · Pong contra CPU que acelera. Puntúa como rally endless (+10 por devolución, +100 por punto anotado; termina cuando la CPU saca 3 puntos), lo que convierte un juego sin score en uno monótono. Desde cero, caso A, sin assets. A favor: tapa la única categoría vacía, introduce IA oponente, el más barato. En contra: rebote parecido a `arkanoid` (de ahí `green` y no `magenta`), score por convención inventada. Costo: **bajo**.
2. **INVASORES — `invasores`** · SHOOTER / `yellow` · Oleadas que bajan + búnkeres destructibles. Score natural por fila de enemigo y bonus de oleada. Desde cero, caso A. A favor: el mejor encaje con el leaderboard, estructura de oleadas nueva. En contra: repite SHOOTER y comparte nave/proyectiles/canvas negro con `asteroides`; los búnkeres destructibles suben el costo. Costo: **medio**.
3. **RANARIA — `ranaria`** · ARCADE / `cyan` · Cruzar carriles de autos y troncos con tiempo límite. Score por carril, por rana llegada y bonus de tiempo. Desde cero, caso A. A favor: esquivar-sin-disparar no existe en el catálogo, híbrido grilla + tiempo real. En contra: ARCADE ya tiene dos, movimiento por grilla emparentado con `serpiente`, colisión sobre troncos es la lógica más enredada de los tres. Costo: **medio-alto**.

`duelo-pixel`, `invasores` y `ranaria` existen como maquetas sin motor en el array `GAMES` de `lib/data.ts` (DUELO PIXEL, INVASORES, RANARIA): aportan nombre y slug, pero **no hay código reutilizable detrás**.

**Recomendado:** **DUELO PIXEL** — porque es el único que cierra el hueco duro de categoría (VERSUS vacía) y a la vez el más barato de construir. INVASORES tiene mejor score natural pero refuerza SHOOTER y se parece demasiado a `asteroides`; RANARIA diversifica la mecánica pero engorda ARCADE y cuesta más. Su único problema real —el score— tiene solución concreta y se cierra en el spec.

**Resolución del usuario:** _(pendiente)_
