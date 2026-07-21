# Spec 04 — Integración Supabase (setup inicial)

- **Estado:** Aprobado
- **Dependencias:** Ninguna funcional. No depende de ningún spec anterior ni modifica su comportamiento; es preparación de infraestructura para specs futuros que sí usarán Supabase (ej. autenticación real, persistencia de puntajes en vez de `localStorage`).
- **Fecha:** 2026-07-21
- **Objetivo:** Instalar los paquetes `@supabase/supabase-js` y `@supabase/ssr`, y crear los archivos base (cliente browser, cliente server, variables de entorno documentadas) necesarios para integrar Supabase al proyecto, sin migrar todavía ninguna funcionalidad existente.

## Alcance

**Incluye:**

- Instalación de dependencias: `npm install @supabase/supabase-js @supabase/ssr`.
- `lib/supabase/client.ts` — cliente para uso en Client Components, usando `createBrowserClient` de `@supabase/ssr`.
- `lib/supabase/server.ts` — cliente para uso en Server Components / Route Handlers, usando `createServerClient` de `@supabase/ssr` (maneja cookies de sesión).
- Actualización de `.env.template` (versionado) documentando las 3 variables ya presentes en el archivo: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_PASSWORD` — como placeholders, sin valores reales. No se agregan variables nuevas al archivo.
- Carga en `.env.local` (no versionado) de las credenciales reales que sí se usan en este spec: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `SUPABASE_DB_PASSWORD` (contraseña de conexión directa a Postgres, distinta de una API key de Supabase) queda como placeholder vacío también en `.env.local` — no es necesaria hasta que exista un consumidor real (p. ej. una herramienta de migraciones que se conecte directo a la base).
- Verificación de la conexión usando la herramienta MCP de Supabase (`list_tables`) contra el proyecto real, confirmando que las credenciales en `.env.local` son válidas.

**No incluye:**

- Cliente admin/service role de `@supabase/supabase-js` (`lib/supabase/admin.ts`) — este spec no crea ese concepto. `SUPABASE_DB_PASSWORD` queda documentada como placeholder, pero es una credencial de conexión directa a Postgres, no una service role key de la API de Supabase, y ningún archivo la consume todavía.
- Migración de la sesión (`av_user`) o los puntajes (`av_scores`) desde `localStorage` a Supabase — sigue igual que hoy, sin ningún cambio de comportamiento visible en la app.
- Definición de tablas, schema, migraciones o políticas RLS.
- Supabase Auth real (login/signup) — el login simulado actual no se toca.
- Instalación o configuración del Supabase CLI local (`supabase init`, `config.toml`, agent-skill) — solo el SDK vía npm.
- `middleware.ts` para refresco de tokens de sesión — no aplica todavía porque no hay Auth real en este spec.
- Creación de un nuevo proyecto de Supabase — ya existe y el usuario aporta las credenciales.

## Modelo de datos

Este spec no introduce datos persistentes ni tipos en `lib/data.ts` — es infraestructura pura. Sí define el contrato de los dos módulos cliente que se crean:

```ts
// lib/supabase/client.ts — para usar en Client Components ("use client")
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

```ts
// lib/supabase/server.ts — para usar en Server Components / Route Handlers
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );
}
```

Ambos exportan una función `createClient()` (patrón oficial de `@supabase/ssr`), en vez de una instancia única compartida — evita reutilizar accidentalmente un cliente de servidor entre requests distintos.

### Variables de entorno

```
# .env.template (versionado, sin valores reales — ya existían en el archivo)
RESEND_API_KEY=

SUPABASE_DB_PASSWORD=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

`.env.local` (no versionado, ya cubierto por `.env*` en `.gitignore`) es completado por el usuario con los valores reales de `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `SUPABASE_DB_PASSWORD` (contraseña de conexión directa a Postgres) no es obligatoria en este spec — puede quedar vacía hasta que exista un consumidor real.

## Plan de implementación

1. **Instalar dependencias** — `npm install @supabase/supabase-js @supabase/ssr`.

2. **Actualizar `.env.template`** — El archivo ya contiene las 3 variables necesarias como placeholders vacíos: `NEXT_PUBLIC_SUPABASE_URL=`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`, `SUPABASE_DB_PASSWORD=`. No se agregan variables nuevas.

3. **Cargar credenciales reales en `.env.local`** — El usuario completa `.env.local` (no versionado) con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` de su proyecto Supabase existente. `SUPABASE_DB_PASSWORD` puede quedar vacía por ahora.

4. **Crear `lib/supabase/client.ts`** — Cliente browser con `createBrowserClient` de `@supabase/ssr`, leyendo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

5. **Crear `lib/supabase/server.ts`** — Cliente server con `createServerClient` de `@supabase/ssr`, usando `cookies()` de `next/headers` (API async en esta versión de Next.js) para leer/escribir cookies de sesión.

6. **Verificar conexión con el proyecto real** — Usar la herramienta MCP de Supabase (`list_tables`) contra el proyecto cuyas credenciales están en `.env.local`, confirmando que responde sin error de autenticación.

7. **Verificación final** — Correr `npm run build` y `npm run lint`; confirmar que ninguna pantalla existente cambió de comportamiento (no hay ningún componente que importe los nuevos clientes todavía).

## Criterios de aceptación

- [x] `npm install @supabase/supabase-js @supabase/ssr` agrega ambas dependencias a `package.json` y `package-lock.json`.
- [x] `.env.template` contiene las 3 variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_PASSWORD`) como placeholders vacíos, sin ningún valor real.
- [x] `.env.local` contiene los valores reales de `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` del proyecto Supabase existente, y no está trackeado por git. `SUPABASE_DB_PASSWORD` puede quedar vacía.
- [x] `lib/supabase/client.ts` exporta una función `createClient()` que instancia un cliente browser válido (`createBrowserClient`).
- [x] `lib/supabase/server.ts` exporta una función `createClient()` (async) que instancia un cliente server válido (`createServerClient`), usando `cookies()` de `next/headers`.
- [x] Llamar a la herramienta MCP de Supabase (`list_tables`) contra el proyecto configurado en `.env.local` responde exitosamente (sin error de credenciales), confirmando que apunta a un proyecto real y accesible.
- [x] `npm run build` completa sin errores.
- [x] `npm run lint` no reporta errores.
- [x] Ninguna pantalla existente (`/`, `/biblioteca`, `/login`, `/acerca-de`, `/salon-de-la-fama`, `/juego/[id]`) cambia de comportamiento — nada importa todavía los nuevos clientes de Supabase.

## Decisiones tomadas y descartadas

- **`@supabase/supabase-js` + `@supabase/ssr` (tomada).** `@supabase/ssr` da los helpers oficiales para manejar cookies de sesión en App Router (Server Components, Route Handlers), necesarios si un spec futuro agrega Auth real. _Descartada:_ instalar solo `@supabase/supabase-js`, por ser insuficiente el día que se necesite sesión persistida vía cookies en vez de solo queries anónimas/públicas.

- **Proyecto Supabase ya existente, credenciales aportadas por el usuario (tomada).** Sigue el mismo patrón que `RESEND_API_KEY` en el spec 03: el spec documenta la variable, el usuario completa el valor real en `.env.local`. _Descartada:_ crear un proyecto nuevo con el MCP de Supabase, porque el usuario ya tiene uno y crear otro sería trabajo redundante.

- **Alcance acotado a dos clientes (browser + server), sin `proxy.ts`/`middleware.ts` (tomada).** Sin Auth real todavía, no hay tokens de sesión que refrescar en cada request. _Descartada:_ agregar el archivo de refresco de sesión ahora (nota: en esta versión de Next.js el file convention se llama `proxy.ts`, no `middleware.ts` — ver `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`), por ser complejidad sin ningún consumidor real todavía.

- **100% infraestructura, sin migrar sesión ni puntajes (tomada).** Mantiene el spec acotado a "instalar y dejar el cliente listo", sin tocar `lib/session.ts` (`av_user`/`av_scores` en `localStorage`) ni el comportamiento visible de la app. _Descartada:_ migrar algo real en este mismo spec, porque ampliaría el alcance a definir schema, tablas y políticas RLS — trabajo para un spec posterior y dedicado.

- **Reusar las variables ya existentes en `.env.template` (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_PASSWORD`) en vez de agregar `NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` (tomada).** El archivo ya traía estas variables de trabajo previo; agregar nombres alternativos para el mismo propósito hubiera dejado el `.env.template` con placeholders redundantes. _Descartada:_ agregar las variables con los nombres originalmente propuestos en el spec, por duplicar el propósito de variables que ya existían.
- **`SUPABASE_DB_PASSWORD` documentada sin consumidor todavía (tomada).** Se deja la variable lista en `.env.template` para no tener que volver a tocar el archivo cuando haga falta, pero sin crear ningún cliente (admin ni de conexión directa a Postgres) todavía porque ningún spec la necesita hoy. Nota: es una contraseña de conexión directa a Postgres, no una service role key de la API de Supabase — un futuro cliente admin de `@supabase/supabase-js` necesitaría una variable distinta (`SUPABASE_SERVICE_ROLE_KEY`) que no existe en este repo todavía. _Descartada:_ crear un cliente ahora, por ser código sin consumidor (dead code) hasta que se decida qué operación la necesita.

- **Verificación vía MCP de Supabase (`list_tables`) en vez de endpoint de prueba (tomada).** Confirma que las credenciales apuntan a un proyecto real sin agregar código de prueba al repo que después haya que recordar borrar. _Descartada:_ crear una ruta temporal (`/api/supabase-ping`), por dejar superficie extra en el repo para una verificación que es de una sola vez.

- **Sin Supabase CLI local en este spec (tomada).** Mantiene el spec acotado a "instalar dependencias npm + archivos base", tal como se pidió. _Descartada:_ instalar y configurar el CLI (`supabase init`, `config.toml`, agent-skill) ahora, porque solo hace falta el día que se trabaje con migraciones/schema versionado, no para simplemente tener un cliente listo para usarse.

- **`SUPABASE_DB_PASSWORD` no se carga con un valor real en `.env.local` todavía (tomada).** Ningún cliente de este spec la consume, así que pedir la contraseña real ahora no tiene beneficio y expone innecesariamente una credencial sensible (acceso directo a la base, sin pasar por RLS) antes de tener un uso concreto para ella. _Descartada:_ cargarla igual "ya que se está en el archivo", por ser una credencial de alto privilegio — mejor cargarla recién en el spec que efectivamente la use.

## Riesgos identificados

- **Confusión entre `NEXT_PUBLIC_*` y `SUPABASE_DB_PASSWORD`.** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` es pública por diseño (respeta RLS), pero `SUPABASE_DB_PASSWORD` da acceso directo a Postgres sin pasar por RLS y nunca debe tener el prefijo `NEXT_PUBLIC_` ni ser importada desde código que corra en el browser. _Mitigación:_ como no se crea ningún cliente que la consuma en este spec, no hay ningún import real de la contraseña todavía — el riesgo se vuelve relevante recién cuando se cree ese consumidor en un spec futuro; documentar ahí explícitamente que debe ser server-only. Nota adicional: si un spec futuro necesita en cambio una service role key de la API de Supabase (para bypasear RLS vía `@supabase/supabase-js`, no acceso directo a Postgres), esa es una variable distinta (`SUPABASE_SERVICE_ROLE_KEY`) que no existe hoy en este repo y debería agregarse en ese momento.

- **API `cookies()` asíncrona en esta versión de Next.js.** Si `lib/supabase/server.ts` no usa `await cookies()` (patrón de versiones antiguas de Next.js/`@supabase/ssr` en la documentación pública), el código puede no compilar o comportarse distinto a lo esperado. _Mitigación:_ confirmado en `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` que `cookies()` es async desde v15 — el snippet de este spec ya usa `await cookies()`.

- **`SUPABASE_DB_PASSWORD` documentada en `.env.template` sin uso todavía.** Al no haber ningún código que la consuma, es fácil olvidar que existe o dejarla desactualizada cuando se necesite. _Mitigación:_ `.env.template` la documenta con un nombre explícito, así que cualquier spec futuro que la necesite la encuentra ya declarada, sin tener que adivinar el nombre de la variable.

- **La verificación con `list_tables` no prueba que los archivos cliente funcionen en runtime.** Confirma que las credenciales son válidas contra el proyecto real, pero no ejercita `lib/supabase/client.ts` ni `lib/supabase/server.ts` dentro de la app (no hay ningún componente que los importe todavía). _Mitigación:_ aceptado como límite conocido de este spec — la prueba real de los clientes queda para el primer spec que efectivamente los use (ej. Auth o persistencia de puntajes).
