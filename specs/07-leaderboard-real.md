# Spec 07 — Leaderboard real

- **Estado:** Implementado
- **Dependencias:** Spec 04 — Supabase setup (clientes `lib/supabase/client.ts`/`server.ts`). Spec 06 — Tabla de juegos en Supabase, en su alcance reducido: la tabla `games` hoy solo contiene `asteroides`, así que el FK `scores.game_id references games(id)` solo admite puntuaciones para ese juego; este spec hereda esa limitación sin intentar ampliarla. Reutiliza el patrón Server Component + Client Component que el spec 06 establece en `/salon-de-la-fama`. Reemplaza el comportamiento mock de Spec 01 (`seededScores`, `av_scores` en `localStorage`) en `/salon-de-la-fama` y `/juego/[id]`; no modifica el login simulado (`av_user`) de Spec 01/04.
- **Fecha:** 2026-07-22
- **Objetivo:** Reemplazar el leaderboard mock (`seededScores`) y el guardado de puntuaciones en `localStorage` por persistencia real en una tabla `scores` de Supabase, mostrando el mejor puntaje por jugador tanto en `/salon-de-la-fama` como en el detalle de cada juego (`/juego/[id]`). Dado el alcance reducido del spec 06, en la práctica esto hoy solo es observable para **Asteroides** — el único juego con un `id` en la tabla `games` y por lo tanto el único alcanzable vía `/juego/[id]` (los demás dan `notFound()` antes de llegar al leaderboard).

## Alcance

**Incluye:**

- Migración SQL en Supabase que crea la tabla `scores` (`game_id` FK a `games.id`, `player_name`, `score`, `created_at`), una vista `best_scores` que resuelve "mejor puntaje por jugador y juego", y políticas RLS: `SELECT` pública y `INSERT` pública (sin auth), sin `UPDATE`/`DELETE`.
- Nuevo módulo `lib/scores.ts` con:
  - `getTopScores(gameId, limit)` (server-only) — top N filas de `best_scores` para un juego, usado en `/juego/[id]`.
  - `getAllTopScores(limit)` (server-only) — top N filas de `best_scores` para todos los juegos presentes en la tabla `games` de una sola pasada, usado en `/salon-de-la-fama`. Escrita de forma genérica (no asume una cantidad fija de juegos); hoy, con `games` conteniendo solo `asteroides`, devuelve un único grupo.
  - `saveScore(entry)` (client-safe, vía `lib/supabase/client.ts`) — `insert` en `scores`, reemplaza al `saveScore` actual de `lib/session.ts`.
- `lib/session.ts` pierde `SCORES_KEY`, `StoredScoreEntry`, `getScores` y `saveScore` (dead code hoy — nada lee `av_scores`). `av_user`/`useStoredUser`/`saveUser`/`clearUser` no cambian.
- `components/GamePlayer.tsx` y `components/AsteroidsGame.tsx`: el botón "GUARDAR PUNTUACIÓN" pasa a llamar al nuevo `saveScore` async, con estado intermedio "GUARDANDO..." (botón deshabilitado) y manejo de error con opción de reintentar si falla la inserción. Se actualizan **ambos** componentes (no solo `AsteroidsGame.tsx`) porque `lib/session.ts` pierde su `saveScore` viejo — dejar `GamePlayer.tsx` sin migrar rompería la build. En la práctica, la rama de `GamePlayer.tsx` (`app/juego/[id]/jugar/page.tsx` cuando `id !== "asteroides"`) es hoy inalcanzable vía routing porque el spec 06 hace que esos `id` devuelvan `notFound()` antes de llegar ahí; el cambio no se puede verificar jugando una partida real, solo por build/lint/revisión de código.
- `app/salon-de-la-fama/page.tsx` (Server Component de spec 06) trae `getAllTopScores(12)` una sola vez y se lo pasa a `HallOfFameClient`; el cambio de tab solo cambia qué array ya cargado se muestra, sin fetch adicional. Mismo layout visual (podio top 3 + tabla de 12), datos reales. Con un solo juego en `games` (spec 06), hoy solo existe un tab (Asteroides).
- "Tu mejor marca en {JUEGO}" en el Salón de la Fama busca, dentro de los datos ya cargados del juego activo, la fila cuyo `player_name` coincide exactamente (case-insensitive) con `av_user.name`.
- `app/juego/[id]/page.tsx` reemplaza `seededScores(id.length*17+3, 10)` por `getTopScores(id, 10)` (datos reales, top 10).
- Estado vacío: cuando un juego no tiene ninguna fila en `best_scores`, tanto `/salon-de-la-fama` (para ese tab) como `/juego/[id]` muestran "SIN PUNTUACIONES TODAVÍA. ¡SÉ EL PRIMERO!" en vez de podio/tabla.

**No incluye:**

- Autenticación real / cuentas de usuario — el login sigue siendo el mismo simulado (`av_user` en `localStorage`).
- Migrar retroactivamente las puntuaciones que ya existan en `av_scores` (`localStorage`) de cada navegador — se arranca desde cero en Supabase; los datos viejos de `localStorage` quedan huérfanos (no se leen ni se borran).
- Validación anti-fraude o anti-cheat (límites de score, rate limiting, CAPTCHA) — riesgo aceptado y documentado, no mitigado en este spec.
- Perfil de jugador, historial de partidas propias, o cualquier UI nueva más allá del podio/tabla/"tu mejor marca" ya existentes.
- Cambios a los motores de juego o a la estética del CRT/HUD.
- Paginación o "ver más" del leaderboard — se mantiene fijo en top 12 (salón) / top 10 (detalle), igual que hoy.
- Actualización en vivo (realtime) del leaderboard mientras la página está abierta — se recarga solo al entrar/navegar de nuevo (Server Component sin suscripción).

## Modelo de datos

**Tabla `scores` (Supabase, migración SQL):**

```sql
create table public.scores (
  id bigint generated always as identity primary key,
  game_id text not null references public.games(id),
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default now()
);

alter table public.scores enable row level security;

create policy "scores are publicly readable"
  on public.scores for select
  to anon, authenticated
  using (true);

create policy "anyone can save a score"
  on public.scores for insert
  to anon, authenticated
  with check (true);

create index scores_game_id_score_idx on public.scores (game_id, score desc);
```

**Vista `best_scores`** — resuelve "mejor puntaje por jugador y juego" (dedup por nombre, case-insensitive):

```sql
create view public.best_scores as
select distinct on (game_id, lower(player_name))
  game_id,
  player_name,
  score,
  created_at
from public.scores
order by game_id, lower(player_name), score desc, created_at desc;
```

**Vista `ranked_scores`** — agrega el ranking dentro de cada juego, para poder traer el top N de los 9 juegos en una sola query:

```sql
create view public.ranked_scores as
select
  game_id,
  player_name,
  score,
  created_at,
  row_number() over (partition by game_id order by score desc, created_at desc) as rank
from public.best_scores;
```

**Limpieza en `lib/data.ts`:** al migrar `/salon-de-la-fama` y `/juego/[id]` a datos reales, `seededScores` y `PLAYERS` quedan sin ningún consumidor — se eliminan. Se conserva la interfaz `ScoreRow` (la sigue usando `lib/scores.ts` para el shape de retorno).

**Nuevo módulo `lib/scores.ts`:**

```ts
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { ScoreRow } from "@/lib/data";

function toScoreRow(
  row: { player_name: string; score: number; created_at: string },
  rank: number,
): ScoreRow {
  return {
    rank,
    name: row.player_name,
    score: row.score,
    date: new Date(row.created_at).toLocaleDateString("es-ES"),
  };
}

// server-only — usado en app/juego/[id]/page.tsx
export async function getTopScores(
  gameId: string,
  limit = 10,
): Promise<ScoreRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("best_scores")
    .select("player_name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((row, i) => toScoreRow(row, i + 1));
}

// server-only — usado en app/salon-de-la-fama/page.tsx, una sola query para todos los juegos de la tabla `games` (hoy, solo asteroides)
export async function getAllTopScores(
  limit = 12,
): Promise<Record<string, ScoreRow[]>> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("ranked_scores")
    .select("game_id, player_name, score, created_at, rank")
    .lte("rank", limit)
    .order("game_id")
    .order("rank");
  if (error) throw error;

  const byGame: Record<string, ScoreRow[]> = {};
  for (const row of data) {
    (byGame[row.game_id] ??= []).push(toScoreRow(row, row.rank));
  }
  return byGame;
}

// client-safe — reemplaza al saveScore actual de lib/session.ts
export async function saveScore(entry: {
  game: string;
  score: number;
  name: string;
}): Promise<void> {
  const supabase = createBrowserClient();
  const { error } = await supabase.from("scores").insert({
    game_id: entry.game,
    player_name: entry.name,
    score: entry.score,
  });
  if (error) throw error;
}
```

## Plan de implementación

1. **Migración SQL** — Crear la tabla `scores`, sus políticas RLS (`SELECT`/`INSERT` públicas), el índice `scores_game_id_score_idx` y las vistas `best_scores`/`ranked_scores` (`mcp_supabase apply_migration`). Verificar con `list_tables` que existen la tabla y ambas vistas.

2. **Módulo `lib/scores.ts`** — Crear `getTopScores`, `getAllTopScores` y `saveScore` según el modelo de datos.

3. **Limpiar `lib/session.ts` y `lib/data.ts`** — Quitar `SCORES_KEY`, `StoredScoreEntry`, `getScores` y el `saveScore` viejo de `lib/session.ts`; quitar `seededScores` y `PLAYERS` de `lib/data.ts` (sin consumidores tras este spec).

4. **Actualizar `components/GamePlayer.tsx`** — Reemplazar el import y la llamada a `saveScore` por el nuevo módulo `lib/scores.ts`; agregar estado `saving`/`saveError`, deshabilitar el botón y mostrar "GUARDANDO..." mientras la promesa está pendiente, y un mensaje de error con botón "REINTENTAR" si falla.

5. **Actualizar `components/AsteroidsGame.tsx`** — Mismo patrón que el paso 4 (estado `saving`/`saveError`, "GUARDANDO...", reintento).

6. **Actualizar `app/juego/[id]/page.tsx`** — Reemplazar `seededScores(id.length*17+3, 10)` por `await getTopScores(id, 10)`; si el array es vacío, renderizar el mensaje "SIN PUNTUACIONES TODAVÍA. ¡SÉ EL PRIMERO!" en vez de la tabla de leaderboard.

7. **Actualizar `app/salon-de-la-fama/page.tsx` y `HallOfFameClient.tsx`** (de spec 06) — El Server Component llama también a `getAllTopScores(12)` y pasa el mapa `Record<gameId, ScoreRow[]>` a `HallOfFameClient`; el componente cliente deja de usar `seededScores`, lee del mapa recibido según el tab activo, muestra el estado vacío por juego cuando corresponda, y ajusta "tu mejor marca" para buscar la fila cuyo `name` coincide exactamente (case-insensitive) con `av_user.name` dentro de los datos ya cargados del juego activo (o no mostrar la sección si no hay coincidencia).

8. **Verificación end-to-end** — Jugar una partida en ASTEROIDES (real, único juego alcanzable con el alcance reducido del spec 06), guardar la puntuación y confirmar la secuencia "GUARDANDO..." → "GUARDADO"; recargar `/juego/asteroides` y `/salon-de-la-fama` y confirmar que la puntuación aparece en el leaderboard real; verificar el estado vacío antes de guardar la primera puntuación; forzar un error de guardado (ej. cortando la conexión) y confirmar el mensaje de error con reintento; confirmar por build/lint (no hay ruta accesible para probarlo jugando) que `components/GamePlayer.tsx` compila contra el nuevo `saveScore`; correr `npm run build` y `npm run lint`.

## Criterios de aceptación

- [ ] La migración crea la tabla `public.scores` con RLS habilitado, política de `SELECT` pública, política de `INSERT` pública, y las vistas `best_scores`/`ranked_scores`.
- [ ] `lib/scores.ts` exporta `getTopScores(gameId, limit)`, `getAllTopScores(limit)` y `saveScore(entry)` con el comportamiento descrito en el modelo de datos.
- [ ] `lib/session.ts` ya no exporta `getScores`, `saveScore`, `StoredScoreEntry` ni `SCORES_KEY`; `av_user`/`useStoredUser`/`saveUser`/`clearUser` siguen funcionando sin cambios.
- [ ] `lib/data.ts` ya no exporta `seededScores` ni `PLAYERS`; `ScoreRow` sigue disponible.
- [ ] Guardar una puntuación en `GamePlayer.tsx` o `AsteroidsGame.tsx` inserta una fila real en la tabla `scores` (verificable con una query o con `list_tables`/`execute_sql`).
- [ ] Mientras se guarda una puntuación, el botón muestra "GUARDANDO..." y queda deshabilitado; si la inserción falla, se muestra un mensaje de error con opción de reintentar.
- [ ] `/juego/[id]` muestra el top 10 real (`getTopScores`) en vez del mock `seededScores`, con el mismo formato visual que antes.
- [ ] `/salon-de-la-fama` muestra, para cada tab disponible (hoy, solo Asteroides, según el alcance reducido del spec 06), el podio (top 3) y la tabla (top 12) con datos reales de `getAllTopScores`, sin disparar un fetch nuevo al cambiar de tab.
- [ ] "Tu mejor marca en {JUEGO}" aparece solo si existe una fila cuyo `name` coincide (case-insensitive) con `av_user.name` dentro de los datos ya cargados de ese juego; si no hay coincidencia, la sección no se muestra.
- [ ] Un juego sin ninguna puntuación real muestra "SIN PUNTUACIONES TODAVÍA. ¡SÉ EL PRIMERO!" tanto en `/salon-de-la-fama` (ese tab) como en `/juego/[id]`.
- [ ] Dos jugadores que guardan el mismo nombre para el mismo juego aparecen como una sola fila en el leaderboard (la de mayor puntaje), consistente con la vista `best_scores`.
- [ ] `npm run build` completa sin errores.
- [ ] `npm run lint` no reporta errores.

## Decisiones tomadas y descartadas

- **Mejor puntaje por jugador, no historial completo (tomada).** La vista `best_scores` deduplica por `game_id` + `player_name` (case-insensitive), quedándose con el score más alto. _Descartada:_ mostrar cada partida como fila independiente, que hubiera permitido que un mismo jugador ocupe varios puestos del top con distintos intentos.

- **Mismo formato visual (podio + tabla de 12) (tomada).** Solo cambia la fuente de datos; no se toca el diseño de `/salon-de-la-fama`. _Descartada:_ cambiar la cantidad de filas mostradas, sin necesidad real de hacerlo.

- **Sin validación anti-fraude, riesgo aceptado (tomada).** Como no hay Supabase Auth todavía, cualquiera con la clave pública podría insertar puntuaciones directo contra la API. Es el mismo nivel de "seguridad" que ya existe hoy (cualquiera podía editar `localStorage` manualmente), solo que ahora es una tabla compartida y visible para todos. _Descartada:_ agregar un `CHECK` de rango de score, que hubiera sido una mitigación parcial sin abordar el problema real (falta de autenticación).

- **Estado de carga y error en el guardado (tomada).** `saveScore` pasa de síncrono (`localStorage`) a una llamada de red real; el modal necesita reflejar eso. _Descartada:_ mantener el modal optimista (pasar a "GUARDADO" al instante), que podía mostrar éxito falso si la inserción fallaba silenciosamente.

- **"Tu mejor marca" por coincidencia exacta de nombre (tomada).** Consistente con que el login sigue siendo solo un nombre en `localStorage`, sin identidad única. _Descartada:_ quitar la sección, que hubiera sido más "correcta" pero elimina una funcionalidad visible ya existente sin necesidad, dado que el spec acepta esta limitación explícitamente.

- **Fetch único server-side para las 9 tabs del Salón de la Fama (tomada).** `getAllTopScores` trae el top de los 9 juegos en una sola query (vía la vista `ranked_scores`), evitando fetches y loading states al cambiar de tab. _Descartada:_ fetch client-side por tab, más simple de escribir pero con peor UX (loading visible en cada cambio de tab).

- **Migrar también el leaderboard de `/juego/[id]` (tomada).** Misma tabla de datos, mismo criterio; evita dejar un mock a medio migrar. _Descartada:_ dejarlo mock por ahora, que hubiera dejado la app en un estado inconsistente (datos reales en un lado, mock en otro).

- **Actualizar `components/GamePlayer.tsx` aunque su rama sea hoy inalcanzable vía routing (tomada).** Como `lib/session.ts` pierde su `saveScore` viejo (limpieza de código muerto ya decidida en este spec), dejar `GamePlayer.tsx` sin migrar rompería la build; además mantener dos implementaciones paralelas de guardado (una vieja en `localStorage` solo para `GamePlayer.tsx`, otra nueva en Supabase para `AsteroidsGame.tsx`) sería peor que migrar ambas al mismo patrón. _Descartada:_ dejar `GamePlayer.tsx` con el `saveScore` viejo de `lib/session.ts` (sin eliminarlo de ahí), que hubiera evitado tocar código inalcanzable pero a costa de reintroducir el código muerto que este spec busca eliminar.

- **Estado vacío explícito quitando podio/tabla (tomada).** Mensaje claro en vez de celdas vacías cuando un juego no tiene puntuaciones reales todavía (todos empiezan en cero tras esta migración). _Descartada:_ mostrar podio/tabla vacíos sin aviso, que se hubiera visto como un bug.

- **Limpieza de `seededScores`/`PLAYERS` en `lib/data.ts` (tomada).** Al migrar ambos consumidores (`/salon-de-la-fama` y `/juego/[id]`) a datos reales, ese código queda sin ningún uso. _Descartada:_ dejarlo sin usar "por si acaso", en contra de la práctica de no dejar código muerto en el repo.

## Riesgos identificados

- **Sin autenticación, cualquiera puede insertar puntuaciones falsas o suplantar nombres.** La política de `INSERT` es pública (`with check (true)`), así que cualquiera con la clave pública puede escribir directo contra la API, inflando el ranking o usando el nombre de otro jugador. _Mitigación:_ aceptado como límite conocido de este spec (documentado y decidido explícitamente); un spec futuro con Supabase Auth real podría restringir el `INSERT` a usuarios autenticados y atar `player_name` a la identidad de la sesión.

- **Dependencia dura de la tabla `games` (spec 06), hoy limitada a una sola fila.** El FK `scores.game_id references games(id)` requiere que la migración del spec 06 ya esté aplicada; si no lo está, la migración de este spec falla. Además, con el alcance reducido del spec 06 (`games` solo contiene `asteroides`), este FK en la práctica solo admite puntuaciones para ese juego — no es un problema nuevo de este spec, es una consecuencia directa y esperada del spec 06. _Mitigación:_ este spec no se implementa (`/spec-impl`) antes de que el spec 06 esté aprobado e implementado; cuando un spec futuro amplíe `games` con más juegos, este spec no necesita cambios — `getAllTopScores`/`getTopScores`/`saveScore` ya están escritos de forma genérica.

- **`components/GamePlayer.tsx` migrado a Supabase pero no verificable end-to-end.** Su rama en `app/juego/[id]/jugar/page.tsx` es hoy inalcanzable (cualquier `id !== "asteroides"` da `notFound()` antes de llegar ahí, por el spec 06), así que la integración con el nuevo `saveScore` solo puede confirmarse por build/lint y revisión de código, no jugando una partida real. _Mitigación:_ aceptado como límite conocido; cuando un spec futuro reincorpore más juegos a la tabla `games`, ese spec debe agregar la verificación end-to-end de `GamePlayer.tsx` que hoy no es posible.

- **Degradación de performance en `best_scores`/`ranked_scores` a medida que crece `scores`.** `DISTINCT ON` y `row_number()` recorren toda la tabla por juego; con volúmenes altos de partidas podría volverse lento. _Mitigación:_ el índice `scores_game_id_score_idx` cubre el patrón de acceso actual (filtrar/ordenar por `game_id` + `score`); optimizar más (ej. materializar la vista) solo si se detecta lentitud real, fuera de alcance de este spec.
