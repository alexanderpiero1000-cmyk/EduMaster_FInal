# EduMaster.ai — Fase 3: Dashboard + eventos (datos DEMO)

    npm install
    npm run dev      # http://localhost:5173
    npm run build

- `src/data/db.ts`: BD simulada relacional (students, courses, enrollments, assessments, attempts, certs...).
- `src/data/selectors.ts`: KPIs, dominio, recomendaciones y estimaciones derivados de la BD.
- `src/store/Store.tsx`: acciones que conectan los módulos + simulador de eventos.
- `src/views/`: una vista por módulo del manual.
- `src/components/`: componentes reutilizables del manual (KpiCard, TrendChart, NeuralNetworkCanvas...).

## IA real opcional

El endpoint `/api/ai` está implementado como middleware en el servidor Vite; no hay un backend independiente. El navegador envía la solicitud al mismo origen y Vite reenvía los mensajes al proveedor. Para configurar una clave local, copia `.env.example` como `.env.local`, agrega tu clave allí y reinicia Vite:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
npm run dev
```

Configura `OPENAI_API_KEY` en `.env.local` (no uses el prefijo `VITE_`). No agregues ni compartas ese archivo; `.env.local` está excluido de Git. También puedes definir las variables en el entorno del proceso antes de iniciar Vite.

```powershell
$env:OPENAI_API_KEY="tu_clave"
npm run dev
```

`OPENAI_BASE_URL` y `OPENAI_MODEL` son opcionales; sus valores por defecto son `https://api.openai.com/v1` y `gpt-4o-mini`. Para un proveedor compatible, establece ambas variables al endpoint y modelo adecuados. El frontend nunca recibe la API Key.

El frontend y el endpoint se inician juntos con `npm run dev`. Para probar el build local, usa `npm run build` y después `npm run preview`; el middleware IA también se habilita en Vite Preview. Un despliegue estático no incluye este middleware y requiere publicar un backend seguro equivalente. Sin API Key, el endpoint devuelve un error explícito y el Tutor mantiene el respaldo local y la opción de pedir ayuda humana.

Si el endpoint devuelve HTTP 429 con el mensaje de cuota agotada, la conexión y la clave llegaron al proveedor, pero el proyecto asociado a esa clave no tiene cuota disponible. Revisa facturación y límite de gasto en la cuenta del proveedor; cambiar el código o la URL del frontend no resolverá esa condición. Los errores 429 de tasa de solicitudes/tokens se identifican por separado y pueden requerir esperar o ajustar los límites.

## Herramientas para docentes

El panel docente resume actividad, avance y calificaciones de sus cursos asignados. Incluye seguimiento basado en señales registradas, historial de estudiantes, respuestas a consultas de ayuda, filtros de evaluaciones y anuncios con confirmación antes de publicar. El asistente docente envía al proveedor datos agregados y alias de estudiantes; sus actividades generadas son borradores editables y no se publican ni crean evaluaciones oficiales automáticamente.
