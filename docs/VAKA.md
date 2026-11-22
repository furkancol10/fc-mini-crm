# Vaka Çalışması: Teknik Servis ve Küçük Ajanslar İçin Mini CRM

## Sorun

Teknik servislerde ve küçük dijital ajanslarda müşteri takibi çoğu zaman dağınık araçlarla yürür: cihaz kabul bilgileri defterde veya sohbet mesajlarında kalır, KDV'li teklifler ayrı tablolarda hazırlanır, revizyonlarda hangi sürümün onaylandığı karışır ve tahsilatlar iş kayıtlarından kopuk izlenir. Müşteriler işin durumunu öğrenmek için sürekli telefon ya da WhatsApp üzerinden ulaşmak zorunda kalır; ekip içindeki teknisyenlere ise tüm finansal verileri açmadan yalnızca kendi işlerini gösterecek sade bir rol ayrımı kurmak zorlaşır. Büyük kurumsal CRM yazılımları ise hem kurulum hem kullanım açısından küçük ekiplerin günlük akışına ağır gelir.

## Çözüm

Bu ihtiyaçlara odaklanan, Türkçe arayüzlü ve doğrudan tarayıcıdan çalışan bir **Mini CRM — Teklif ve İş Takip Paneli** geliştirildi. Mimari, veri tekrarını önlemek için talepten teslime kadar tek bir kök iş kaydı (`work_items`) üzerine kuruldu; teknik servis ve ajans alanları aynı panelde sektör türüne göre doğrulanan özel alanlarla desteklendi.

Kuruş tabanlı tam sayı para hesabı ile KDV hariç/dahil kalemli teklif oluşturma, revizyon sürümleme ve tarayıcıdan yazdırma/PDF alma akışları eklendi. Veritabanı düzeyindeki kısmi tekil indeks sayesinde aynı iş için birden fazla teklifin eşzamanlı onaylanması engellendi; durum geçişleri satır kilidi ve izinli geçiş tablosuyla güvenceye alındı. Müşteriler için giriş gerektirmeyen, kişisel veri sızdırmayan `/takip/[token]` ekranı oluşturuldu; böylece müşteri teklifi doğrudan onaylayıp reddedebiliyor ve paylaşıma açık işlem geçmişini izleyebiliyor. Yönetici rolü kısmi/tam tahsilat kaydedip kalan bakiyeyi anlık takip edebilirken, Teknisyen rolü yalnızca kendine atanan işlere erişiyor; tutar özetleri ve CSV dışa aktarımı sunucu tarafında kapatılıyor.

## Sonuç

Ortaya çıkan uygulama; SvelteKit, Drizzle ORM ve PostgreSQL üzerinde çalışan, 360px mobil ve masaüstü ekranlara uyumlu, deterministik örnek veriyle anında denenebilen bir çekirdek iş takip ürünüdür. İş kuralları birim testleriyle, veritabanı kısıtları ve yetki sınırları gerçek PostgreSQL entegrasyon testleriyle, baştan sona müşteri–iş–teklif–onay–tahsilat–teslim akışı ise iki farklı ekran boyutunda Playwright uçtan uca testleriyle doğrulanmıştır. Benzer bir süreç yönetimi ihtiyacı olan servis veya ajanslar için mevcut mimari; gerçek kimlik doğrulama, e-Fatura veya bildirim entegrasyonlarına genişletilmeye uygun temiz bir temel sunar.
