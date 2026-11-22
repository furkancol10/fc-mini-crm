# Mimari taslak (Opus, bağımsız)

Girdi: reports/01 (rakip eşleştirmeleri kullanılmadı, bkz 04), 02, 03; fc-randevu-sistemi yapısı. Altyapı kardeşten alınır, 3 gün alan mantığına harcanır.

## 1. Kapsam

**MVP (3 gün):** müşteri rehberi; iş kaydı (servis kabulü/ajans talebi); kalemli teklif (KDV, revizyon, yazdırma); teklif onayı → iş "Onaylandı"; durum geçişleri + zaman çizelgesi; tahsilat (kısmi/tam); kanban + filtreli liste; pano (4 KPI); müşteri takip sayfası `/takip/[token]` (durum + teklif onay/ret); `wa.me`/`mailto:` linkleri; CSV dışa aktarım; Yönetici/Teknisyen rolü; demo sıfırlama.

**Sonra:** sürükle-bırak kanban, PDF üretimi, stok, e-Fatura, SMS/WhatsApp API, dosya yükleme, otomasyon, self-servis kayıt.

## 2. Klasör yapısı

```
src/lib/domain/        saf fonksiyonlar: money.ts (kuruş, KDV), status.ts (geçiş tablosu),
                       balance.ts, csv.ts, phone.ts, code.ts
src/lib/verticals/     servis.ts, ajans.ts (etiketler, metadata alanları, seed)
src/lib/server/db/     schema.ts, client.ts
src/lib/server/auth/   session.ts, guard.ts (requireRole)
src/lib/server/crm/    customers.ts, work.ts, quotes.ts, payments.ts, dashboard.ts
src/lib/server/demo/   seed.ts, reset.ts
src/routes/(panel)/    pano, isler, isler/[id], musteriler, musteriler/[id], teklif/[id]/yazdir
src/routes/giris  src/routes/takip/[token]  src/routes/api/{demo-reset,export.csv}
drizzle/  scripts/  tests/{unit,integration}  e2e/
```

## 3. Veri modeli (Postgres, para = kuruş `integer`)

- `workspaces(id, slug, name, vertical 'servis'|'ajans', settings jsonb)`; diğer tüm tablolarda `workspace_id`.
- `users(id, workspace_id, name, email, role 'admin'|'staff', password_hash)`, `sessions`.
- `customers(id, name, company, phone, email, kind 'lead'|'active', notes, created_at)`.
- `work_items(id, customer_id, assignee_id, code (insan okur, ör. TS-2611-0042), public_token (rastgele 16+ karakter), title, status, priority, metadata jsonb, brief, due_date, delivered_at, created_at)`.
  - Durumlar: `new, quoted, approved, in_progress, waiting, ready, delivered, cancelled`; etiketler dikeye göre. Geçişler `status.ts` tablosunda; geçersiz geçiş reddedilir.
  - `metadata` dikey config'teki Zod şemasıyla doğrulanır (servis: cihaz, seri no, aksesuar; ajans: kanal, teslim linki).
- `quotes(id, work_item_id, quote_no, version, status 'draft'|'sent'|'approved'|'rejected'|'expired', valid_until, vat_included bool, subtotal, vat_total, total, approved_at)`; kısmi tekil indeks: iş başına tek `approved`. Kalemler yalnız `draft` iken düzenlenir; revizyon = yeni sürüm kopyası, eskisi `rejected`.
- `quote_items(id, quote_id, kind 'part'|'labor'|'service', description, qty, unit_price, vat_rate, line_total)`.
- `work_logs(id, work_item_id, actor_id, type 'status'|'note'|'quote'|'payment', message, is_public, created_at)`.
- `payments(id, work_item_id, amount, method 'cash'|'card'|'transfer', invoice_ref, paid_at)`. Durum alanı yok; bakiye = onaylı teklif toplamı − ödemeler, ödeme durumu (Ödenmedi/Kısmi/Ödendi) türetilir.

Durum değişimi, teklif onayı ve ödeme her zaman log satırıyla **aynı transaction'da** yazılır.

## 4. Auth / rol

Kardeşteki oturum altyapısı (argon2 + DB oturumu + httpOnly çerez) alınır. Girişte "Yönetici olarak dene" / "Teknisyen olarak dene" butonları hazır hesapla oturum açar; üst çubukta rol ve dikey (Servis/Ajans) geçişi. Yetki sunucuda: `staff` yalnız atandığı işleri görür, durum/not ekler; ödeme, tutar KPI'ları, silme, CSV, teklif onayı `admin`'e özel. Her sorgu oturumdaki `workspace_id` ile filtrelenir.

## 5. Sayfalar / akışlar

1. **Pano:** açık teklif tutarı, aylık onaylanan, aktif ve geciken iş; son 10 log.
2. **İşler:** kanban (mobilde sekmeler) + tablo; filtreler URL'de; kartta "Durum değiştir".
3. **İş detayı:** metadata, teklifler, zaman çizelgesi, tahsilat/bakiye, WhatsApp mesajı, takip linki.
4. **Teklif editörü** → Gönder → müşteri `/takip/[token]`'da Onayla/Reddet (veya admin manuel onay) → iş `approved`.
5. **Müşteri detayı:** geçmiş işler ve teklifler.
6. **Takip sayfası:** girişsiz, hız sınırlı; yalnız `is_public` loglar görünür.

## 6. Test stratejisi

Her davranış için önce test yazılır, FAIL görülür, sonra kod.
- **Birim (Vitest):** KDV dahil/hariç ve yuvarlama, geçiş tablosu, bakiye, CSV (BOM, `;`, kaçış), telefon `+90`.
- **Entegrasyon (docker Postgres, mock yok):** onay → iş durumu + log tek transaction; iki paralel onay → tam 1 başarı (indeks kaldırılınca FAIL); workspace A, B'yi göremez; `staff` ödeme ekleyemez, atanmamış işi açamaz; yanlış token → 404, iç not sızmaz.
- **E2E (Playwright, 360px + masaüstü):** müşteri → iş → teklif → gönder → takip linkinden onay → ödeme → bakiye 0 → teslim; rol geçişinde tutarlar gizlenir; CSV indirilir.

## 7. Demo verisi / sıfırlama

`seed.ts` deterministik ("bugün"e göre tarih ofsetleri): her dikeyde ~8 müşteri, ~12 iş (her durumdan, 2 gecikmiş, 1 kısmi ödemeli, 1 revize teklifli), temsili Türkçe veri. Gece GitHub Actions cron → korumalı `/api/demo-reset`; panelde "Demo verisini sıfırla" (hız sınırlı). Girişte KVKK uyarısı: "Gerçek kişisel veri girmeyin".

## 8. Riskler ve açık sorular

- **Kapsam:** iki dikey + müşteri onayı + rol 3 günü zorlar. Kesinti sırası: CSV → müşteri onayı → ajans dikeyi.
- `metadata jsonb` filtrelemede zayıf; filtreler sabit kolonlarda.
- KDV oranları ve e-Fatura gereklilikleri doğrulanmadı; arayüzde "temsili" notu.
- Neon Free proje/dal limiti kontrol edilmeli.
- **Açık:** iki dikey tek demo URL'sinde mi, ayrı slug'larda mı? Teknisyen tüm işleri görsün mü? Müşteri onayı MVP'de kalsın mı? KDV varsayılanı dahil mi hariç mi?

## 9. Kararlar

| Karar | Gerekçe | Alternatif |
|---|---|---|
| SvelteKit + Drizzle + postgres.js + Vercel/Neon (kardeşle aynı) | Altyapı kopyalanır | Supabase (yeni öğrenme) |
| Kök varlık `work_item`; talep de bir iş (`new`) | "Teklifi işe dönüştür" kopya üretmez, tek zaman çizelgesi | Ayrı `leads`/`projects` tabloları |
| Dikey `workspace` düzeyinde config, iş düzeyinde değil | Gerçek müşteri tek sektördür; etiketler tutarlı | Her işte `work_type` |
| Para kuruş `integer`, hesap saf fonksiyonda | Yuvarlama hatası yok, birim testlenir | `numeric(12,2)` |
| Durum geçiş tablosu + log aynı transaction | Tutarlı geçmiş, geçersiz geçiş engellenir | Serbest durum alanı |
| Ödeme durumu türetilir | Çifte kaynak yok | `payment_status` kolonu |
| Tek onaylı teklif: kısmi tekil indeks | Yarış DB'de engellenir | Uygulama kontrolü |
| Takip linki rastgele token, kod değil | Kod tahmin edilebilir | Kod + telefon son 4 hane |
| Demo girişi tek tık rol butonları | Alıcı kayıt engeline takılmaz | Ortak şifre gösterimi |
| Kanban'da seçim kutusu, sürükle-bırak yok | Mobil ve e2e kolay | dnd kütüphanesi |
| Yazdırma CSS'i, PDF kütüphanesi yok | Sıfır bağımlılık | Puppeteer/pdf-lib |
