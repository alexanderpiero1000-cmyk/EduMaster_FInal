# EduMaster.ai — Fase 3: Dashboard + eventos (datos DEMO)

    npm install
    npm run dev      # http://localhost:5173
    npm run build

- `src/data/db.ts`: BD simulada relacional (students, courses, enrollments, assessments, attempts, certs...).
- `src/data/selectors.ts`: KPIs, dominio, recomendaciones y estimaciones derivados de la BD.
- `src/store/Store.tsx`: acciones que conectan los módulos + simulador de eventos.
- `src/views/`: una vista por módulo del manual.
- `src/components/`: componentes reutilizables del manual (KpiCard, TrendChart, NeuralNetworkCanvas...).
