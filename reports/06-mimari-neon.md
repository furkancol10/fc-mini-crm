# fc-mini-crm — Mimari Taslak

*Not: `reports/01` içindeki rakip eşleştirmeleri `reports/04` bulguları nedeniyle karar temeli alınmadı. Mevzuat (KDV/KVKK) ve kullanıcı dönüşüm varsayımları doğrulanmamıştır. Stack, kardeş proje (`fc-randevu-sistemi`) ile uyumlu: SvelteKit + Drizzle ORM + `postgres.js` + `adapter-vercel` + PostgreSQL; LLM/AI yok.*

## 1. Kapsam (3 Günlük MVP vs Sonra)
- **MVP (Dahil):**
  - Tek panelde iki sektör modu (`service`: Teknik Servis, `agency`: Küçük Ajans); ortak şema, sektöre göre TR etiketler.
  - Müşteri/lead CRUD, geçmiş iş listesi, KVKK demo uyarısı.
  - İş/servis takibi: Kanban (masaüstü sürükle-bırak, mobilde durum seçici/sekme) + URL sorgu parametreli arama/filtreli tablo + zaman çizelgesi (`work_logs`).
  - Kalemli teklif (parça/işçilik/hizmet, revizyon, KDV %0/%10/%20 hariç/dahil, `@media print` yazdırılabilir görünüm) ve onay → aktif iş akışı.
  - Manuel fatura no (`invoice_ref`) ve kısmi/tam tahsilat; kalan bakiye türetilir.
  - Müşteri salt-okunur takip ekranı (`/takip/[code]`), 4 KPI kartlı özet pano, UTF-8 BOM + `;` CSV aktarım, `wa.me/90...` hazır mesaj linki, tek tık rol geçişi, gece + tek tık demo sıfırlama.
- **Sonra (Kapsam Dışı — arayüzde açıkça belirtilir):**
  - GİB e-Fatura/e-Arşiv, sanal POS, SMS/WhatsApp Business API, IMAP e-posta, depo/stok düşümü, barkod donanımı, çoklu kiracı, gerçek auth/OAuth.

## 2. Klasör Yapısı
```text
src/
  hooks.server.ts               # Demo rol/kullanıcı cookie doğrulama
  lib/
    server/db/{index,schema,seed}.ts
    server/domain/{pricing,workflow,csv,authz}.ts
    i18n/labels.ts              # service/agency TR etiketleri + TRY format
    components/                 # KanbanBoard, QuoteEditor, RoleSwitcher, DemoBanner
  routes/
    +page.svelte (+page.server.ts)          # Özet pano (4 KPI + son hareketler)
    isler/{+page,yeni,[id],[id]/yazdir}/    # Kanban/tablo, detay, yazdırma
    musteriler/{+page,[id]}/                # Müşteri/lead yönetimi
    takip/[code]/+page.svelte               # Kimliksiz müşteri takip sayfası
    api/{export,cron/reset,demo-reset}/+server.ts
drizzle/                        # SQL migrasyonları
tests/{unit,e2e}/               # Vitest birim + Playwright E2E
```

## 3. Veri Modeli (PostgreSQL + Drizzle)
Tüm para alanları yuvarlama hatasını önlemek için kuruş `integer` (`*_kurus`) tutulur; arayüzde `tr-TR` `TRY` biçimlenir.
- **`users`**: `id`, `name`, `role` (`admin | staff`), `specialty` (`service | agency | all`).
- **`customers`**: `id`, `name`, `company_name`, `phone`, `email`, `tax_no`, `customer_type` (`lead | active`), `notes`, `created_at`.
- **`work_items`**: `id`, `customer_id` (FK), `assigned_to` (FK `users`, nullable), `code` (unique, örn. `SRV-8K4M2Q`), `work_type` (`service | agency`), `title`, `status`, `priority` (`low | normal | high`), `metadata` (`jsonb`: serviste cihaz/marka/seri no/aksesuar; ajansta kanal/teslim linki), `diagnosis_or_brief`, `due_date`, `delivered_at`, `created_at`.
  - **Durumlar (7):** `new` (Kabul/Lead), `quoted` (Teklif), `approved` (Onaylandı), `in_progress` (İşlemde), `waiting` (Parça/Müşteri Bekliyor), `delivered` (Teslim Edildi), `cancelled` (İptal). *(Not: `reports/02`'deki 9 durum Kanban sadeliği için 7'ye indirildi; açık soru.)*
- **`quotes`**: `id`, `work_item_id` (FK), `quote_no` (unique), `version` (int), `status` (`draft | sent | approved | rejected | expired`), `tax_mode` (`excluded | included`), `tax_rate` (0|10|20), `subtotal_kurus`, `tax_kurus`, `total_kurus`, `valid_until`, `approved_at`, `created_at`.
- **`quote_items`**: `id`, `quote_id` (FK cascade), `item_type` (`part | labor | service`), `description`, `quantity` (`numeric(10,2)`), `unit_price_kurus`, `line_total_kurus`.
- **`work_logs`**: `id`, `work_item_id` (FK cascade), `actor_id` (FK `users`), `log_type` (`status_change | note | quote_event | payment_event`), `message`, `created_at`.
- **`payments`**: `id`, `work_item_id` (FK), `quote_id` (FK, nullable), `invoice_ref`, `amount_kurus`, `method` (`cash | card | transfer`), `status` (`pending | paid | refunded`), `paid_at`, `created_at`. *(Bakiye: onaylı teklif − `SUM(paid)`.)*

## 4. Auth ve Rol (Demo)
- Kayıt/giriş bariyeri yok; üst çubukta tek tık rol geçişi, HMAC-imzalı `HttpOnly` cookie (`demo_user_id`) ile tutulur.
- Yetki denetimi `hooks.server.ts` ve sunucu action/endpoint katmanında zorunludur:
  - **Yönetici (`admin`):** Tüm kayıtlar, finansal KPI'lar, teklif onay/silme, tahsilat, CSV aktarım, sıfırlama.
  - **Personel (`staff`):** Yalnızca atanan işler, durum/not/teşhis güncelleme; ciro/tahsilat toplamı, silme ve CSV `403`.
- `/takip/[code]` kimliksizdir; telefon/e-posta/iç not sızdırmaz (KVKK).

## 5. Sayfalar ve Akışlar
- **Özet Pano (`/`):** 4 KPI kartı (açık teklif, aylık onaylı tutar, aktif iş, geciken/yaklaşan), sektör filtresi, son 10 hareket.
- **İşler (`/isler`):** Kanban (6 aktif sütun) + filtrelenebilir tablo (`?q=&type=&status=&assignee=`), CSV indirme.
- **İş Detayı (`/isler/[id]`):** Durum geçişi, zaman çizelgesi, teklif/revizyon/onay, kısmi/tam tahsilat, `wa.me/90...` linki, yazdırma (`/yazdir`).
- **Müşteriler (`/musteriler`):** Rehber, geçmiş işler, bakiye.
- **Ana akış:** Kabul/Lead → Teklif → Onay (log + durum `approved`) → İşlem/Bekleme → Teslim + Tahsilat.

## 6. Test Stratejisi
- **Önce-başarısız-test:** Yeni davranış/düzeltmede önce kabul testi yazılır, FAIL görülür, sonra kodlanır; yalnız-mock/totolojik test yok.
- **Vitest (birim):** KDV hariç/dahil kuruş hesabı, bakiye/iade türetme, durum geçiş kuralları, CSV BOM + `;` + formül kaçışı (`=,+,-,@`), yetki guard'ları (`staff` → `403`).
- **Playwright E2E (gerçek test DB):** Servis kabul → teklif → onay → Kanban sürükleme (yenilemede kalıcılık) → kısmi+tam tahsilat; rol değişiminde yetki kısıtı; `/takip/[code]` PII gizliliği ve `404`; sıfırlama sonrası başlangıç verisi.

## 7. Demo Verisi ve Sıfırlama
- Deterministik `seed.ts`: 2 demo kullanıcı, 8 müşteri, 14 TR iş kaydı (7 servis + 7 ajans), revizyonlu teklifler, loglar, kısmi/tam ödemeler. Visbody markası/verisi ve gerçek kişisel veri yok.
- Tek transaction'da `TRUNCATE ... RESTART IDENTITY CASCADE` + `seed()`.
- **Tetikleme:** Vercel Cron (`CRON_SECRET` doğrulamalı `POST /api/cron/reset`) + üst çubukta onaylı, rate-limit'li "Demo Verisini Sıfırla".

## 8. Riskler ve Açık Sorular
- **Riskler:** 3 günde kapsam taşması (grafik/karmaşık modül dışarıda tutulmalı); serverless ortamda Postgres bağlantı tükenmesi (`postgres.js` pooler + düşük `max` şart); açık demoda spam/CSV injection (uzunluk limiti, rate-limit, formül kaçışı şart).
- **Açık Sorular:**
  1. `work_items.status` 7 sade durum mu, `reports/02`'deki 9 durum mu olsun?
  2. Canlı PostgreSQL sağlayıcısı (Neon/Supabase) ve cron saati (örn. TR 03:00)?
  3. `/takip/[code]` kısa rastgele kod (`SRV-8K4M2Q`) mı, sıralı (`SRV-2601`) mı? *(Güvenlik için rastgele önerilir.)*
  4. Teklif çıktısında `@media print` yeterli mi?

## 9. Kararlar Tablosu
| Karar | Gerekçe | Alternatif |
|---|---|---|
| SvelteKit + Drizzle + `postgres.js` + `adapter-vercel` | Kardeş proje (`fc-randevu-sistemi`) ile hız ve bakım uyumu | Prisma / Next.js |
| Tek şema + `work_type` + `jsonb` `metadata` | 3 günde iki sektörü tablo çoğaltmadan destekler | Sektöre ayrı tablolar |
| Para birimi: `integer` kuruş (`*_kurus`) | JS/TS'de kayan nokta hatasız, deterministik hesap | `NUMERIC(12,2)` |
| 7 sade iş durumu (Kanban'da 6 sütun) | Mobilde ve Kanban'da okunaklı, 3 gün kapsamına uygun | 9 durum (`reports/02`) |
| İmzalı cookie ile tek tık rol geçişi + sunucu guard | Bionluk alıcısına sıfır sürtünme + gerçek yetki kanıtı | E-posta/şifre login |
| `@media print` teklif/fiş görünümü | Serverless'ta Chromium/PDF yükü olmadan hızlı teslim | Playwright/PDFKit üretimi |
| Tahsilat durumunu `payments`'tan türetme | Ödenmedi/Kısmi/Ödendi tutarsızlığını önler | Ayrı `payment_status` kolonu |

