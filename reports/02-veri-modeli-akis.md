## 1. İş Akışları (3 Günlük MVP Kapsamı)

### Teknik Servis Akışı
- **Cihaz Kabul:** Müşteri seçilir/eklenir; cihaz türü, marka/model, seri no, aksesuarlar ve ön şikayet kaydedilerek tekil takip kodu üretilir.
- **Arıza Tespiti ve Parça Planı:** Teknisyen inceleme notunu girer; gereken yedek parça ve işçilik kalemlerini belirler.
- **Teklif ve Onay:** Kalemlerden teklif oluşturulur, müşteriye iletilir; onay veya ret işlenir.
- **Onarım ve Teslim:** Parça/işçilik uygulanır, test edilir; müşteriye hazır bildirimi yapılır ve teslim tarihi/notu işlenir.
- **Tahsilat:** Onaylı tutar üzerinden nakit/kart/havale tahsilatları (kısmi veya tam) kaydedilip iş kapatılır.

### Küçük Ajans Akışı
- **Lead (Talep/Fırsat):** Aday müşteri, talep kaynağı ve kısa ihtiyaç özeti (`brief`) kaydedilir.
- **Teklif ve Onay:** Kapsam, teslimat kalemleri, termin ve fiyat içeren teklif hazırlanır; müşteri onayı alınır.
- **Proje / İş Yürütme:** Onaylı teklif aktif işe dönüşür; aşama güncellemeleri ve revizyon notları zaman çizelgesine işlenir.
- **Teslim:** Çıktılar (dosya/bağlantı notu) teslim edilir ve müşteri onayı işaretlenir.
- **Fatura / Tahsilat:** Kesilen faturanın referans numarası/tarihi ile tahsilat kayıtları girilir, bakiye sıfırlanınca iş kapanır.

---

## 2. Ortak Veri Modeli (PostgreSQL)

Tek şemada her iki sektörü yönetmek için ana iş tablosunda `work_type` (`'service' | 'agency'`) ayrımı ve arayüzde sektöre göre değişen Türkçe etiketler kullanılır (3 günlük SvelteKit + PostgreSQL demo için en yalın yapı):

- **`customers` (Müşteriler ve Lead'ler)**
  - **Ana alanlar:** `id` (PK, uuid/serial), `name`, `company_name`, `phone`, `email`, `tax_no` (opsiyonel), `customer_type` (`'lead' | 'active'`), `notes`, `created_at`.
- **`work_items` (Servis Kaydı / Ajans İşi)**
  - **Ana alanlar:** `id` (PK), `customer_id` (FK), `code` (tekil takip kodu), `work_type` (`'service' | 'agency'`), `title`, `status`, `metadata` (`jsonb`: serviste cihaz/seri no/aksesuar; ajansta kanal/teslim linki), `diagnosis_or_brief` (arıza tespiti veya brief), `due_date`, `delivered_at`, `created_at`.
  - **Ortak `status` listesi:** `new` (Kabul / Lead), `scoping` (Arıza Tespiti / Keşif), `quoted` (Teklif Verildi), `approved` (Onaylandı), `in_progress` (Onarımda / Yapımda), `waiting_external` (Parça / Müşteri Bekliyor), `ready` (Teslime Hazır), `delivered` (Teslim Edildi), `cancelled` (İptal).
- **`quotes` (Teklifler — Revize Teklif Destekli)**
  - **Ana alanlar:** `id` (PK), `work_item_id` (FK), `quote_no`, `version` (int), `status`, `valid_until`, `subtotal`, `tax_rate` (varsayılan seçilebilir oran), `total_amount`, `approved_at`, `created_at`.
  - **`status` listesi:** `draft` (Taslak), `sent` (Gönderildi), `approved` (Onaylandı), `rejected` (Reddedildi), `expired` (Süresi Doldu).
- **`quote_items` (Parça, İşçilik ve Hizmet Kalemleri)**
  - **Ana alanlar:** `id` (PK), `quote_id` (FK), `item_type` (`'part' | 'labor' | 'service'`), `description`, `quantity`, `unit_price`, `line_total`.
- **`work_logs` (İşlem Geçmişi / Zaman Çizelgesi)**
  - **Ana alanlar:** `id` (PK), `work_item_id` (FK), `log_type` (`'status_change' | 'note' | 'part_event'`), `message`, `created_at`.
- **`payments` (Fatura Takibi ve Tahsilatlar)**
  - **Ana alanlar:** `id` (PK), `work_item_id` (FK), `quote_id` (FK, opsiyonel), `invoice_ref` (manuel fatura no), `amount`, `method` (`'cash' | 'card' | 'transfer'`), `status`, `paid_at`, `created_at`.
  - **`status` listesi:** `pending` (Bekliyor), `paid` (Tahsil Edildi), `refunded` (İade). *(Kısmi ödeme ve kalan bakiye: onaylı `quotes.total_amount - SUM(paid)` ile hesaplanır.)*

---

## 3. İlişkiler ve Doğrulama Notları

- **İlişkiler:**
  - `customers (1) ──< (N) work_items`
  - `work_items (1) ──< (N) quotes`
  - `quotes (1) ──< (N) quote_items`
  - `work_items (1) ──< (N) work_logs`
  - `work_items (1) ──< (N) payments` (ve isteğe bağlı `quotes (1) ──< (N) payments`)
- **Canlı Demo / Kapsam Sınırı:**
  - Ödeme tahsilat durumu (Ödenmedi / Kısmi / Ödendi) ayrı alan yerine `payments` toplamından türetilerek tutarlılık korunur.
  - Türkiye'deki güncel e-Fatura/e-Arşiv zorunluluk sınırları, sektör bazlı KDV oranları ve KVKK metin gereklilikleri **doğrulanmadı**; 3 günlük demoda resmî entegrasyon yerine manuel `invoice_ref` ve yazdırılabilir teklif/teslim özeti önerilir.
  - Gerçek kullanıcı/müşteri doğrulaması yapılmadığından bu model ilk MVP önerisidir (**doğrulanmadı**; saha görüşmesi veya kullanıcı onayı ile kesinleştirilmelidir).

