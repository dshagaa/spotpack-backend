# SpotPack Backend

API para digitalizar schedules de convenciones furry usando IA. Una persona sube la imagen → MiMo V2.5 extrae los datos → JSON estructurado.

**Stack:** Supabase Edge Functions (Deno/TypeScript) + PostgreSQL + Storage

---

## Setup

### 1. Requisitos

- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Docker (para desarrollo local)
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [OpenCode Zen](https://opencode.ai/docs/zen/) (API key)

### 2. Clonar e inicializar

```bash
git clone https://github.com/dshagaa/spotpack-backend.git
cd spotpack-backend
supabase init
supabase link --project-ref <tu-project-ref>
```

### 3. Variables de entorno

```bash
supabase secrets set SEED_MAINTAINER_KEY="<bootstrap-key>"
supabase secrets set OPENCODE_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
supabase secrets set OPENCODE_BASE_URL="https://opencode.ai/zen/v1"
supabase secrets set VISION_MODEL="mimo-v2.5-free"
```

Luego: hashear `SEED_MAINTAINER_KEY` con SHA-256 e insertarlo manualmente en `api_keys` (ver `AGENTS.md`).

### 4. Base de datos

```bash
supabase db push          # Aplica las migraciones
```

### 5. Storage bucket

Crear bucket `schedule-images` desde el dashboard de Supabase (Storage → New Bucket → Private). Configurar TTL de 7 días.

### 6. Desarrollo local

```bash
supabase start            # Levanta DB, API, Storage local (Docker)
supabase functions serve  # Sirve Edge Functions en local
```

### 7. Deploy

```bash
supabase functions deploy import-schedule
supabase functions deploy get-events
supabase functions deploy get-event
supabase functions deploy create-event
supabase functions deploy update-event
supabase functions deploy delete-event
supabase functions deploy create-api-key
```

---

## Endpoints

Base URL: `https://<project-ref>.supabase.co/functions/v1`

**Todos los endpoints requieren `x-api-key` header.**

```bash
# Listar eventos (general+)
curl https://<project-ref>.supabase.co/functions/v1/get-events \
  -H "x-api-key: <api-key>"

# Ver un evento con sus items (general+)
curl "https://<project-ref>.supabase.co/functions/v1/get-event?id=<uuid>" \
  -H "x-api-key: <api-key>"

# Crear evento (general+)
curl -X POST https://<project-ref>.supabase.co/functions/v1/create-event \
  -H "x-api-key: <api-key>" \
  -H "Content-Type: application/json" \
  -d '{"name":"FurCon 2026","start_date":"2026-08-15","end_date":"2026-08-17","location":"Hotel Example"}'

# Importar schedule desde imagen (general+)
curl -X POST https://<project-ref>.supabase.co/functions/v1/import-schedule \
  -H "x-api-key: <api-key>" \
  -F "image=@schedule.png" \
  -F "event_id=<uuid>"

# Eliminar evento (maintainer only)
curl -X DELETE "https://<project-ref>.supabase.co/functions/v1/delete-event?id=<uuid>" \
  -H "x-api-key: <maintainer-key>"

# Crear API key (maintainer only)
curl -X POST https://<project-ref>.supabase.co/functions/v1/create-api-key \
  -H "x-api-key: <maintainer-key>" \
  -H "Content-Type: application/json" \
  -d '{"role":"general","label":"Frontend App"}'
```

---

## API Keys

Las keys viven en la tabla `api_keys` (hasheadas con SHA-256), no en variables de entorno.

| Rol | Permisos |
|-----|----------|
| `general` | Leer, crear, actualizar, importar |
| `maintainer` | Todo lo anterior + eliminar, crear keys, ver logs |

**⚠️ La raw key se devuelve UNA SOLA VEZ al crearla. Si se pierde, crear una nueva.**

---

## AI Model

**MiMo V2.5 Free** via [OpenCode Zen](https://opencode.ai/docs/zen/). Multimodal (texto + visión), OpenAI-compatible, gratuito por tiempo limitado.

---

## Licencia

MIT
