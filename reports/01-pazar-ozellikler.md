### 1. Mevcut Ürünlerin Tipik Özellik Seti
* **Global KOBİ CRM’leri:**
  * **HubSpot CRM (Free):** Kişi/firma yönetimi (1 milyona kadar kayıt), görsel satış hunisi (pipeline), görev takibi, temel e-posta/form takibi ve özet pano; otomasyon ve özel raporlar ücretli planlarda.
  * **Pipedrive (Ücretsiz plan yok, 14 gün deneme):** Sürükle-bırak satış hunisi, aktivite (arama/toplantı/e-posta) odaklı satış takibi, gelir tahmini.
  * **Zoho CRM (Free - 3 kullanıcı / 5.000 kayıt):** Lead, firma, kişi, fırsat, görev ve standart raporlar; ücretsiz planda iş akışı otomasyonu yok.
  * **Bitrix24 (Free - sınırsız kullanıcı, 5 GB alan):** Satış hunisi, temel teklif (quotations), görev/proje yönetimi ve ekip içi sohbet; kapsamı geniş olduğu için öğrenme eğrisi dik.
* **Türkiye Yerli Teknik Servis ve Ajans Yazılımları:**
  * **Teknik Servis (örn. FieldCo, EvoBulut, ServisSoft):** Servis kabul/iş emri, barkod/QR fiş, cihaz aksesuar/hasar kaydı, seri no/IMEI geçmişi, yedek parça stok düşüşü, online müşteri sorgu sayfası, SMS/WhatsApp bildirimi, dijital onay, periyodik bakım ve e-fatura entegrasyonu.
  * **Küçük Ajans (örn. Planports, Cubicl, Ajando):** Lead toplama, teklif hazırlama, onaylanan teklifi tek tıkla projeye/göreve çevirme, ekip görev takibi ve temel tahsilat.

---

### 2. Teknik Servis ve Küçük Ajans İçin En Çok İşe Yarayan Özellikler
* **Teklif → İş Dönüşümü:** Serviste "arıza fiyat onayı", ajansta "proje teklifi" onaylandığı an veri tekrarı olmadan iş emrine/projeye dönüşmesi.
* **Tek Ekranda Müşteri + İş Geçmişi:** Müşterinin önceki cihaz onarımlarını (seri no, aksesuar notu) veya önceki ajans işlerini/brieflerini anında görmek.
* **Sade Aşama Takibi (Kanban/Liste):** *Talep → Teklif/Teşhis → Onay Bekliyor → İşlemde → Teslim/Tahsilat* akışında bekleyen işleri görmek.
* **Müşteriye Self-Servis Durum Linki:** "Cihazım/işim ne durumda?" aramalarını azaltan, giriş gerektirmeyen salt-okunur takip ekranı.
* **Hızlı İletişim Kısayolu:** Müşteriye tek tıkla hazır metinli WhatsApp (`wa.me`) veya e-posta gönderimi başlatmak.

---

### 3. 3 Günlük Mini CRM (SvelteKit + PostgreSQL) Kapsam Ayrımı

#### Çekirdek Özellikler (MVP — Olmalı)
* **Müşteri Rehberi:** Firma/kişi kartı, iletişim bilgileri, geçmiş teklif ve iş listesi.
* **Teklif Modülü:** Kalem bazlı teklif (birim fiyat, KDV, toplam), yazdırılabilir/PDF görünüm, durum (*Taslak, Gönderildi, Onaylandı, Reddedildi*) ve tek tıkla **"İşe Dönüştür"**.
* **İş / Servis Takip Panosu:** Kanban + filtrelenebilir tablo; iş türü/etiketi, cihaz veya proje özeti, sorumlu kişi, teslim tarihi, öncelik.
* **İş Detayı & Ödeme İşareti:** Durum geçmişi, iç notlar ve basit tahsilat durumu (*Ödenmedi / Kısmi / Ödendi*).
* **Müşteri Takip Sayfası (`/takip/[kod]`):** Kayıt koduyla müşterinin kendi iş aşamasını ve teklif özetini görebildiği salt-okunur sayfa.
* **Özet Pano:** Açık iş sayısı, onay bekleyen teklif tutarı, geciken işler, dönemlik tahsilat toplamı.

#### Gereksiz Kalabalık (3 Günde Kapsam Dışı)
* GİB E-Fatura / E-Arşiv entegrasyonu, tam cari-muhasebe ve depo/kritik stok modülü.
* Ücretli SMS / WhatsApp Business API ve çift yönlü e-posta (IMAP) istemcisi (yerine `wa.me` / `mailto:` yeterli).
* Otomasyon kural motoru, lead scoring, ayrıntılı çoklu rol/izin matrisi.
* Saha GPS/rota planlama, barkod donanım entegrasyonu, Gantt şeması, saatlik time-tracker.
* Sosyal medya/reklam (Meta/Google Ads) otomatik lead çekme entegrasyonları.

---

### 4. Doğrulama Notu
* Ürün özellikleri, adı geçen yazılımların web aramalarında yer alan ürün açıklamalarına dayanmaktadır.
* Türkiye'deki mikro teknik servis ve ajansların fiili kullanım oranları ile hangi özelliğin ücretli dönüşümü en çok etkilediği bu taramada **doğrulanmadı**.

