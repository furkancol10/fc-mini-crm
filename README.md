# Mini CRM — Teklif ve İş Takip Paneli

Teknik servisler ve küçük ajanslar için geliştirilmiş; müşteri kaydı, iş/servis takibi, kalemli KDV tekliflendirme, müşteri takip bağlantısı üzerinden onay/red ve tahsilat-bakiye yönetimi sunan Türkçe mini CRM uygulaması.

## Ne İşe Yarar?

Küçük işletmelerde teklifler e-posta ve WhatsApp mesajlarına, cihaz/proje durumları tablolara, tahsilatlar ayrı notlara dağılır. Mini CRM bu süreci tek bir kök kayıt (`work_items`) etrafında toplar: talep oluşturma, kalemli teklif hazırlama, revizyon, müşterinin giriş yapmadan teklifi onaylaması, kısmi/tam tahsilat ve teslim aşamaları tek bir zaman çizelgesinde izlenir.

## Özellikler

- **İki Sektör, Tek Panel:** Teknik servis (cihaz, marka, model, seri no, aksesuarlar) ve ajans/hizmet (kanal, teslim bağlantısı, kapsam) kayıtları ayrı etiketler ve `jsonb` alan doğrulaması (Zod) ile yönetilir.
- **Müşteri Rehberi:** Aday ve aktif müşteri kayıtları, `+90` telefon normalizasyonu, bağlı iş geçmişi, tek tık `wa.me` ve `mailto:` bağlantıları.
- **8 Aşamalı İş Akışı ve Kanban:** `Kabul/Talep → Teklif → Onaylandı → İşlemde → Bekliyor → Teslime Hazır → Teslim Edildi / İptal`. Geçersiz geçişler sunucu tarafında engellenir; eşzamanlı geçişler satır kilidi (`FOR UPDATE`) ile korunur. Masaüstünde sütunlu kanban, mobilde (360px) durum sekmeleri.
- **Kalemli KDV Teklif ve Revizyon:** Kuruş tabanlı tam sayı para hesabı, kalem başına %0 / %10 / %20 KDV, KDV hariç (varsayılan) veya dahil modu, sürümleyerek revizyon, `@media print` yazdırma görünümü. İş başına yalnızca tek onaylı teklif veritabanı kısmi tekil indeksi ile garanti edilir.
- **Girişsiz Müşteri Takip Ekranı (`/takip/[token]`):** Rastgele token ile erişim, yalnızca müşteriye açık (`is_public`) işlem geçmişi, kişisel veri (PII) gizliliği ve gönderilmiş teklifler için doğrudan Onayla / Reddet.
- **Tahsilat ve Türetilmiş Bakiye:** Kısmi veya tam tahsilat kayıtları (Nakit, Kart, Havale/EFT, belge no). Bakiye ve ödeme durumu (`Ödenmedi`, `Kısmi Ödendi`, `Ödendi`, `Fazla Ödeme`) onaylı teklif ve tahsilat toplamından türetilir.
- **Pano ve URL Filtreleri:** 4 özet KPI kartı, son 10 işlem kaydı; paylaşılabilir URL sorgu parametreleriyle arama, sektör, durum, öncelik, sorumlu ve geciken iş filtreleri.
- **CSV Dışa Aktarım:** Yalnızca Yönetici rolüne açık; Excel uyumlu UTF-8 BOM, `;` ayırıcı ve formül enjeksiyonu kaçışı (`=`, `+`, `-`, `@`).
- **Deterministik Demo Verisi:** 8 müşteri, 14 iş (7 servis + 7 ajans), teklifler, revizyonlar ve tahsilatlar; tek tıkla veya korumalı uç nokta üzerinden sıfırlanabilir.

## Ekran Akışı

1. **`/giris`** — KVKK demo uyarısı ve tek tık Yönetici / Teknisyen rol seçimi.
2. **`/pano`** — KPI özet kartları, son 10 hareket, Yönetici için CSV indirme ve demo sıfırlama.
3. **`/musteriler` ve `/musteriler/[id]`** — Müşteri ekleme, düzenleme, WhatsApp/e-posta kısayolları ve bağlı işler.
4. **`/isler`** — Liste ve Kanban görünümü, URL filtreleri, yeni servis/ajans işi oluşturma.
5. **`/isler/[id]`** — İş bilgileri, durum geçişi, zaman çizelgesi, teklif oluşturma/düzenleme/gönderme/revizyon, tahsilat ve müşteri takip paylaşımı.
6. **`/teklif/[id]/yazdir`** — Tarayıcı yazdırma ve PDF kaydetme için sade teklif çıktısı.
7. **`/takip/[token]`** — Müşterinin giriş yapmadan iş durumunu izlediği ve teklifi onaylayıp reddedebildiği ekran.

## Teknoloji Yığını

- **Uygulama:** SvelteKit (Svelte 5) + TypeScript + Tailwind CSS v4 + `@sveltejs/adapter-vercel`
- **Veritabanı:** PostgreSQL 17 + Drizzle ORM + `postgres.js` + Zod
- **Test ve Kalite:** Vitest (birim ve gerçek PostgreSQL entegrasyon testleri), Playwright (360px mobil + masaüstü E2E), ESLint, Prettier, `svelte-check`

## Yerelde Çalıştırma

### Ön Koşullar

- Node.js 22+
- Docker ve Docker Compose

### Kurulum ve Başlatma

```bash
# 1. Bağımlılıkları kurun
npm ci

# 2. Ortam değişkenleri dosyasını oluşturun (isteğe bağlı; varsayılanlar 5438 portunu kullanır)
cp .env.example .env

# 3. PostgreSQL konteynerini başlatın (varsayılan host portu: 5438)
npm run db:start

# 4. Şema migrasyonlarını uygulayın ve örnek demo verisini yükleyin
npm run db:migrate
npm run db:seed

# 5. Geliştirme sunucusunu başlatın
npm run dev
```

### Doğrulama ve Test Komutları

```bash
npm run check            # TypeScript ve Svelte tür denetimi
npm run lint             # Prettier biçim ve ESLint denetimi
npm run build            # Üretim derlemesi
npm run test:unit        # Birim testleri (para/KDV, durum geçişi, bakiye, CSV, telefon, çerez, hız sınırı)
npm run test:integration # Gerçek PostgreSQL entegrasyon testleri (minicrm_test veritabanı)
npm run test:e2e         # Playwright E2E testleri (360px mobil + 1280px masaüstü)
```

> Playwright Chromium tarayıcısı yüklü değilse ilk çalıştırmadan önce `npx playwright install chromium` komutunu çalıştırın.

## Demo Rolleri

Canlı demoda kayıt engeli olmadan üst çubuktan veya `/giris` sayfasından iki rol arasında geçiş yapılabilir:

| Yetki | Yönetici (`admin`) | Teknisyen (`staff`) |
| --- | --- | --- |
| Görünen işler | Tüm kayıtlar | Yalnız kendisine atanan işler |
| Durum geçişi ve not ekleme | Evet | Yalnız atanan işlerde |
| Pano tutar KPI'ları | Görünür | Gizli (sunucuda `403`) |
| Teklif oluşturma / onay / revizyon | Evet | Hayır (`403`) |
| Tahsilat ve bakiye ekranı | Evet | Gizli (`403`) |
| CSV dışa aktarım (`/api/export`) | Evet | Hayır (`403`) |
| Kayıt silme ve demo sıfırlama | Evet | Hayır (`403`) |

## Mimari Özet

- **`src/lib/domain/`:** Çerçeveden bağımsız saf iş kuralları (`money`, `status`, `balance`, `csv`, `phone`, `links`, `metadata`, `code`).
- **`src/lib/server/`:** Veritabanı şeması ve bağlantısı (`db/`), HMAC oturum çerezi ve yetki bekçileri (`auth/`), servis katmanı (`crm/`), deterministik seed (`demo/`) ve hız sınırlayıcı (`rate-limit.ts`).
- **`src/routes/`:** SvelteKit sayfaları, sunucu aksiyonları ve API uç noktaları (`/api/export`, `/api/demo-reset`).
- Ayrıntılı mimari kararlar için [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) dosyasına bakın.

## Güvenlik Notları

- **Sunucu Taraflı Rol Denetimi:** Demo rol çerezi (`AUTH_COOKIE_SECRET`) HMAC-SHA256 ile imzalanır ve `HttpOnly`, `SameSite=Lax` bayraklarıyla saklanır. Tüm rol kısıtları hem `hooks.server.ts` hem de servis/aksiyon katmanında doğrulanır.
- **`DEMO_RESET_SECRET` Koruması:** `POST /api/demo-reset` uç noktası `x-demo-reset-secret` başlığını sabit zamanlı karşılaştırma (`timingSafeEqual`) ile denetler ve hız sınırlıdır. Üretimde `DEMO_RESET_SECRET` en az 16 karakter olarak tanımlanmazsa uç nokta `503` ile devre dışı kalır.
- **Müşteri Takip İzolasyonu:** `/takip/[token]` tahmin edilemez rastgele token kullanır, hız sınırlıdır; müşteri telefonu, e-posta, vergi no, iç notlar ve taslak teklifler bu uç noktadan kesinlikle döndürülmez.
- **CSV Enjeksiyon Koruması:** `=`, `+`, `-`, `@` veya kontrol karakteriyle başlayan hücreler tek tırnak ile etkisizleştirilir.
- **KVKK ve Mali Uyarı:** Uygulama demo amaçlıdır; gerçek kişisel veri girilmemelidir. Üretilen teklif özetleri bilgilendirme amaçlıdır ve resmi e-Fatura/e-Arşiv yerine geçmez.

## Kapsam Dışı

Aşağıdaki özellikler bilerek MVP kapsamı dışında bırakılmıştır:

- Gerçek kullanıcı kaydı / parola / OAuth kimlik doğrulama
- Resmi e-Fatura / e-Arşiv ve GİB entegrasyonu
- Sanal POS / çevrim içi kart tahsilatı
- Stok ve depo yönetimi
- Otomatik SMS / WhatsApp Business API gönderimi
- Dosya / fotoğraf yükleme
- Otomatik zamanlanmış sıfırlama (cron) ve canlı ortam dağıtım adımları
