# fc-mini-crm
## Amaç
Teknik servis ve küçük ajanslar için mini CRM / teklif-iş takip paneli (Bionluk portföy projesi 6; canlı demo, TR arayüz).
## Stack
SvelteKit + Drizzle + postgres.js + adapter-vercel + PostgreSQL; Vitest + Playwright. Mimari: docs/ARCHITECTURE.md (onaylı)
## Komutlar
- test: TBD
- build: TBD
## Model rolleri
Claude = planlar, kod yazar, commit eder; Gem Neon = kod/plan review ve ikinci görüş; Hydrogen = araştırma özetleri (reports/). Ayrıntı: kullanıcının global ~/.claude/CLAUDE.md dosyası.
## Kurallar
- Kuralları yalnızca CLAUDE.md'de düzenle (AGENTS.md/GEMINI.md symlink).
- Mimari karar onaylanıp docs/ARCHITECTURE.md'ye yazılmadan uygulama kodu yazılmaz.
- Önce araştırma: docs/NOTES.md ve reports/ dolar, sonra mimari kullanıcıya onaylatılır.
- Test: yeni davranış ve hata düzeltmesinde testi uygulamadan önce çalıştır ve FAIL gör; yalnız-mock ya da totolojik test yazma.
- Her görevin bir "bitti ne zaman" satırı olur.
- Kritik iş başka bir ajan/model tarafından gözden geçirilir.
- CLAUDE.md kısa kalır (≤40 satır); ayrıntı docs/ altına gider.
- Push'u yalnızca kullanıcı yapar.
- Portföy: Visbody markası/rengi/verisi kullanılmaz; LLM/RAG özelliği yok; deploy adımları kullanıcıya ait.
## Bitti tanımı
Görevin "bitti ne zaman" koşulu doğrulandı (kodda kabul testi geçer), kritik iş başka ajan/model tarafından gözden geçirildi, madde BACKLOG'dan CHANGELOG'a taşındı.
## Bağlantılar
- docs/NOTES.md (ürün kırılımı) | docs/ARCHITECTURE.md (mimari) | docs/BACKLOG.md (iş listesi) | docs/CHANGELOG.md (biten işler)
- docs/CONSTANTS.md (sabitler: endpoint, adres, sürüm) | reports/ (araştırma çıktıları)
