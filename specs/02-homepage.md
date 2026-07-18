# Spec 02 — Homepage

- **Estado:** Implementado
- **Dependencias:** Spec 01 — MVP Visual Screens (reutiliza `Nav`, `lib/data.ts`, `GameCard`, `layout.tsx`, y mueve la ruta de biblioteca que ese spec creó en `/`)
- **Fecha:** 2026-07-17
- **Objetivo:** Implementar la landing page (Home) de Arcade Vault en `/` migrando `home.jsx` del template de referencia, moviendo la biblioteca actual de `/` a `/biblioteca` y actualizando el nav para reflejar ambas rutas.

## Alcance

**Incluye:**
- Migración de `home.jsx` a la nueva página raíz `app/page.tsx`: hero con siluetas pixel flotantes, sección "¿Por qué Arcade Vault?" (feature grid), preview de juegos (rail con tarjetas compactas desde `lib/data.ts`), stats, "Actividad en vivo" (ticker de últimas puntuaciones + top jugadores), pricing/FAQ, y CTA final.
- Migración de la lógica de reveal-on-scroll (`useReveal` con `IntersectionObserver` + clases `.reveal`/`.in`) tal como en el template.
- Migración de las clases CSS `.home-*` (y las que dependan del reveal) desde `references/resources/home-about/styles.css` a `app/globals.css`.
- Nueva ruta `/biblioteca`: se mueve el contenido actual de `app/page.tsx` (grid de juegos con búsqueda y filtro) tal cual, sin cambios de comportamiento.
- Actualización de `components/Nav.tsx`: se agrega el link "Inicio" (→ `/`), y el link que hoy dice "Biblioteca" pasa a apuntar a `/biblioteca` en vez de `/`. Se actualiza `isActive` para reflejar la nueva raíz.
- Los stats de la sección de stats muestran el conteo real de `GAMES.length` en vez del "12+" hardcodeado del template.
- Los CTAs de Home navegan a rutas reales ya existentes: "Explorar juegos" / "Ver todos los juegos" / CTA final → `/biblioteca`; "Crear cuenta" / "Empezar gratis" → `/login`; "Ver salón" → `/salon-de-la-fama`.
- Los datos de "Actividad en vivo" (últimas puntuaciones, top jugadores de hoy) se copian tal cual del template como arrays estáticos, sin conectarlos a `seededScores` ni a `localStorage`.
- Actualización de los links/redirects que hoy asumen que `/` es la biblioteca, para que apunten a `/biblioteca`: botón "VOLVER AL VAULT" en `app/juego/[id]/page.tsx`, `app/salon-de-la-fama/page.tsx` y `components/GamePlayer.tsx`; y los `router.push("/")` tras login/invitado en `app/login/page.tsx`.

**No incluye:**
- Página "Acerca de" / formulario de contacto (`about.jsx`) — queda para un spec futuro; el link "Acerca de" no se agrega al nav todavía.
- Cualquier dato dinámico/real para el ticker de actividad o el top de jugadores — siguen siendo mock estático, igual que en el resto de la app.
- Cambios de contenido/copy respecto al template (fuera del ajuste del conteo de juegos ya acordado).
- Redirects desde la vieja URL de biblioteca en `/` — no hay usuarios reales todavía, así que no se agrega ninguna regla de redirección.
- Sonido, internacionalización, backend real — mismos límites que el spec 01.

## Modelo de datos

Home no introduce datos persistentes ni tipos compartidos nuevos en `lib/`. Reutiliza `GAMES` de `lib/data.ts` para el rail de preview. Sí incorpora dos arrays de mock estático, copiados tal cual del template, que viven como constantes locales dentro de `app/page.tsx` (no en `lib/data.ts`, porque son contenido decorativo propio de la landing, no catálogo reutilizable):

```ts
// Fila del ticker "ÚLTIMAS PUNTUACIONES"
interface ActivityTick {
  p: string;   // nombre del jugador (ej. "NEONFOX")
  g: string;   // nombre del juego (ej. "Caída")
  s: number;   // puntuación
  t: string;   // texto relativo (ej. "hace 2 min")
  c: "cyan" | "magenta" | "yellow" | "green"; // color de acento
}

// Fila del top "TOP JUGADORES · HOY"
interface TopPlayerRow {
  r: number;   // posición (1-5)
  p: string;   // nombre del jugador
  s: number;   // puntuación
}
```

Ambos arrays se copian con los mismos valores del template (7 filas de actividad, 5 de top jugadores). El stat "JUEGOS" del bloque de stats deja de ser un string fijo y pasa a derivarse de `GAMES.length` en tiempo de render.

## Plan de implementación

1. **Migrar CSS del home** — Portar a `app/globals.css` las clases usadas por `home.jsx` que hoy no existen (`.home-*`, `.mini-*`, `.feature-*`, `.stat-block`/`.home-stats`, `.activity-*`, `.tick-*`, `.top-*`, `.price-*`/`.pricing-*`, `.faq-*`, `.final-*`, `.reveal`/`.in`), copiándolas tal cual desde `references/resources/home-about/styles.css`.

2. **Mover biblioteca a `/biblioteca`** — Crear `app/biblioteca/page.tsx` con el contenido íntegro del `app/page.tsx` actual (búsqueda, chips de categoría, grid de `GameCard`), sin cambios de lógica. Actualizar los links/redirects que hoy apuntan a `/` esperando la biblioteca para que apunten a `/biblioteca`: botón "VOLVER AL VAULT" en `app/juego/[id]/page.tsx`, `app/salon-de-la-fama/page.tsx` y `components/GamePlayer.tsx`; y los `router.push("/")` tras login/invitado en `app/login/page.tsx`.

3. **Actualizar Nav** — En `components/Nav.tsx`: agregar el link "Inicio" (→ `/`), cambiar el link "Biblioteca" para apuntar a `/biblioteca`, y ajustar `isActive` para que `/` solo esté activo en Home y `/biblioteca` cubra también `/juego/*` (como hace hoy `/`).

4. **Nueva Home — Hero** — Reemplazar `app/page.tsx` con el hero migrado de `home.jsx`: siluetas pixel flotantes decorativas, eyebrow, título, subtítulo, CTAs ("Explorar juegos" → `/biblioteca`, "Crear cuenta" → `/login`), indicador de scroll. Incluir el hook `useReveal` (`IntersectionObserver`) que se aplicará a las secciones siguientes.

5. **Sección "¿Por qué Arcade Vault?"** — Feature grid con las 4 tarjetas y sus iconos pixel SVG, migrados tal cual.

6. **Sección "Juegos disponibles ahora"** — Rail de tarjetas compactas (nuevo componente ligero, distinto de `GameCard`) usando `GAMES.slice(0, 6)` de `lib/data.ts`; click navega a `/juego/[id]`; botón "Ver todos los juegos" → `/biblioteca`.

7. **Sección de stats** — 3 bloques, mostrando `GAMES.length` en el bloque "JUEGOS" en vez del "12+" hardcodeado del template.

8. **Sección "Actividad en vivo"** — Ticker de últimas puntuaciones + tabla de top jugadores de hoy, con los arrays de mock estático definidos como constantes locales; botón "Ver salón" → `/salon-de-la-fama`.

9. **Sección de precios/FAQ** — Card de plan único + preguntas frecuentes, migrados tal cual; CTA "Empezar gratis" → `/login`.

10. **CTA final** — Sección de cierre con botón "Insertar moneda" → `/biblioteca`.

11. **Verificación visual end-to-end** — Recorrer `/` (nueva Home) y `/biblioteca` en el navegador: click en cada CTA, scroll para confirmar que las animaciones `.reveal`/`.in` disparan, verificar estado activo del nav en cada ruta, correr `npm run build` y `npm run lint`.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores.
- [ ] `npm run lint` no reporta errores.
- [ ] `/` muestra la nueva Home: hero con siluetas pixel animadas, eyebrow, título, subtítulo y los dos CTAs.
- [ ] Botón "Explorar juegos" del hero navega a `/biblioteca`; botón "Crear cuenta" navega a `/login`.
- [ ] La sección "¿Por qué Arcade Vault?" muestra las 4 feature cards con su ícono, título y descripción.
- [ ] La sección "Juegos disponibles ahora" muestra un rail con 6 juegos (de los 8 en `GAMES`); click en cualquiera navega a `/juego/[id]` con el id correcto.
- [ ] Botón "Ver todos los juegos" navega a `/biblioteca`.
- [ ] La sección de stats muestra el conteo real de juegos (hoy "8", no "12+").
- [ ] La sección "Actividad en vivo" muestra el ticker de últimas puntuaciones (7 filas) y la tabla de top jugadores de hoy (5 filas, con el primer puesto destacado visualmente).
- [ ] Botón "Ver salón" navega a `/salon-de-la-fama`.
- [ ] La sección de precios muestra la card del plan único con su lista de beneficios y las 3 preguntas frecuentes.
- [ ] Botón "Empezar gratis" navega a `/login`.
- [ ] El CTA final ("Insertar moneda") navega a `/biblioteca`.
- [ ] Al hacer scroll, cada sección con clase `.reveal` aparece con su animación (no están visibles de golpe al cargar la página).
- [ ] `/biblioteca` muestra exactamente el mismo contenido y comportamiento que tenía `/` antes de este spec (búsqueda, chips de categoría, grid de 8 juegos).
- [ ] El nav muestra 3 links: "Inicio" (→ `/`), "Biblioteca" (→ `/biblioteca`), "Salón de la Fama" (→ `/salon-de-la-fama`).
- [ ] El link "Inicio" está activo solo en `/`; el link "Biblioteca" está activo en `/biblioteca` y en `/juego/*`.
- [ ] El menú móvil (hamburguesa) refleja los mismos 3 links y el mismo estado activo que el nav de escritorio.
- [ ] Navegar directamente a `/biblioteca` (sin pasar por `/`) funciona igual que antes navegar a `/`.
- [ ] "VOLVER AL VAULT" (detalle de juego, salón de la fama, reproductor) y los redirects tras login/invitado navegan a `/biblioteca`, no a `/`.

## Decisiones tomadas y descartadas

- **Home pasa a ocupar `/`, biblioteca se mueve a `/biblioteca` (tomada).** Es fiel al `nav.jsx` original del template, que distingue "Inicio" de "Biblioteca" como rutas separadas, y deja el proyecto alineado con la intención original del diseño. *Descartada:* fusionar hero+features arriba de la grid de biblioteca en una sola página, porque mezclar landing y catálogo en una sola ruta no es lo que muestra el template y hubiera forzado a inventar una composición no especificada.

- **About/Contacto fuera de alcance (tomada).** Aunque `about.jsx` se pasó junto con `home.jsx`, el pedido explícito fue "implementar la homepage". *Descartada:* incluirlo en este spec, para no mezclar dos pantallas con secciones y decisiones propias (formulario, validación, copy) en un spec que ya tiene bastante superficie.

- **"Acerca de" no se agrega al nav todavía (tomada).** Consecuencia directa de dejar About fuera de alcance: agregar el link ahora apuntaría a una ruta inexistente. *Descartada:* agregarlo deshabilitado o como placeholder, por ser complejidad extra sin beneficio real hasta que exista el spec de About.

- **Stat de "JUEGOS" usa el conteo real (`GAMES.length`) en vez de "12+" (tomada).** El catálogo real tiene 8 juegos; mostrar "12+" sería un dato falso verificable con solo contar la grid de biblioteca. *Descartada:* copiar "12+" tal cual, porque a diferencia de contenido puramente decorativo (textos de marketing, FAQ), este es un número que se contradice con datos reales visibles en la misma app.

- **Datos de "Actividad en vivo" como mock estático tal cual (tomada).** Se migran los arrays hardcodeados del template sin conectarlos a `seededScores` ni `localStorage`, siguiendo el mismo criterio del spec 01 ("no se especificó contenido nuevo") y evitando inventar una lógica de derivación no pedida. *Descartada:* generarlos desde datos reales de `lib/data.ts`, por ser esfuerzo adicional no solicitado y que además requeriría decidir arbitrariamente qué jugadores/puntuaciones mostrar.

- **Reveal-on-scroll replicado fielmente con `IntersectionObserver` (tomada).** Es un patrón nuevo en el codebase, pero es parte visible del diseño del template (las secciones no aparecen de golpe) y las clases `.reveal`/`.in` ya están definidas en el CSS de referencia. *Descartada:* omitir la animación, porque perdería fidelidad visual notoria sin ahorrar esfuerzo significativo (es un hook de ~10 líneas).

- **Preview de juegos usa un componente propio, distinto de `GameCard` (tomada).** El template usa `MiniCard`, una tarjeta más compacta (sin tilt 3D, sin stat-strip) pensada para un rail horizontal, mientras `GameCard` está diseñado para la grid completa de biblioteca. *Descartada:* reutilizar `GameCard` en el rail, porque su diseño es visualmente más pesado de lo que muestra el template para esta sección y forzaría a alterar su comportamiento (tilt, tamaño) solo para este caso de uso.

- **Sin redirect desde la vieja ruta `/` con contenido de biblioteca (tomada).** No hay usuarios reales navegando el sitio en producción todavía. *Descartada:* agregar una regla de redirect, por ser complejidad innecesaria para un proyecto sin tráfico real.

- **Links de "volver al vault" actualizados a `/biblioteca` (tomada).** `app/juego/[id]/page.tsx`, `app/salon-de-la-fama/page.tsx`, `components/GamePlayer.tsx` y los redirects de `app/login/page.tsx` asumían que `/` era la biblioteca; se actualizan para preservar su comportamiento real (volver al catálogo de juegos) en vez de mandar al usuario al nuevo landing. *Descartada:* dejarlos apuntando a `/`, porque cambiaría silenciosamente el comportamiento de flujos ya verificados en el spec 01 sin ninguna ventaja.

## Riesgos identificados

- **Migración de CSS incompleta o con colisiones.** Se están portando ~69 selectores nuevos (`.home-*`, `.mini-*`, `.feature-*`, `.activity-*`, `.tick-*`, `.top-*`, `.price-*`, `.pricing-*`, `.faq-*`, `.final-*`, `.reveal`/`.in`) desde `styles.css` a `globals.css`. *Mitigación:* copiar por sección completa (no selector por selector) y comparar visualmente cada sección de Home contra el template antes de dar el paso por cerrado.

- **Animación `.reveal` que nunca dispara.** Si `.reveal` en CSS arranca con `opacity: 0` y la clase `.in` es la que la revierte, olvidar `"use client"` o el `useEffect` del hook `useReveal` dejaría secciones enteras invisibles de forma silenciosa (sin error en build). *Mitigación:* marcar `app/page.tsx` como client component desde el paso 4, y verificar en el navegador (paso 11) que cada sección aparece al hacer scroll, no que ya está visible o que nunca aparece.

- **Regresión en el estado activo del nav.** Cambiar `isActive` para diferenciar `/` (Home) de `/biblioteca` (+ `/juego/*`) toca lógica ya usada en criterios de aceptación del spec 01. *Mitigación:* verificar explícitamente el estado activo del nav en las 6 rutas existentes (`/`, `/biblioteca`, `/juego/[id]`, `/juego/[id]/jugar`, `/salon-de-la-fama`, `/login`) durante el paso 11, en desktop y en el menú móvil.

- **Links residuales a `/` no detectados.** El grep hecho durante este spec encontró 4 archivos con links/redirects que asumían `/` = biblioteca, pero podrían existir otros no cubiertos (por ejemplo, si se agregan pantallas nuevas antes de implementar este spec). *Mitigación:* repetir la búsqueda (`grep -rn 'href="/"\|push("/")'`) como parte de la verificación del paso 11, no solo confiar en la lista ya identificada.
