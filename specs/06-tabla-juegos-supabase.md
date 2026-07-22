# Spec 06 — Tabla de juegos en Supabase

- **Estado:** Aprobado
- **Dependencias:** Spec 04 — Supabase setup (usa `lib/supabase/server.ts` para el cliente de lectura). Modifica el comportamiento de Spec 01 (las páginas dejan de leer el array `GAMES` que ese spec introdujo, aunque el array se conserva en el código sin consumidores) y de Spec 05 (la entrada `asteroides` pasa a vivir en la tabla en vez del array). No depende del Spec 07 (leaderboard) — al contrario, el 07 dependerá de este.
- **Fecha:** 2026-07-22
- **Objetivo:** Migrar **solo el juego `asteroides`** de `GAMES` (`lib/data.ts`) a una tabla `games` en Supabase, con lectura pública desde Server Components. Las interfaces públicas (home, biblioteca, salón de la fama, detalle/juego) pasan a mostrar únicamente el juego migrado; los otros 8 juegos quedan en `GAMES` como referencia sin consumidores, a la espera de una migración incremental futura.

## Alcance

**Incluye:**

- Migración SQL en Supabase (vía `mcp_supabase apply_migration`) que crea la tabla `games` con columnas equivalentes a la interfaz `Game` actual (`id` como PK de texto, `title`, `short`, `long`, `cat`, `cover`, `color`, `best`, `plays`), y en la misma migración inserta **una única fila**: `asteroides`.
- Política RLS de solo lectura pública (`SELECT` para el rol `anon`/`authenticated`) sobre `games`; sin políticas de `INSERT`/`UPDATE`/`DELETE` — cualquier alta/edición de un juego se hace directo en Supabase (SQL Editor o una nueva migración), fuera de la app.
- Nuevo módulo `lib/games.ts` (server-only) con funciones de acceso a datos, ej. `getGames(): Promise<Game[]>` y `getGame(id: string): Promise<Game | null>`, usando `createClient()` de `lib/supabase/server.ts`. Estas funciones consultan **solo** la tabla `games`; no combinan resultados con el array `GAMES`.
- `lib/data.ts` pierde la entrada `asteroides` de `GAMES` (quedan los otros 8 juegos) — el array deja de tener consumidores en la app tras este spec, pero se conserva en el código como referencia para migrar el resto de juegos en specs futuros. Se conserva la interfaz `Game`, `GameCategory`, `CATS`, `PLAYERS`, `ScoreRow` y `seededScores` (siguen usándose para el leaderboard mock hasta el spec 07).
- Conversión de las páginas que hoy importan `GAMES` para que lean de Supabase vía `lib/games.ts`, mostrando únicamente lo que la tabla devuelve (hoy, un solo juego):
  - `app/juego/[id]/page.tsx` y `app/juego/[id]/jugar/page.tsx` — ya son Server Components async; solo cambia la fuente de datos (`getGame(id)` en vez de `GAMES.find`). Cualquier `id` que no sea `asteroides` resulta en `notFound()`, aunque siga existiendo en `GAMES`.
  - `app/page.tsx` y `app/biblioteca/page.tsx` — se dividen en un Server Component (`page.tsx`, hace `getGames()`) que pasa los datos a un nuevo Client Component (ej. `HomeClient.tsx`, `BibliotecaClient.tsx`) que conserva toda la interactividad actual (router, filtros, `useReveal`) sin cambios de comportamiento. Al recibir un array de 1 elemento, el mini-rail de home y la grilla de biblioteca muestran únicamente Asteroides; el filtro por categoría de biblioteca sigue funcionando igual, solo que la mayoría de categorías quedan vacías.
  - `app/salon-de-la-fama/page.tsx` — misma división: un Server Component obtiene la lista de juegos (para los tabs) y se la pasa a un Client Component con el resto de la lógica actual (`useState` del tab activo, `seededScores`, `useStoredUser`) intacta. Con un solo juego disponible, solo existe el tab de Asteroides.
- Cualquier contador derivado de la cantidad de juegos (ej. stats de home) se calcula desde el array devuelto por `getGames()`, no está hardcodeado — hoy mostrará `1`.
- `components/GameCard.tsx`, `components/GamePlayer.tsx`, `components/AsteroidsGame.tsx` no cambian — siguen recibiendo `game: Game` como prop, con la misma forma de datos.

**No incluye:**

- Migrar los otros 8 juegos del array `GAMES` a Supabase — queda para un spec futuro que expanda la tabla `games` de forma incremental.
- Combinar/mezclar los datos de `GAMES` con los de Supabase en ninguna interfaz — las páginas migradas muestran exclusivamente lo que devuelve la tabla `games`.
- Eliminar el array `GAMES` de `lib/data.ts` — se conserva íntegro (menos `asteroides`) como referencia, aunque quede sin consumidores tras este spec.
- Migrar el leaderboard/puntuaciones a Supabase (`av_scores`, `saveScore`, `/salon-de-la-fama` real) — es el spec 07, que dependerá de este.
- UI de administración para crear/editar/borrar juegos — se gestiona directo en Supabase por ahora.
- Fallback a datos estáticos (`GAMES`) si Supabase no responde o no encuentra un `id` — no hay merge ni fallback; si la tabla no responde, la página falla (se documenta como riesgo, no se mitiga en este spec).
- Cambios al valor o diseño de `cover`/`color` (clases CSS existentes) — se migran tal cual están hoy.
- Suscripciones en tiempo real a la tabla `games` — es contenido de referencia, no necesita actualizarse en vivo.
- Cambios a la lógica de los motores de juego (`lib/games/asteroids.ts`) o al simulador (`GamePlayer.tsx`).

## Modelo de datos

**Tabla `games` (Supabase, migración SQL):**

```sql
create table public.games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover text not null,
  color text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  best integer not null,
  plays text not null,
  sort_order integer not null
);

alter table public.games enable row level security;

create policy "games are publicly readable"
  on public.games for select
  to anon, authenticated
  using (true);
```

`sort_order` no forma parte de la interfaz TypeScript `Game` (no se selecciona en las queries) — se conserva en el esquema para no tener que agregarla en una migración futura cuando se sumen más juegos, aunque con una sola fila no afecta el orden visible hoy.

**Seed data (mismo archivo de migración) — solo `asteroides`:**

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, sort_order) values
('asteroides', 'ASTEROIDES', 'Dispara, esquiva y sobrevive entre rocas que se multiplican.', 'Tu nave triangular flota en un campo de asteroides sin bordes: todo lo que sale por un lado reaparece del otro. Rota, propulsa y dispara para partir rocas grandes en fragmentos cada vez más pequeños, sumando puntos por cada uno. Recolecta el power-up 3x para disparo triple temporal, y aprovecha los segundos de invencibilidad al reaparecer tras perder una vida.', 'SHOOTER', 'cover-asteroides', 'cyan', 63500, '9.8K', 1)
on conflict (id) do nothing;
```

**`lib/data.ts` — `GAMES` pierde la entrada `asteroides`, quedan los otros 8 juegos sin cambios de valores, sin consumidores en la app tras este spec (referencia para migraciones futuras).**

**Nuevo módulo `lib/games.ts` (server-only):**

```ts
import { createClient } from "@/lib/supabase/server";
import type { Game } from "@/lib/data";

const GAME_COLUMNS = "id, title, short, long, cat, cover, color, best, plays";

export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select(GAME_COLUMNS)
    .order("sort_order");
  if (error) throw error;
  return data;
}

export async function getGame(id: string): Promise<Game | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select(GAME_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
```

## Plan de implementación

1. **Migración SQL** — Crear la migración (`mcp_supabase apply_migration`) con la tabla `games`, la política RLS de lectura pública y el `insert` de la fila `asteroides`. Verificar con `list_tables` y una query de conteo que la tabla existe y tiene 1 fila.

2. **Capa de datos `lib/games.ts`** — Crear el módulo con `getGames()` y `getGame(id)` usando `createClient()` de `lib/supabase/server.ts`.

3. **Actualizar `lib/data.ts`** — Quitar la entrada `asteroides` de `GAMES` (quedan 8); conservar `Game`, `GameCategory`, `CATS`, `PLAYERS`, `ScoreRow`, `seededScores` tal como están. `GAMES` queda sin ningún import en el resto de la app tras este spec.

4. **Convertir páginas de detalle/juego** — `app/juego/[id]/page.tsx` y `app/juego/[id]/jugar/page.tsx`: reemplazar `GAMES.find(...)` por `await getGame(id)`, manteniendo `notFound()` si no existe (ahora también para cualquier `id` de los 8 juegos que quedaron solo en `GAMES`).

5. **Dividir `app/page.tsx`** — Nuevo `app/page.tsx` (Server Component, async) llama a `getGames()` y renderiza `<HomeClient games={games} />`; se crea `components/HomeClient.tsx` (`"use client"`) con todo el JSX/lógica actual (hero, features, mini-rail, stats, actividad, pricing) sin cambios de comportamiento. Con `games` de longitud 1, el mini-rail y los contadores reflejan solo Asteroides.

6. **Dividir `app/biblioteca/page.tsx`** — Mismo patrón: `page.tsx` (Server Component) llama a `getGames()` y renderiza `<BibliotecaClient games={games} />`; `components/BibliotecaClient.tsx` conserva el filtro por búsqueda/categoría (`useState`, `useMemo`) sin cambios de lógica, aunque la grilla ahora solo pueda mostrar Asteroides.

7. **Dividir `app/salon-de-la-fama/page.tsx`** — `page.tsx` (Server Component) llama a `getGames()` y renderiza `<HallOfFameClient games={games} />`; `components/HallOfFameClient.tsx` conserva el resto de la lógica actual (tabs, `seededScores`, `useStoredUser`) tal cual, solo recibiendo la lista de juegos por prop en vez de importar `GAMES`. Con un solo juego, solo existe un tab.

8. **Verificación end-to-end** — Recorrer `/` (hero, mini-rail muestra solo Asteroides, stats reflejan 1 juego), `/biblioteca` (grilla con solo Asteroides, filtro por categoría/búsqueda sigue operando), `/juego/asteroides` y `/juego/asteroides/jugar` (detalle y juego real siguen funcionando), `/juego/rocas` (u otro id de los 8 restantes: confirmar `notFound()`), `/salon-de-la-fama` (un único tab, Asteroides); correr `npm run build` y `npm run lint`.

## Criterios de aceptación

- [ ] La migración crea la tabla `public.games` con RLS habilitado y una política de `SELECT` pública (`anon`/`authenticated`).
- [ ] La tabla contiene exactamente 1 fila (`asteroides`) tras aplicar la migración, con los mismos valores (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `best`, `plays`) que la entrada `asteroides` original de `GAMES`.
- [ ] `lib/games.ts` exporta `getGames()` y `getGame(id)`, ambas funciones server-only que consultan solo la tabla `games` vía `lib/supabase/server.ts` (sin combinar con `GAMES`).
- [ ] `lib/data.ts` — `GAMES` ya no incluye la entrada `asteroides` (quedan los otros 8 juegos); el array no es importado por ninguna página tras este spec. El tipo `Game` y el resto de helpers (`CATS`, `PLAYERS`, `seededScores`) siguen disponibles sin cambios.
- [ ] `/` muestra el mismo hero y layout de siempre, con el mini-rail y los stats (`games.length`) reflejando únicamente el juego Asteroides.
- [ ] `/biblioteca` muestra únicamente Asteroides en la grilla; el filtro por búsqueda/categoría sigue funcionando (categorías sin resultados quedan vacías, sin romper la UI).
- [ ] `/juego/asteroides` y `/juego/asteroides/jugar` siguen funcionando igual que antes de la migración.
- [ ] `/juego/[id]` con cualquier `id` de los 8 juegos que quedaron solo en `GAMES` (ej. `/juego/rocas`) responde `notFound()`.
- [ ] `/salon-de-la-fama` muestra un único tab (Asteroides), con el resto de su comportamiento (podio, tabla, mock `seededScores`) sin cambios.
- [ ] `npm run build` completa sin errores.
- [ ] `npm run lint` no reporta errores.

## Decisiones tomadas y descartadas

- **Migración parcial de un solo juego (Asteroides) en vez del catálogo completo (tomada).** Reduce la superficie de este spec y permite validar el patrón de acceso a datos (tabla, RLS, `lib/games.ts`, división Server/Client Component) con un caso real antes de migrar el resto. _Descartada:_ migrar los 9 juegos de una (alcance original de este spec), mayor superficie de la que se pidió ahora.

- **`GAMES` se conserva en el código, sin consumidores, como referencia (tomada).** Preserva los datos de los 8 juegos restantes para una futura migración incremental sin tener que re-derivarlos desde otro lado. _Descartada:_ eliminar `GAMES` por completo, lo que hubiera perdido esa referencia y complicado expandir la tabla `games` más adelante.

- **Sin combinación de fuentes (Supabase + `GAMES`) en las interfaces (tomada).** Las páginas muestran únicamente lo que devuelve `getGames()`/`getGame()` (hoy, solo Asteroides), evitando lógica de merge que habría que descartar en cuanto se migren más juegos. _Descartada:_ combinar `GAMES` (8) + Supabase (1) para mantener el catálogo completo de 9 visible — es exactamente el comportamiento que este spec busca evitar por ahora.

- **`notFound()` para cualquier `id` que no esté en Supabase, aunque exista en `GAMES` (tomada).** Consistente con "no combinar fuentes"; simplifica `lib/games.ts` a solo consultar la tabla. _Descartada:_ hacer fallback a `GAMES.find(id)` si Supabase no lo encuentra, que reintroduce el merge descartado en el punto anterior.

- **Lectura vía Server Components (`lib/supabase/server.ts`) (tomada).** Sin loading spinners ni fetch client-side; requiere dividir `app/page.tsx`, `app/biblioteca/page.tsx` y `app/salon-de-la-fama/page.tsx` en un wrapper Server Component + un Client Component para la interactividad. _Descartada:_ fetch client-side manteniendo esas páginas 100% `"use client"`, más simple de escribir pero introduce estado de carga donde hoy no existe.

- **Seed data vía migración SQL versionada (tomada).** El `insert` de la fila `asteroides` vive en el mismo archivo de migración que crea la tabla, quedando versionado. _Descartada:_ cargar el dato con un script aparte o manualmente, por no quedar registrado en el historial de migraciones.

- **Sin UI de administración (CRUD) en este spec (tomada).** Solo lectura pública; alta/edición/borrado de un juego se hace directo en Supabase. _Descartada:_ agregar una pantalla de administración ahora, por ampliar considerablemente el alcance sin que el usuario lo haya pedido.

- **Contadores calculados dinámicamente desde `getGames()` (tomada).** Cualquier texto que hoy dependa de `GAMES.length` pasa a depender de la longitud real del array devuelto por Supabase (hoy, `1`). _Descartada:_ dejar contadores hardcodeados en `9`, que mostraría un número inconsistente con el catálogo real visible.

## Riesgos identificados

- **Regresión visible de contenido en producción.** El catálogo pasa de 9 juegos a 1 en todas las interfaces públicas (home, biblioteca, salón de la fama) hasta que se migren los juegos restantes. _Mitigación:_ aceptado como paso intermedio explícito hacia una migración incremental; se documenta como estado transitorio, no como bug.

- **Sin fallback si Supabase no responde.** Al no combinar con `GAMES`, cualquier caída o error de conexión con Supabase deja las páginas migradas sin datos (error no controlado en vez de contenido degradado). _Mitigación:_ aceptado como límite conocido de este spec — no se agrega manejo de error especial; si se vuelve un problema real, un spec futuro puede agregar un error boundary o página de error dedicada.

- **Enlaces o contenido hardcodeado a otros juegos.** Si algún componente aún referencia directamente un `id` distinto de `asteroides` (fuera del array `GAMES` ya desconectado), esa ruta resultará en `notFound()`. _Mitigación:_ revisar en el paso 8 del plan que no queden links visibles hacia otros juegos en las páginas migradas.

- **Drift de comportamiento al dividir Client Components en Server + Client.** `app/page.tsx`, `app/biblioteca/page.tsx` y `app/salon-de-la-fama/page.tsx` pasan de un solo archivo `"use client"` a dos archivos; un error al mover JSX/estado podría alterar sutilmente la interactividad actual (filtros, tabs, animaciones `reveal`). _Mitigación:_ mover el JSX y los hooks tal cual, sin reescribir lógica, y verificar visualmente cada página en el paso 8 del plan.

- **Particularidades de esta versión de Next.js con fetching en Server Components.** `AGENTS.md` advierte que esta versión (16.2.10) tiene diferencias de comportamiento (ej. caching de `fetch`) respecto a versiones previas/training data. _Mitigación:_ revisar `node_modules/next/dist/docs/01-app/` si el comportamiento de revalidación/caching de las queries a Supabase es inesperado, antes de improvisar una solución.
