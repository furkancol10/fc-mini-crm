# Changelog
- 2026-11-22: proje iskeleti kuruldu
- 2026-11-22: araştırma (reports/01-04) ve mimari taslakları (05-06); mimari kullanıcı tarafından onaylandı
- 2026-11-22: BACKLOG 1-6 bitti (Neon yazdı, Sonnet doğruladı): iskelet, şema, domain, auth, iş/teklif/tahsilat; durum geçişinde FOR UPDATE + yarış testi. Postgres host portu 5436 (docs/DEVIATIONS.md)
- 2026-11-22: BACKLOG 7-10 bitti (Neon yazdı, Sonnet doğruladı): pano, kanban+filtre, /takip/[token], CSV, wa.me/mailto, seed, demo-reset, KVKK. Bilinen düşük bulgular: müşteri reddi delivered/cancelled işte çalışır; ilike joker kaçışı yok
- 2026-11-22: BACKLOG 11 bitti (Neon yazdı, Sonnet doğruladı): Playwright e2e (360px + masaüstü), TR arayüz cilası, README, docs/VAKA.md; düşük bulgular kapandı (delivered/cancelled red engeli, ilike kaçışı); e2e hız sınırı env geçersiz kılması Vercel'de yok sayılır
