# Simsalabit

**Dilo. Créalo. Juega. / Sag es. Bau es. Spiel es.**

Web donde los niños crean juegos y mini-apps hablando. Cada creación tiene un enlace público
(`/j/<id>`) que se abre en cualquier móvil, y un botón **Hazlo tuyo** para copiarla y cambiarla.

## Publicar en Vercel (unos 10 minutos)

1. Entra en **vercel.com** con tu cuenta de GitHub.
2. **Add New → Project** → elige el repositorio **simsalabit** → **Deploy**.
3. En el proyecto: **Storage → Create → Blob** → conéctalo al proyecto (crea la variable `BLOB_READ_WRITE_TOKEN` sola).
4. **Settings → Environment Variables** → añade `ANTHROPIC_API_KEY` con tu clave de console.anthropic.com.
5. **Deployments → Redeploy**. Listo: tu web estará en `https://simsalabit-xxx.vercel.app`.

Opcional: `SIMSALABIT_MODEL` para cambiar el modelo (por defecto `claude-sonnet-5-5`).

## Qué hay dentro

- `app/page.js` – la app: micro, crear, cambiar, enviar enlace, control parental, español/alemán.
- `app/j/[id]/page.js` – página pública para jugar una creación.
- `app/api/create` – llama a la IA y devuelve la creación en directo.
- `app/api/save`, `app/api/game/[id]` – guardan y leen las creaciones (Vercel Blob).
- `lib/prompt.js` – reglas de seguridad y técnicas para la IA.

## Pendiente antes de abrirlo al público

- Límite de uso por persona/día en el servidor (ahora solo hay límite en el móvil del niño).
- Cuentas de padres y consentimiento (RGPD / protección de datos de menores).
- Botón para que los padres borren una creación publicada, y para denunciar contenido.
