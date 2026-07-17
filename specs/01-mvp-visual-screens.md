# Spec 01 — MVP Visual Screens

- **Estado:** Aprobado
- **Dependencias:** Ninguna (primer spec del proyecto)
- **Fecha:** 2026-07-16
- **Objetivo:** Implementar, solo a nivel visual, las 5 pantallas de Arcade Vault (biblioteca, detalle de juego, reproductor simulado, salón de la fama y autenticación) migrando los templates de referencia a componentes de Next.js App Router con TypeScript.

## Alcance

**Incluye:**
- Migración de los 5 templates de referencia (`references/resources/templates/`) a rutas y componentes de Next.js App Router:
  - Biblioteca (`biblioteca.jsx`) — grid de juegos con búsqueda y filtro por categoría.
  - Detalle de juego (`detalle.jsx`) — info del juego + tabla de mejores puntuaciones.
  - Reproductor (`reproductor.jsx`) — HUD simulado, pantalla CRT decorativa, modal de fin de partida con guardado de puntuación.
  - Salón de la Fama (`salon.jsx`) — podio + tabla de ranking por juego, con tabs.
  - Autenticación (`auth.jsx`) — login/registro simulado, invitado, botones sociales decorativos.
  - Navegación (`nav.jsx`) — navbar sticky + menú móvil, ambos ya wireados a las rutas reales.
- Migración del catálogo mock (`data.jsx`: `GAMES`, `CATS`, `PLAYERS`, `seededScores`) a un módulo TypeScript en `lib/`.
- Sesión de usuario simulada y puntuaciones guardadas persistidas en `localStorage`, replicando el comportamiento de `app.jsx`.
- Rutas en español: `/`, `/juego/[id]`, `/juego/[id]/jugar`, `/salon-de-la-fama`, `/login`.
- Página 404 (`notFound()`) cuando `/juego/[id]` no corresponde a un juego existente.
- Reemplazo del boilerplate actual de `app/page.tsx` (contenido default de `create-next-app`).

**No incluye:**
- Autenticación real / backend / base de datos — el login es 100% simulado en el cliente.
- Lógica de juego real — ningún juego (bloque buster, caída, serpentina, etc.) es jugable; el reproductor es una simulación visual de HUD (puntuación auto-incremental falsa, pausa, fin de partida), no un motor de juego.
- Sonido / audio.
- Internacionalización — todo el contenido queda fijo en español.
- Multijugador, partidas guardadas en servidor, o cualquier feature que implique backend.
- Contenido/copy nuevo — se reutiliza el catálogo y textos existentes en los templates tal cual.

## Modelo de datos

Todo vive en `lib/data.ts` (tipado, sin backend) y en `localStorage` para el estado simulado de sesión/puntuaciones.

### `lib/data.ts`

```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;   // clase CSS del cover art (cover-bricks, cover-tetro, ...)
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
}

export const GAMES: Game[];
export const CATS: Array<"TODOS" | GameCategory>;
export const PLAYERS: string[];

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // dd/mm/aaaa
}

// Generador determinista de leaderboard falso (misma lógica que seededScores en data.jsx)
export function seededScores(seed: number, count?: number): ScoreRow[];
```

Los 8 juegos (bloque-buster, caída, serpentina, glotón, invasores, rocas, ranaria, duelo-pixel) y sus datos se copian tal cual del template.

### Rutas / params

- `/juego/[id]` y `/juego/[id]/jugar` reciben `id` como `params.id` (string), usado para `GAMES.find(g => g.id === id)`. Si no hay match → `notFound()`.

### Estado simulado en `localStorage`

```ts
// clave: "av_user"
interface StoredUser {
  name: string; // iniciales/username en mayúsculas, máx 10 chars
}

// clave: "av_scores"
interface StoredScoreEntry {
  game: string;   // id del juego
  score: number;
  name: string;
  at: number;     // Date.now() en el momento de guardar
}
```

Ambas claves son arrays/objetos JSON planos, igual que en `app.jsx` (`av_user`, `av_scores`). No hay versionado de esquema — al ser puramente decorativo/mock, un cambio de forma simplemente se sobreescribe.

## Plan de implementación

1. **Datos base** — Crear `lib/data.ts` con los tipos `Game`, `ScoreRow`, las constantes `GAMES`, `CATS`, `PLAYERS` y la función `seededScores`, migrando el contenido de `data.jsx` tal cual.

2. **Sesión simulada** — Crear `lib/session.ts` (o `hooks/useSession.ts`) con helpers para leer/escribir `av_user` y `av_scores` en `localStorage` (equivalente a `handleLogin`, `handleSignOut`, `handleSaveScore` de `app.jsx`).

3. **Nav global** — Crear `components/Nav.tsx` (client component) migrando `nav.jsx`: logo, links activos según ruta actual (`usePathname`), contador de créditos, botón de sesión/login, menú móvil. Integrarlo en `app/layout.tsx` junto con el footer, reemplazando el `children` suelto actual.

4. **Estilos de cover art y componentes compartidos** — Confirmar que las clases `.cover-*`, `.card`, `.chip`, `.btn`, etc. de `globals.css` ya cubren todas las pantallas (ya migradas en el PR anterior); no se requieren cambios de CSS salvo ajustes puntuales que surjan al integrar componentes.

5. **Biblioteca (`/`)** — Reemplazar `app/page.tsx` por la pantalla de biblioteca: hero, buscador, chips de categoría y grid de `GameCard`, migrando `biblioteca.jsx`. Navegar a `/juego/[id]` al seleccionar un juego.

6. **Detalle de juego (`/juego/[id]`)** — Crear `app/juego/[id]/page.tsx` migrando `detalle.jsx`: cover, tags, descripción, stat-strip, leaderboard (`seededScores`), botones "Jugar ahora" / "Volver al vault". `notFound()` si el `id` no existe en `GAMES`.

7. **Reproductor (`/juego/[id]/jugar`)** — Crear `app/juego/[id]/jugar/page.tsx` migrando `reproductor.jsx`: HUD, pantalla CRT decorativa con arena animada, puntuación auto-incremental simulada, pausa, fin de partida, modal de guardado de puntuación usando el helper de sesión del paso 2.

8. **Salón de la Fama (`/salon-de-la-fama`)** — Crear `app/salon-de-la-fama/page.tsx` migrando `salon.jsx`: tabs por juego, podio (top 3), tabla de ranking, fila destacada del usuario si hay sesión activa.

9. **Autenticación (`/login`)** — Crear `app/login/page.tsx` migrando `auth.jsx`: tabs iniciar sesión / crear cuenta, formulario simulado, botón de invitado, botones sociales decorativos. Al enviar, guarda la sesión simulada (paso 2) y redirige a `/`.

10. **Verificación visual end-to-end** — Recorrer las 5 pantallas en el navegador (`/`, `/juego/[id]`, `/juego/[id]/jugar`, `/salon-de-la-fama`, `/login`) comprobando fidelidad visual con los templates, estado de sesión persistido, guardado de puntuación, y comportamiento de `notFound()` con un id inválido.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores.
- [ ] `npm run lint` no reporta errores.
- [ ] `/` muestra la biblioteca: hero, buscador funcional (filtra por título), chips de categoría funcionales (incluyendo "TODOS"), grid de 8 juegos con cover art, mejor puntuación y botón "JUGAR".
- [ ] Buscar un término sin resultados muestra el estado vacío "NO HAY RESULTADOS".
- [ ] Click en una `GameCard` (o su botón "JUGAR") navega a `/juego/[id]` con el id correcto.
- [ ] `/juego/[id]` muestra cover, tags, descripción larga, stat-strip (partidas, mejor global, dificultad) y leaderboard de 10 filas generado con `seededScores`.
- [ ] `/juego/un-id-inexistente` renderiza la página 404 estándar de Next.js.
- [ ] Botón "JUGAR AHORA" en detalle navega a `/juego/[id]/jugar`; botón "VOLVER AL VAULT" navega a `/`.
- [ ] `/juego/[id]/jugar` muestra el HUD (jugador, puntuación, vidas, nivel) y la puntuación sube sola mientras el juego no está en pausa ni terminado.
- [ ] Botón "PAUSA" detiene el incremento de puntuación y cambia a "REANUDAR"; al reanudar, la puntuación sigue subiendo.
- [ ] Botón "FIN" abre el modal de fin de partida mostrando la puntuación final.
- [ ] Guardar la puntuación en el modal la persiste en `localStorage` (`av_scores`) y muestra el toast "PUNTUACIÓN GUARDADA".
- [ ] "JUGAR DE NUEVO" reinicia el estado del reproductor (puntuación 0, 3 vidas, nivel 1); "VOLVER AL VAULT" navega a `/`.
- [ ] `/salon-de-la-fama` muestra tabs por cada juego, podio (top 3) y tabla de ranking; cambiar de tab recalcula el ranking mostrado.
- [ ] `/login` permite alternar entre tabs "INICIAR SESIÓN" / "CREAR CUENTA", enviar el formulario simulado guarda la sesión (`av_user`) y redirige a `/`.
- [ ] "JUGAR COMO INVITADO" navega a `/` sin guardar sesión (usuario null).
- [ ] Con sesión activa, el Nav muestra el nombre de usuario en vez del botón "Iniciar Sesión"; cerrar sesión limpia `av_user` y vuelve a mostrar el botón de login.
- [ ] Con sesión activa, `/salon-de-la-fama` muestra la fila destacada "TU MEJOR MARCA" para el juego seleccionado.
- [ ] El menú móvil (hamburguesa) se abre/cierra correctamente en viewport angosto (<840px) y sus links activos coinciden con la ruta actual.
- [ ] Refrescar la página conserva la sesión y las puntuaciones guardadas (persistencia real de `localStorage`).

## Decisiones tomadas y descartadas

- **Reproductor: mock interactivo completo (tomada).** Se replica el comportamiento simulado íntegro del template (puntuación auto-incremental falsa, pausa, fin de partida, guardado) en vez de un mockup estático, porque no es lógica de juego real — es una máquina de estados de UI, y cumple igual con "no implementar ningún juego". *Descartada:* mockup estático con botones decorativos, por perder fidelidad visual/interactiva sin ganar nada a cambio.

- **Rutas reales de App Router (tomada).** Se usan rutas de archivo (`/`, `/juego/[id]`, `/juego/[id]/jugar`, `/salon-de-la-fama`, `/login`) en vez de un router por hash tipo SPA, por ser el patrón idiomático de Next.js App Router y dejar el proyecto preparado para datos reales/SSR en specs futuros. *Descartada:* replicar el router por hash de `app.jsx`, porque hubiera sido código adicional a descartar más adelante.

- **Slugs en español (tomada).** Las URLs (`/juego/[id]`, `/salon-de-la-fama`) usan español para ser consistentes con el copy visible de toda la app. *Descartada:* slugs en inglés, por generar una mezcla de idiomas sin beneficio real.

- **Persistencia simulada con `localStorage` (tomada).** Sesión de usuario y puntuaciones guardadas persisten en `localStorage`, igual que el template, porque es puramente front-end y hace que las pantallas se sientan completas (login "recordado", puntuaciones que sobreviven un refresh). *Descartada:* estado solo en memoria (se pierde al recargar), por dar una experiencia notablemente más pobre sin ahorrar esfuerzo real de implementación.

- **Catálogo de datos migrado tal cual (tomada).** Los 8 juegos, categorías y generador de leaderboard (`seededScores`) se migran sin cambios de contenido a `lib/data.ts`, tipados. *Descartada:* definir contenido nuevo, porque no se especificó ningún reemplazo y el spec quedaría bloqueado esperando esa definición.

- **404 estándar de Next.js para juego inexistente (tomada).** `/juego/[id]` con un id inválido dispara `notFound()`. *Descartada:* redirección silenciosa a biblioteca, por ocultar el error en vez de exponerlo (menos útil en desarrollo/QA).

- **Fuera de alcance explícito (tomada).** Auth real/backend, lógica de juego real, sonido/audio e internacionalización quedan fuera de este spec. *Razón:* ninguno es necesario para una demo visual y cada uno ameritaría su propio spec si se decide abordarlo.

## Riesgos identificados

- **Desajuste de hidratación (SSR/CSR) por `localStorage`.** Leer `av_user`/`av_scores` durante el render inicial de un Server Component causaría mismatch, ya que `localStorage` no existe en servidor. *Mitigación:* toda lectura de sesión/puntuaciones debe ocurrir en componentes cliente (`"use client"`), inicializada de forma perezosa (`useState(() => ...)` o `useEffect`), tal como lo hace `app.jsx`.

- **API de rutas dinámicas de este Next.js puede diferir de lo esperado.** `AGENTS.md` ya advierte que esta versión tiene cambios respecto a versiones anteriores (p.ej. `params` como `Promise` en vez de objeto plano en algunas versiones recientes de App Router). *Mitigación:* antes de implementar `app/juego/[id]/page.tsx` y `app/juego/[id]/jugar/page.tsx`, revisar la doc correspondiente en `node_modules/next/dist/docs/01-app/` para confirmar la forma correcta de `params`.

- **Componentes cliente olvidados.** Varias pantallas dependen de estado/efectos (tilt 3D de las cards, temporizador de puntuación, tabs, formularios) que requieren `"use client"`. Si se omite en algún archivo, Next.js no falla en build pero el componente pierde interactividad silenciosamente. *Mitigación:* marcar explícitamente cada pantalla/isla interactiva como client component durante el paso de migración correspondiente, y verificar interactividad en el navegador (paso 10 del plan) antes de dar por cerrado cada componente.

- **Drift entre el CSS ya migrado y el template original.** El PR anterior ya portó `styles.css` a `globals.css`, pero no se ha diffado línea por línea contra el template en este spec. *Mitigación:* al integrar cada pantalla, comparar visualmente contra el `Arcade Vault.html` de referencia y no asumir paridad 1:1 sin verificarla.

- **`seededScores` con PRNG propio.** Es una función determinista (no usa `Math.random`), lo cual es correcto para evitar mismatches de hidratación, pero si se le pasa un seed que dependa de algo no determinista entre servidor y cliente (p.ej. `Date.now()`), se rompería esa garantía. *Mitigación:* los seeds deben derivarse únicamente de valores estables (como el `id` del juego), igual que en el template.
