Bionluk gibi platformlarda alıcı, geliştiricinin hem teknik hakimiyetini hem de Türkiye'deki gerçek iş akışını anlayıp anlamadığına bakar. 3 günlük **SvelteKit + PostgreSQL** canlı demo kapsamı için önceliklendirilmiş maddeler:

### 1. Temel Demo Bileşenleri (Güven Veren Çekirdek)
* **Örnek Veri (Seed Data) ve Tek Tık Sıfırlama:** Boş ekran yerine teknik servis (cihaz kabul, parça bekleme, onarım) ve küçük ajans (web teklifi, revizyon, teslim) senaryolarından 12–15 gerçekçi Türkçe kayıt bulunmalı. Ziyaretçilerin veriyi bozabilmesine karşı "Demo Verisini Sıfırla" butonu (veya periyodik sıfırlama) eklenmeli.
* **Dashboard Metrikleri:** İlk bakışta iş durumunu gösteren 4 sade KPI kartı: Açık Teklif Sayısı/Tutarı, Onaylanan İş Tutarı (aylık), Aktif İşler, Geciken/Termini Yaklaşan İşler; altında son hareketler listesi (ağır grafik kütüphanesi yerine okunaklı özet).
* **Kanban Panosu:** Net aşamalar (`Yeni Talep → Teklif Verildi → Onaylandı → İşlemde → Tamamlandı`). Kartlarda müşteri adı, tutar, termin tarihi ve etiket yer almalı. Masaüstünde sürükle-bırak, dokunmatik cihazlarda kart içi "Durum Değiştir" seçimi PostgreSQL'e kalıcı yazılmalı.
* **Rol ve Yetki (Demo Rol Geçişi):** En az 2 rol: **Yönetici** (finansal özet, teklif silme/onay, CSV aktarım) ve **Personel / Teknisyen** (atanan işleri görme, durum ve servis notu ekleme; silme/toplam ciro kısıtlı). Alıcıya kayıt engeli çıkarmadan üst çubuktan tek tıkla rol değiştirme sunmak yetki mimarisini kanıtlar *(bu UX'in Bionluk dönüşüm oranına etkisi: doğrulanmadı)*.
* **Arama ve Filtre:** Müşteri adı, telefon, teklif no veya iş başlığına göre anlık arama; durum, tarih aralığı ve sorumlu kişi filtreleri. Filtrelerin URL sorgu parametrelerinde tutulması (paylaşılabilir/yenilenebilir sayfa) teknik özen gösterir.
* **CSV Dışa Aktarım:** Filtrelenmiş teklif/iş listesini indirme. Türkçe karakterlerin Microsoft Excel'de bozulmaması için **UTF-8 BOM** ve bölgesel ayarlar için `;` ayraç desteği düşünülmelidir *(farklı Excel sürümlerindeki kesin davranış sahada test edilmedi: doğrulanmadı)*.
* **Mobil Uyum:** Saha teknisyeni ve ajans yöneticisi mobilden girer. Kanban dar ekranda yatay sıkışmak yerine durum sekmelerine (tab) veya dikey kart listesine dönmeli; en az 44px dokunma alanı sağlanmalı.

### 2. Türkiye'ye Özgü Noktalar
* **TL Formatı:** Arayüzde `12.450,00 ₺` biçimi (`Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })`); PostgreSQL'de yuvarlama hatasını önlemek için `NUMERIC(12,2)` (veya kuruş `INTEGER`) veri tipi.
* **KDV Hesabı:** Teklif kalemlerinde Ara Toplam, KDV oranı seçimi (örn. %0 / %10 / %20; *güncel oranların hizmet türüne göre mevzuat uygunluğu: doğrulanmadı*), KDV Tutarı, Genel Toplam ve "KDV Hariç / Dahil" seçeneği.
* **WhatsApp ile İletişim Linki:** Müşteri ve teklif detayında telefon numarasını `+90` biçimine normalize eden `https://wa.me/90...` bağlantısı (teklif numarası ve durum bilgisini içeren URI-kodlu hazır mesaj taslağıyla).
* **KVKK Notu (6698 Sayılı Kanun):** Demo girişinde "Gerçek kişisel veri (T.C. kimlik no, gerçek telefon vb.) girmeyiniz; veriler temsilidir" uyarısı; müşteri formunda temsili Aydınlatma Metni onayı/bilgisi *(hukuki geçerlilik için hukukçu incelemesi gerekir: doğrulanmadı)*.

### 3. 3 Günlük Kapsam Sınırı
* **Dahil:** Canlı URL'de PostgreSQL bağlantılı CRUD akışı, teklif → iş dönüşümü, rol geçişi, mobil uyum ve CSV indirme.
* **Kapsam Dışı (Açıkça Belirtilmeli):** Gerçek e-Fatura/e-Arşiv entegrasyonu, SMS sağlayıcısı ve sanal POS (sahte buton koymak yerine kapsam dışı olduğunu yazmak alıcı güvenini artırır).

