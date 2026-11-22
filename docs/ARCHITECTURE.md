# Mimari
Durum: onaylı (kullanıcı, 2026-11-22)
Kaynak: reports/05 (Opus) + reports/06 (Neon), GM birleştirmesi. Ayrıntı ve gerekçe için iki rapora bak.

## Kararlar
| Karar | Seçim | Not |
|---|---|---|
| Stack | SvelteKit + Drizzle + postgres.js + adapter-vercel + PostgreSQL (kardeş fc-randevu-sistemi ile aynı) | iki taslak aynı |
| Kök varlık | `work_items`: talep de baştan iş (`new`); teklif onayı durumu değiştirir, kopya yok | Opus |
| Sektör ayrımı | `work_items.work_type` (service/agency) + `metadata jsonb` (Zod ile doğrulanır); tek demo panelinde sektör filtresi/etiketleri | Neon; Opus'un workspace tablosu atıldı (çok kiracı gereksiz) |
| Para | kuruş `integer`; KDV oranı kalem başına, `vat_included` teklif başına; hesap saf fonksiyonda | iki taslak aynı |
| Durumlar | `new, quoted, approved, in_progress, waiting, ready, delivered, cancelled`; geçişler tablo ile, geçersiz geçiş reddedilir; durum+log aynı transaction | Opus (8); Neon 7 önerdi, bkz açık soru |
| Teklif | iş başına tek `approved` teklif: kısmi tekil indeks; revizyon = yeni sürüm, kalemler yalnız `draft`'ta düzenlenir | Opus |
| Ödeme | durum kolonu yok; bakiye = onaylı teklif − ödemeler, durum türetilir | iki taslak aynı |
| Auth | gerçek kayıt/giriş yok; tek tık rol (Yönetici/Teknisyen), HMAC imzalı HttpOnly cookie; yetki sunucuda (hooks + action) | Neon (argon2 oturumu atıldı) |
| Roller | staff: yalnız atanan işler, durum/not; admin: ödeme, KPI tutarları, silme, CSV, teklif onayı | iki taslak aynı |
| Müşteri takip | `/takip/[token]` rastgele token (kod değil), girişsiz, hız sınırlı, yalnız `is_public` loglar, PII yok | iki taslak aynı |
| Kanban | sürükle-bırak yok; kartta durum seçici (mobil + e2e kolay) | Opus |
| Çıktı | `@media print` teklif görünümü, PDF kütüphanesi yok; `wa.me` / `mailto:` linkleri; CSV (BOM, `;`, formül kaçışı) | iki taslak aynı |
| Demo verisi | deterministik seed (göreli tarihler), ~8 müşteri, ~14 iş, korumalı reset endpoint'i + panelde sıfırla butonu; KVKK uyarısı. Cron/deploy kullanıcıya ait | birleşik |

## Kapsam
MVP: müşteri rehberi, iş kaydı, kalemli teklif + revizyon + yazdırma, durum/zaman çizelgesi, tahsilat, kanban+filtreli liste, 4 KPI pano, takip sayfası, wa.me, CSV, rol, demo sıfırlama.
Sonra: PDF, stok, e-Fatura, SMS/WhatsApp API, dosya yükleme, otomasyon, gerçek auth.
Kesinti sırası (süre taşarsa): CSV → müşteri onayı → ajans dikeyi.

## Veri modeli (özet)
users, sessions yok (cookie) · customers(lead|active) · work_items(code, public_token, work_type, status, priority, metadata, assigned_to, due_date) · quotes(version, status, vat_included, toplamlar) · quote_items(kind, qty, unit_price, vat_rate) · work_logs(type, is_public) · payments(amount, method, invoice_ref, paid_at).

## Klasör yapısı
`src/lib/domain/` (money, status, balance, csv, phone) · `src/lib/server/{db,crm,demo}` · `src/routes/` (pano, isler, musteriler, takip/[token], api/{export,demo-reset}) · `drizzle/` · `tests/{unit,integration}` · `e2e/`

## Test
Önce-başarısız-test. Vitest birim (KDV/yuvarlama, geçiş tablosu, bakiye, CSV). Entegrasyon gerçek Postgres'te, mock yok (paralel iki onay → 1 başarı, indeks kalkınca FAIL; staff yetki sınırları; yanlış token 404). Playwright e2e 360px + masaüstü (müşteri→iş→teklif→onay→ödeme→bakiye 0→teslim).

## Riskler
3 günde kapsam taşması; serverless bağlantı tükenmesi (düşük max, pooler); jsonb'de filtre zayıf (filtreler sabit kolonlarda); açık demoda spam/CSV injection; KDV/e-Fatura mevzuatı doğrulanmadı ("temsili" notu); Neon Free limitleri.

## Verilen kararlar (2026-11-22, hepsi öneri yönünde)
1. 8 durum (ready dahil). 2. Takip sayfasında teklif Onayla/Reddet MVP'de. 3. İki sektör tek demo panelinde. 4. Teknisyen yalnız atanan işleri görür. 5. KDV varsayılanı hariç.
