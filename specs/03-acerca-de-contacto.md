# Spec 03 — Acerca de y Contacto

- **Estado:** Aprobado
- **Dependencias:** Spec 02 — Homepage (agrega el link "Acerca de" al Nav que ese spec dejó pendiente a propósito)
- **Fecha:** 2026-07-18
- **Objetivo:** Implementar la página "Acerca de" (`/acerca-de`) migrando `about.jsx` del template de referencia, conectando su formulario de contacto a un envío real de correo electrónico mediante Resend, y agregando el link "Acerca de" al Nav.

## Alcance

**Incluye:**
- Nueva ruta `/acerca-de` (`app/acerca-de/page.tsx`), migrando `about.jsx` del template tal cual: hero "ACERCA DE ARCADE VAULT" (kicker, título, texto de misión, 3 highlights con íconos pixel), banner divisor animado, y sección de contacto (intro + 3 tips + formulario).
- Migración del reveal-on-scroll (`IntersectionObserver` + clases `.reveal`/`.in`) para las secciones de la página, siguiendo el mismo patrón que Home (spec 02).
- Migración de las clases CSS `.about-*`, `.contact-*`, `.highlight-*`, `.terminal-*`, `.field`, etc. desde `references/resources/home-about/styles.css` a `app/globals.css`.
- Formulario de contacto conectado a un endpoint real (`app/api/contacto/route.ts`) que envía el correo con el SDK de Resend, en vez de la simulación estática del template.
- Instalación de la dependencia `resend` (`npm install resend`).
- Variable de entorno `RESEND_API_KEY` en `.env.local` (no versionado; ya cubierto por `.env*` en `.gitignore`), documentada con un `.env.local.example` committeado como referencia.
- Remitente del correo usando el sandbox de Resend (`onboarding@resend.dev`); destinatario fijo `edd.develit@gmail.com`; `Reply-To` con el email que ingresó la persona en el formulario.
- Validación de campos (nombre, email, mensaje no vacíos; email con formato válido) tanto en el cliente (ya existente) como en el servidor (nueva, en la API route).
- Nuevo estado de error en el formulario (no existe en el template original): si el envío falla, se muestra dentro del mismo panel "terminal" una línea de error, conservando los datos ya escritos, sin perder el estado del formulario.
- Actualización de `components/Nav.tsx`: se agrega el link "Acerca de" → `/acerca-de` en desktop y menú móvil, y se ajusta `isActive` para reflejar la nueva ruta.

**No incluye:**
- Dominio propio verificado en Resend — se usa el sandbox (`onboarding@resend.dev`); si en el futuro se requiere enviar a destinatarios arbitrarios o usar un remitente con marca propia, será un spec/ajuste posterior.
- Persistencia de los mensajes de contacto (no se guardan en ninguna base de datos ni `localStorage`; el correo es el único registro).
- Rate limiting, CAPTCHA o protección anti-spam (honeypot, etc.).
- Autenticación o pre-llenado del formulario con datos de la sesión simulada (`av_user`) — el formulario es anónimo, igual que en el template.
- Internacionalización — contenido fijo en español, como el resto del proyecto.
- Reintentos automáticos o cola de envío ante fallos de Resend — el usuario debe reintentar manualmente reenviando el formulario.

## Modelo de datos

Esta feature no introduce datos persistentes (no hay base de datos ni `localStorage`). Sí define tipos y un contrato de API entre el cliente y la nueva ruta `app/api/contacto/route.ts`.

```ts
// Valores del formulario de contacto (estado local en el client component)
interface ContactFormValues {
  name: string;
  email: string;
  message: string;
}

// Estado de envío del formulario — reemplaza el sent/shake booleano del template
// por una máquina de estados que cubre el caso real de red
type ContactStatus = "idle" | "sending" | "success" | "error";
```

```ts
// Body enviado por el cliente a POST /api/contacto
interface ContactRequestBody {
  name: string;
  email: string;
  message: string;
}

// Respuesta de la API route
type ContactResponse =
  | { ok: true }
  | { ok: false; error: string };
```

### Variable de entorno

```
# .env.local (no versionado)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
```

Se documenta con un `.env.local.example` (sí versionado) que contiene únicamente `RESEND_API_KEY=` como referencia para quien clone el repo. El valor real lo completa el usuario con su propia clave de resend.com; no se genera ni se hardcodea ninguna clave en este spec.

### Constantes fijas (no configurables por env, por ser del alcance acordado)

```ts
const CONTACT_TO = "edd.develit@gmail.com";
const CONTACT_FROM = "Arcade Vault <onboarding@resend.dev>";
```

## Plan de implementación

1. **Instalar dependencia y preparar entorno** — `npm install resend`; crear `.env.local.example` (versionado) con `RESEND_API_KEY=` como placeholder; agregar `RESEND_API_KEY` real a `.env.local` local (no versionado, la completa el usuario con su clave de resend.com).

2. **Migrar CSS de about/contacto** — Portar a `app/globals.css` las clases usadas por `about.jsx` que hoy no existen (`.about-*`, `.contact-*`, `.highlight-*`, `.terminal-*`, `.field`, `.div-bar`, `.div-pixels`), copiándolas tal cual desde `references/resources/home-about/styles.css`.

3. **Página `/acerca-de` — hero y contenido estático** — Crear `app/acerca-de/page.tsx` como client component (necesario por el reveal-on-scroll), migrando el hero "ACERCA DE ARCADE VAULT", los 3 highlights con íconos pixel SVG, y el banner divisor, reutilizando el mismo patrón `useReveal`/`IntersectionObserver` que Home (spec 02).

4. **Componente `ContactForm`** — Crear `components/ContactForm.tsx` (client component) migrando el formulario (nombre, email, mensaje) y la validación de campos vacíos (shake), pero cambiando el submit para que dispare un `fetch` real a `/api/contacto` en vez de `setSent` directo.

5. **Máquina de estados de envío** — Implementar en `ContactForm` los estados `idle → sending → success | error`: `sending` muestra las líneas de terminal ("Conectando…", "Validando…", "Transmitiendo…") como loading real mientras se espera la respuesta; `success` muestra la línea final con el nombre, igual que el template; `error` muestra una línea de error dentro del mismo panel, conservando los valores ya escritos para reintentar.

6. **API route `/api/contacto`** — Crear `app/api/contacto/route.ts` (POST): valida en servidor que nombre/email/mensaje no estén vacíos y que el email tenga formato válido; si falla, responde `{ ok: false, error }` con status 400. Si pasa, instancia el SDK de Resend con `RESEND_API_KEY`, envía el correo a `CONTACT_TO` con `reply-to` igual al email del formulario, y responde `{ ok: true }` o `{ ok: false, error }` según el resultado de Resend.

7. **Integrar `ContactForm` en la página** — Insertar el componente dentro de la sección de contacto de `app/acerca-de/page.tsx`, junto con la intro y los 3 tips migrados tal cual del template.

8. **Actualizar Nav** — En `components/Nav.tsx`: agregar el link "Acerca de" → `/acerca-de` en desktop y en el menú móvil, y ajustar `isActive` para que se marque activo en esa ruta.

9. **Verificación end-to-end** — Con `RESEND_API_KEY` real configurada: probar que enviar el formulario vacío dispara el shake sin hacer ninguna llamada de red; enviar un mensaje válido y confirmar que el correo llega a `edd.develit@gmail.com` con el `Reply-To` correcto; forzar el estado de error (por ejemplo, quitando temporalmente la key) y confirmar que se muestra sin perder los datos del formulario; correr `npm run build` y `npm run lint`.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores.
- [ ] `npm run lint` no reporta errores.
- [ ] `/acerca-de` muestra el hero "ACERCA DE ARCADE VAULT" con kicker, título, texto de misión y los 3 highlights (con ícono, texto y color correspondiente).
- [ ] El banner divisor animado aparece entre el hero y la sección de contacto.
- [ ] Al hacer scroll, las secciones con clase `.reveal` aparecen con su animación (no están visibles de golpe al cargar la página).
- [ ] La sección de contacto muestra la intro, los 3 tips y el formulario (nombre, email, mensaje).
- [ ] Enviar el formulario con algún campo vacío dispara la animación de "shake" y **no** realiza ninguna llamada a `/api/contacto`.
- [ ] Enviar el formulario con datos válidos muestra la secuencia de líneas de terminal ("Conectando…", "Validando…", "Transmitiendo…") mientras se espera la respuesta real de la API.
- [ ] Al completarse el envío con éxito, llega un correo real a `edd.develit@gmail.com` con: nombre, email y mensaje del formulario, y `Reply-To` igual al email ingresado.
- [ ] Tras el éxito, se muestra la línea final "MENSAJE RECIBIDO…" con el nombre en mayúsculas, y el botón "ENVIAR OTRO MENSAJE" reinicia el formulario a su estado vacío.
- [ ] Si la API falla (ej. `RESEND_API_KEY` inválida o ausente), se muestra una línea de error dentro del mismo panel terminal, sin borrar los valores ya escritos en nombre/email/mensaje.
- [ ] Llamar a `POST /api/contacto` directamente con un body vacío o con un email mal formado responde `{ ok: false, error }` con status 400, sin enviar ningún correo.
- [ ] El Nav (desktop y menú móvil) muestra el link "Acerca de" apuntando a `/acerca-de`, y se marca como activo únicamente en esa ruta.
- [ ] `RESEND_API_KEY` no aparece hardcodeada en ningún archivo versionado; `.env.local` no está trackeado por git (ya cubierto por `.env*` en `.gitignore`); existe `.env.local.example` versionado con `RESEND_API_KEY=` como placeholder.

## Decisiones tomadas y descartadas

- **Ruta `/acerca-de` en vez de `/about` (tomada).** Consistente con la mayoría de rutas del proyecto (`/biblioteca`, `/salon-de-la-fama`), todas en español. *Descartada:* `/about`, que hubiera coincidido con el nombre del componente de referencia (`about.jsx`) y con `/login` (única ruta en inglés), pero rompía el patrón dominante del resto del sitio.

- **Remitente con sandbox de Resend (`onboarding@resend.dev`) (tomada).** No requiere configurar DNS ni verificar un dominio propio, lo cual mantiene el spec enfocado en la integración funcional. *Descartada:* usar un dominio propio verificado, por ser trabajo adicional (configuración DNS) no solicitado y que puede resolverse después si se necesita un remitente con marca propia.

- **Animación de terminal conservada como loading real (tomada).** Se mantiene la secuencia de líneas "[OK] Conectando…/Validando…/Transmitiendo…" del template, pero ahora reflejando el estado real de la petición (`sending`) en vez de ser una simulación con `setTimeout` desconectada de la red. *Descartada:* reemplazarla por un spinner/texto genérico, por perder fidelidad visual con el template sin ninguna ganancia real.

- **Nuevo estado de error, ausente en el template original (tomada).** El template solo contemplaba éxito o validación de campos vacíos, porque no hacía ninguna llamada de red real. Al conectar Resend, una falla de API es un caso posible y debe ser visible para quien llena el formulario. *Descartada:* dejarlo sin manejar (fallo silencioso), porque el usuario no se enteraría de que su mensaje no llegó.

- **`Reply-To` con el email del formulario (tomada).** Permite responder directamente al visitante desde el cliente de correo, sin copiar/pegar su dirección manualmente. *Descartada:* omitirlo y depender solo del cuerpo del correo, por ser una fricción innecesaria para quien recibe el mensaje.

- **Validación duplicada en cliente y servidor (tomada).** El endpoint `POST /api/contacto` es público y alcanzable sin pasar por el formulario; validar solo en el cliente lo dejaría abierto a envíos vacíos o malformados. *Descartada:* confiar únicamente en la validación del cliente, por ser más simple pero insegura para un endpoint expuesto.

- **`.env.local.example` versionado como documentación (tomada).** Deja explícito el nombre de la variable de entorno requerida (`RESEND_API_KEY`) para quien clone el repo, sin exponer ningún valor real. *Descartada:* no documentarlo, porque el nombre de la variable no es derivable del código sin leer la API route.

- **Sin persistencia de mensajes, rate limiting ni protección anti-spam (tomada).** Mantiene el alcance acotado a "que el formulario envíe un correo real", igual que el criterio de scope mínimo de los specs 01 y 02. *Descartada:* agregar honeypot/captcha o guardar los mensajes en algún lado, por ser esfuerzo adicional no solicitado que ameritaría su propia definición de producto (¿dónde se guardan?, ¿quién los ve?).

## Riesgos identificados

- **Restricción del sandbox de Resend.** Sin un dominio verificado, el sandbox (`onboarding@resend.dev`) solo permite enviar correos a la dirección de email con la que se registró la cuenta de Resend. Si `edd.develit@gmail.com` no es esa dirección exacta, todos los envíos fallarán con un error de la API de Resend, incluso con la key correctamente configurada. *Mitigación:* confirmar esta restricción durante la verificación del paso 9 enviando un mensaje real; si falla por este motivo, verificar que la cuenta de Resend esté registrada con `edd.develit@gmail.com`, o evaluar verificar un dominio propio en un ajuste posterior.

- **Exposición de `RESEND_API_KEY` en el cliente.** Un error común es referenciar el SDK de Resend o la key desde un client component (o con prefijo `NEXT_PUBLIC_`), lo que la expondría en el bundle del navegador. *Mitigación:* el uso del SDK de Resend queda confinado exclusivamente a `app/api/contacto/route.ts` (server-side); `ContactForm` solo hace `fetch` al endpoint, nunca importa el SDK ni la key.

- **`RESEND_API_KEY` ausente o inválida en desarrollo.** Si un desarrollador clona el repo sin completar `.env.local`, el endpoint fallará en cada intento de envío. *Mitigación:* la API route debe capturar el error de Resend (o la ausencia de la key) y responder `{ ok: false, error }` de forma controlada — nunca un 500 sin manejar — para que el estado de error del formulario se muestre correctamente en vez de un fallo genérico o un crash del servidor.

- **Componente cliente olvidado en `/acerca-de`.** La página depende de `useEffect`/`IntersectionObserver` (reveal-on-scroll) y de estado (formulario), igual que Home en el spec 02. Si se omite `"use client"`, Next.js no falla en build pero la página pierde interactividad silenciosamente. *Mitigación:* marcar `app/acerca-de/page.tsx` y/o `ContactForm.tsx` como client component desde el paso 3/4, y verificar en el navegador (paso 9) que el reveal y el formulario funcionan, no asumirlo por ausencia de errores de build.

- **Migración de CSS incompleta o con colisiones.** Se portan selectores nuevos (`.about-*`, `.contact-*`, `.highlight-*`, `.terminal-*`, `.field`) desde `styles.css` a `globals.css`, con riesgo de nombres que ya existan o de omitir alguno. *Mitigación:* copiar por sección completa (no selector por selector) y comparar visualmente `/acerca-de` contra el template antes de dar el paso por cerrado, igual que se hizo en el spec 02.
