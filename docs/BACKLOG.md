# Backlog
## Yapılacak
- [ ] 1. SvelteKit iskeleti + Drizzle şema + migrasyon + docker Postgres — bitti ne zaman: `npm test` ve migrasyon boş DB'de çalışır
- [ ] 2. Domain saf fonksiyonlar (money/KDV, status geçiş tablosu, balance, csv, phone) + birim testler — bitti ne zaman: testler önce FAIL görüldü, sonra geçer
- [ ] 3. Auth: imzalı cookie rol geçişi + hooks guard + rol testleri — bitti ne zaman: staff ödeme/CSV'de 403, atanmamış işi açamaz
- [ ] 4. Müşteri ve iş CRUD, durum geçişi + work_logs (aynı transaction) — bitti ne zaman: entegrasyon testi gerçek Postgres'te geçer
- [ ] 5. Teklif editörü (kalemler, KDV, revizyon, tek onaylı indeks, yazdırma) — bitti ne zaman: paralel iki onay → 1 başarı, indeks kalkınca test FAIL
- [ ] 6. Tahsilat + türetilmiş bakiye — bitti ne zaman: kısmi/tam ödeme sonrası bakiye ve durum doğru
- [ ] 7. Kanban (durum seçici) + filtreli liste + pano (4 KPI) — bitti ne zaman: e2e 360px ve masaüstü geçer
- [ ] 8. Müşteri takip sayfası /takip/[token] (görüntüle + Onayla/Reddet, hız sınırı, PII yok) — bitti ne zaman: yanlış token 404, iç not sızmaz
- [ ] 9. wa.me/mailto linkleri, CSV dışa aktarım (kesinti sırasında ilk gider)
- [ ] 10. Deterministik seed + korumalı demo-reset endpoint'i + panel butonu + KVKK uyarısı — bitti ne zaman: reset sonrası başlangıç verisi e2e'de doğrulanır
- [ ] 11. Tam e2e akışı (müşteri→iş→teklif→onay→ödeme→bakiye 0→teslim) + TR arayüz cilası, README, vaka metni taslağı
## Devam eden
