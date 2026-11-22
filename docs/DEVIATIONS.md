# Sapmalar (Deviations)

1. **Docker Compose Postgres host portu (`5435` → `5436`)**:
   - Görev talimatında host portu `5435` istenmişti; ancak yerel makinede `5435` portu başka bir konteyner (`fc-fiyat-takip-wt-neon-db-1`) tarafından kullanımda olduğu için başka projeye dokunmadan `compose.yaml`, `.env.example`, `drizzle.config.ts` ve `src/lib/server/env.ts` varsayılanı `5436` (`${POSTGRES_PORT:-5436}:5432`) olarak ayarlandı.
