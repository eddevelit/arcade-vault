---
name: spec-impl-game
description: Implementa un spec de juego nuevo ya aprobado — exactamente igual que /spec-impl (identifica el spec, valida estado Aprobado, crea la rama spec-NN-slug, implementa paso a paso con pausas de revisión) — y, al terminar, dispara automáticamente skin-designer y luego mobile-porter en secuencia (nunca en paralelo) sobre el game-id recién implementado. Usar en vez de /spec-impl a secas cuando el spec es de un juego nuevo (los que produce /nuevo-juego).
disable-model-invocation: true
argument-hint: "<NN-spec-name>"
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(cat:*), Bash(ls:*), Read, Grep, Glob
---

# /spec-impl-game — implementa un spec de juego y encadena la QA post-implementación

Este skill **no reimplementa** `/spec-impl`. Es `/spec-impl` sin ningún cambio en sus 4 fases, más una Fase 5 nueva que dispara `skin-designer` y después `mobile-porter` cuando la implementación terminó de verdad. La única diferencia con correr `/spec-impl` a secas y después acordarte de lanzar los dos agentes a mano es que acá queda automatizado y en el orden correcto.

## Por qué no se duplica el texto de `/spec-impl`

`/spec-impl` es una skill global instalada vía `npx skills@latest add Klerith/fernando-skills`. Copiar sus 4 fases a mano acá adentro las desincronizaría la próxima vez que esa skill se actualice. En cambio, este skill **lee el archivo real** al arrancar y sigue lo que diga, siempre vigente:

```
~/.claude/skills/spec-impl/SKILL.md
```

(hoy resuelve, vía symlink, a `~/.agents/skills/spec-impl/SKILL.md` — no asumas la ruta final, seguí el symlink si cambia).

## Fases 1–4 — idénticas a `/spec-impl`

1. Al arrancar, `Read` el archivo `~/.claude/skills/spec-impl/SKILL.md` completo.
2. Seguí sus fases **al pie de la letra**, con `$ARGUMENTS` tal cual las recibiste (identificar el spec → validar que el estado sea "Aprobado" → crear/cambiar a la rama `spec-NN-slug` → implementar paso a paso, pausando después de cada paso para que el usuario revise el diff).
3. Ni resumas ni "mejores" esa lógica — es la misma skill, ejecutada tal cual. Si `/spec-impl` se detiene en cualquiera de sus fases (spec no encontrado, estado distinto de Aprobado, ambigüedad sin resolver en el plan), **este skill se detiene ahí también** — la Fase 5 nunca corre.

## Fase 5 — al cierre natural de la implementación: skin-designer → mobile-porter

Se dispara **sólo** cuando `/spec-impl` llegó a su cierre natural: todos los criterios de aceptación del spec están tildados, el estado del spec quedó en "Implementado" y el commit final ya se hizo (el propio cierre que ya pide `/spec-impl`). Si el usuario cortó el flujo antes, o algún criterio quedó sin cumplir, no sigas a esta fase — decilo y quedate ahí.

1. **Determiná el `game-id` real** desde `lib/games/registry.ts` — la clave agregada a `GAME_COMPONENTS` durante la implementación recién hecha. Es la fuente de verdad post-implementación; no asumas que es igual al slug del archivo del spec sin confirmarlo ahí.
2. Anunciá al usuario, antes de arrancar, que vas a correr `skin-designer` y después `mobile-porter` sobre ese `game-id`, uno después del otro.
3. Invocá el agente `skin-designer` (tool `Agent`, `subagent_type: "skin-designer"`) pasándole el `game-id` como contexto. **`run_in_background: false`** — es una espera bloqueante a propósito: el paso siguiente depende de que este termine, y no hay nada útil que hacer mientras corre.
4. Cuando termine, relayale al usuario un resumen breve de lo que hizo (el reporte completo del subagente no se le muestra tal cual — resumí lo esencial: si faltaban skins y cuáles agregó, qué archivos tocó, resultado de build/lint/Playwright).
5. **Recién ahí**, invocá `mobile-porter` (mismo mecanismo — `Agent`, `subagent_type: "mobile-porter"`, mismo `game-id`, también `run_in_background: false`). Nunca lo lances en el mismo turno/respuesta que `skin-designer` — tiene que haber terminado y haberte devuelto su resultado primero.
6. Cuando termine, relayá su resumen (hallazgos por perfil de viewport, archivos tocados, resultado de build/lint).
7. Cerrá con un resumen consolidado de ambos: qué se hizo, y qué quedó fuera de alcance según cada agente (ellos mismos lo señalan en su propio cierre "Detenete ahí") — sin ofrecerte a resolver esos pendientes vos.

## Reglas duras

- Nunca corras `skin-designer` y `mobile-porter` en paralelo ni en el mismo turno — `mobile-porter` arranca sólo después de que `skin-designer` terminó y te devolvió su resultado. Ambos pueden escribir la misma sección de `references/implemented-games.md` para el mismo juego; correrlos a la vez arriesgaría que uno pise la edición del otro.
- Nunca dupliques a mano el contenido de `/spec-impl` — leelo y seguilo, no lo reescribas.
- Si `/spec-impl` se detiene en cualquiera de sus 4 fases, esta skill se detiene ahí también — la Fase 5 no corre.
- Español siempre, igual que el resto del repo.
