import { sql } from 'drizzle-orm';
import { calculateQuoteTotals, formatKurus } from '$lib/domain/money';
import type { WorkMetadata, WorkType } from '$lib/domain/metadata';
import type { WorkStatus } from '$lib/domain/status';
import type { Database } from '$lib/server/db/client';
import {
	customers,
	payments,
	quoteItems,
	quotes,
	users,
	workItems,
	workLogs
} from '$lib/server/db/schema';

const DAY_MS = 24 * 60 * 60 * 1000;

function shiftDays(base: Date, deltaDays: number): Date {
	return new Date(base.getTime() + deltaDays * DAY_MS);
}

function withinCurrentMonth(base: Date, daysBack: number): Date {
	const monthStart = new Date(base.getFullYear(), base.getMonth(), 1, 9, 0, 0, 0);
	const candidate = shiftDays(base, -daysBack);
	return candidate.getTime() < monthStart.getTime() ? monthStart : candidate;
}

interface SeedQuoteSpec {
	version: number;
	status: 'draft' | 'sent' | 'approved' | 'rejected';
	vatIncluded: boolean;
	notes: string;
	validDaysFromNow: number;
	approvedDaysAgo?: number;
	items: Array<{
		kind: 'part' | 'labor' | 'service';
		description: string;
		qty: number;
		unitPriceKurus: number;
		vatRate: number;
	}>;
}

interface SeedWorkSpec {
	customerIndex: number;
	assigneeRole: 'admin' | 'staff' | null;
	code: string;
	publicToken: string;
	workType: WorkType;
	title: string;
	status: WorkStatus;
	priority: 'low' | 'normal' | 'high';
	metadata: WorkMetadata;
	description: string;
	createdDaysAgo: number;
	dueDeltaDays: number | null;
	deliveredDaysAgo?: number;
	quotes?: SeedQuoteSpec[];
	payments?: Array<{
		amountKurus: number;
		method: 'cash' | 'card' | 'transfer';
		invoiceRef: string;
		note: string;
		paidDaysAgo: number;
	}>;
	logs: Array<{
		actorRole: 'admin' | 'staff' | null;
		type: 'status' | 'note' | 'quote' | 'payment';
		message: string;
		isPublic: boolean;
		daysAgo: number;
	}>;
}

export interface DemoSeedStats {
	users: number;
	customers: number;
	workItems: number;
	quotes: number;
	payments: number;
	logs: number;
}

export async function resetDemoData(db: Database, now: Date = new Date()): Promise<DemoSeedStats> {
	return db.transaction(async (tx) => {
		await tx.execute(
			sql`TRUNCATE TABLE payments, work_logs, quote_items, quotes, work_items, customers, users RESTART IDENTITY CASCADE`
		);

		const insertedUsers = await tx
			.insert(users)
			.values([
				{ name: 'Demet Kaya (Yönetici)', role: 'admin', specialty: 'all' },
				{ name: 'Kerem Arslan (Teknisyen)', role: 'staff', specialty: 'service' }
			])
			.returning();

		const adminUser = insertedUsers[0];
		const staffUser = insertedUsers[1];

		const customerSpecs = [
			{
				name: 'Selim Karahan',
				company: 'Karahan Elektrik Ltd.',
				phone: '+905320101101',
				email: 'selim@karahanelektrik.test',
				taxNo: '4820193841',
				kind: 'active' as const,
				notes: 'Temsili demo müşterisi — kurumsal bakım anlaşmalı.'
			},
			{
				name: 'Berna Öztürk',
				company: 'Marmara Lojistik AŞ',
				phone: '+905330101102',
				email: 'berna@marmaralojistik.test',
				taxNo: '6130482910',
				kind: 'active' as const,
				notes: 'Ofis donanımı ve dijital kampanya talepleri.'
			},
			{
				name: 'Tolga Çınar',
				company: 'Çınar Mobilya Atölyesi',
				phone: '+905350101103',
				email: 'tolga@cinarmobilya.test',
				taxNo: '2950184726',
				kind: 'active' as const,
				notes: 'Web sitesi ve sunucu desteği alıyor.'
			},
			{
				name: 'Nazan Yıldız',
				company: 'Yıldız Tekstil',
				phone: '+905420101104',
				email: 'nazan@yildiztekstil.test',
				taxNo: '7390281645',
				kind: 'active' as const,
				notes: 'Depo barkod yazıcıları ve ürün video çekimi.'
			},
			{
				name: 'Hakan Aksoy',
				company: 'Atlas Gıda Dağıtım',
				phone: '+905440101105',
				email: 'hakan@atlasgida.test',
				taxNo: '5180374921',
				kind: 'active' as const,
				notes: 'Katalog baskı öncesi tasarım ve servis desteği.'
			},
			{
				name: 'İrem Demirtaş',
				company: 'Kuzey Mühendislik',
				phone: '+905050101106',
				email: 'irem@kuzeymuhendislik.test',
				taxNo: '8420195734',
				kind: 'active' as const,
				notes: 'Monitör ve iş istasyonu teknik servis müşterisi.'
			},
			{
				name: 'Cemil Korkmaz',
				company: 'Poyraz Kitabevi',
				phone: '+905550101107',
				email: 'cemil@poyrazkitap.test',
				taxNo: null,
				kind: 'lead' as const,
				notes: 'Yeni sezon kurumsal kimlik için ilk görüşme yapıldı.'
			},
			{
				name: 'Derya Şen',
				company: 'Deniz Aksesuar',
				phone: '+905360101108',
				email: 'derya@denizaksesuar.test',
				taxNo: null,
				kind: 'lead' as const,
				notes: 'E-ticaret açılış sayfası teklifi değerlendiriyor.'
			}
		];

		const insertedCustomers = await tx
			.insert(customers)
			.values(
				customerSpecs.map((c, idx) => ({
					...c,
					createdAt: shiftDays(now, -(25 - idx)),
					updatedAt: shiftDays(now, -(25 - idx))
				}))
			)
			.returning();

		// 14 iş: 7 teknik servis + 7 ajans, 8 durumun tamamı, 2 gecikmiş, 1 kısmi ödemeli, 1 revizyonlu teklif
		const workSpecs: SeedWorkSpec[] = [
			// --- TEKNİK SERVİS (7) ---
			{
				customerIndex: 0,
				assigneeRole: 'staff',
				code: 'TS-DM0001',
				publicToken: 'tk_srv_01_mentese_9xA2mQ',
				workType: 'service',
				title: 'Dizüstü bilgisayar menteşe ve kasa onarımı',
				status: 'new',
				priority: 'normal',
				metadata: {
					device: 'Dizüstü Bilgisayar',
					brand: 'Lenovo',
					model: 'ThinkPad E15',
					serialNo: 'DM-LNV-8821',
					accessories: 'Şarj adaptörü, taşıma çantası'
				},
				description: 'Sol ekran menteşesi gevşemiş, açılışta kasa esniyor.',
				createdDaysAgo: 1,
				dueDeltaDays: 5,
				logs: [
					{
						actorRole: 'admin',
						type: 'status',
						message: 'İş kaydı oluşturuldu (Kabul Alındı)',
						isPublic: true,
						daysAgo: 1
					},
					{
						actorRole: 'staff',
						type: 'note',
						message: 'İç not: Menteşe yatağında kırık var, yedek parça fiyatı sorulacak.',
						isPublic: false,
						daysAgo: 0
					}
				]
			},
			{
				customerIndex: 1,
				assigneeRole: 'staff',
				code: 'TS-DM0002',
				publicToken: 'tk_srv_02_ekrankrt_4bK8pR',
				workType: 'service',
				title: 'İş istasyonu ekran kartı ve soğutma bakımı',
				status: 'quoted',
				priority: 'high',
				metadata: {
					device: 'İş İstasyonu',
					brand: 'Dell',
					model: 'Precision 3660',
					serialNo: 'DM-DLL-4410',
					accessories: 'Güç kablosu',
					diagnosis: 'Termal macun kurumuş, fan rulmanı ses yapıyor'
				},
				description: 'Yük altında görüntü kesilmesi; revize teklif gönderildi.',
				createdDaysAgo: 5,
				dueDeltaDays: 4,
				quotes: [
					{
						version: 1,
						status: 'rejected',
						vatIncluded: false,
						notes: 'İlk sürüm — komple ekran kartı değişim önerisi',
						validDaysFromNow: 7,
						items: [
							{
								kind: 'part',
								description: 'Profesyonel GPU Kartı (Muadil)',
								qty: 1,
								unitPriceKurus: 14500_00,
								vatRate: 20
							},
							{
								kind: 'labor',
								description: 'Montaj ve Stres Testi',
								qty: 2,
								unitPriceKurus: 600_00,
								vatRate: 20
							}
						]
					},
					{
						version: 2,
						status: 'sent',
						vatIncluded: false,
						notes: 'Revize teklif — fan modülü ve termal bakım ile ekonomik çözüm',
						validDaysFromNow: 10,
						items: [
							{
								kind: 'part',
								description: 'GPU Soğutma Fan Modülü',
								qty: 1,
								unitPriceKurus: 2800_00,
								vatRate: 20
							},
							{
								kind: 'labor',
								description: 'Termal Bakım ve 4 Saat Stres Testi',
								qty: 2,
								unitPriceKurus: 650_00,
								vatRate: 20
							}
						]
					}
				],
				logs: [
					{
						actorRole: 'admin',
						type: 'status',
						message: 'İş kaydı oluşturuldu (Kabul Alındı)',
						isPublic: true,
						daysAgo: 5
					},
					{
						actorRole: 'admin',
						type: 'quote',
						message: 'Teklif revize edildi: TKL-TS-DM0002-V1 → TKL-TS-DM0002-V2',
						isPublic: false,
						daysAgo: 2
					},
					{
						actorRole: 'admin',
						type: 'quote',
						message: 'Revize teklif (V2) müşteri onayına gönderildi.',
						isPublic: true,
						daysAgo: 2
					}
				]
			},
			{
				customerIndex: 2,
				assigneeRole: 'staff',
				code: 'TS-DM0003',
				publicToken: 'tk_srv_03_guckayn_7cM3nT',
				workType: 'service',
				title: 'Ofis sunucusu güç kaynağı değişimi',
				status: 'approved',
				priority: 'normal',
				metadata: {
					device: 'Rack Sunucu',
					brand: 'HPE',
					model: 'ProLiant DL360',
					serialNo: 'DM-HPE-9032'
				},
				description: 'Yedek güç kaynağı arıza ışığı yakıyor, onay alındı.',
				createdDaysAgo: 4,
				dueDeltaDays: 6,
				quotes: [
					{
						version: 1,
						status: 'approved',
						vatIncluded: false,
						notes: 'Orijinal 800W güç kaynağı modülü dahildir.',
						validDaysFromNow: 14,
						approvedDaysAgo: 2,
						items: [
							{
								kind: 'part',
								description: '800W Hot-Plug Güç Kaynağı',
								qty: 1,
								unitPriceKurus: 5200_00,
								vatRate: 20
							},
							{
								kind: 'labor',
								description: 'Yerinde Kurulum ve Yük Testi',
								qty: 1,
								unitPriceKurus: 1300_00,
								vatRate: 20
							}
						]
					}
				],
				logs: [
					{
						actorRole: 'admin',
						type: 'status',
						message: 'Teklif onaylandı, kurulum planlandı.',
						isPublic: true,
						daysAgo: 2
					}
				]
			},
			{
				// GECİKMİŞ #1 + KISMİ ÖDEMELİ
				customerIndex: 3,
				assigneeRole: 'staff',
				code: 'TS-DM0004',
				publicToken: 'tk_srv_04_barkod_2dN9qW',
				workType: 'service',
				title: 'Endüstriyel barkod yazıcı termal kafa değişimi',
				status: 'in_progress',
				priority: 'high',
				metadata: {
					device: 'Barkod Yazıcı',
					brand: 'Zebra',
					model: 'ZT411',
					serialNo: 'DM-ZBR-1154',
					diagnosis: 'Termal kafada 4 ölü çizgi mevcut'
				},
				description: 'Depo sevkiyat hattında kullanılan yazıcı; kafa değişimi sürüyor.',
				createdDaysAgo: 9,
				dueDeltaDays: -3,
				quotes: [
					{
						version: 1,
						status: 'approved',
						vatIncluded: false,
						notes: '%50 avans ile parça tedariki başlatılır.',
						validDaysFromNow: 7,
						approvedDaysAgo: 5,
						items: [
							{
								kind: 'part',
								description: '203 DPI Termal Yazıcı Kafası',
								qty: 1,
								unitPriceKurus: 6000_00,
								vatRate: 20
							},
							{
								kind: 'labor',
								description: 'Değişim, Kalibrasyon ve Temizlik',
								qty: 1,
								unitPriceKurus: 1500_00,
								vatRate: 20
							}
						]
					}
				],
				payments: [
					{
						amountKurus: 4500_00,
						method: 'transfer',
						invoiceRef: 'AVN-2026-014',
						note: 'Parça siparişi ön ödemesi',
						paidDaysAgo: 4
					}
				],
				logs: [
					{
						actorRole: 'admin',
						type: 'quote',
						message: 'Teklif onaylandı, ön ödeme alındı.',
						isPublic: true,
						daysAgo: 5
					},
					{
						actorRole: 'staff',
						type: 'status',
						message: 'Durum değişti: Onaylandı → Onarımda (Termal kafa montajı başladı)',
						isPublic: true,
						daysAgo: 2
					},
					{
						actorRole: 'staff',
						type: 'note',
						message: 'İç not: Merdane sensörü de temizlendi, ekstra ücret yazılmayacak.',
						isPublic: false,
						daysAgo: 1
					}
				]
			},
			{
				customerIndex: 4,
				assigneeRole: 'staff',
				code: 'TS-DM0005',
				publicToken: 'tk_srv_05_anakart_5eP4rX',
				workType: 'service',
				title: 'Ultrabook sıvı teması sonrası anakart onarımı',
				status: 'waiting',
				priority: 'high',
				metadata: {
					device: 'Ultrabook',
					brand: 'HP',
					model: 'EliteBook 840 G9',
					serialNo: 'DM-HP-7740'
				},
				description: 'Güç entegresi arızalı; tedarikçiden entegre bekleniyor.',
				createdDaysAgo: 7,
				dueDeltaDays: 2,
				quotes: [
					{
						version: 1,
						status: 'approved',
						vatIncluded: false,
						notes: 'Ultrasonik temizlik ve güç devresi onarımı',
						validDaysFromNow: 10,
						approvedDaysAgo: 4,
						items: [
							{
								kind: 'part',
								description: 'Güç Yönetimi Entegresi ve SMD Bileşenler',
								qty: 1,
								unitPriceKurus: 1800_00,
								vatRate: 20
							},
							{
								kind: 'labor',
								description: 'Anakart Mikro Lehim Onarımı',
								qty: 2,
								unitPriceKurus: 1100_00,
								vatRate: 20
							}
						]
					}
				],
				logs: [
					{
						actorRole: 'staff',
						type: 'status',
						message: 'Durum değişti: Onarımda → Parça / Onay Bekliyor (Güç entegresi kargoda)',
						isPublic: true,
						daysAgo: 2
					}
				]
			},
			{
				customerIndex: 5,
				assigneeRole: 'staff',
				code: 'TS-DM0006',
				publicToken: 'tk_srv_06_monitor_8fQ5sY',
				workType: 'service',
				title: '27 inç tasarım monitörü besleme kartı tamiri',
				status: 'ready',
				priority: 'normal',
				metadata: {
					device: 'Monitör',
					brand: 'ASUS',
					model: 'ProArt PA278QV',
					serialNo: 'DM-ASU-3319'
				},
				description: 'Besleme kartı kondansatörleri yenilendi, testten geçti.',
				createdDaysAgo: 8,
				dueDeltaDays: 1,
				quotes: [
					{
						version: 1,
						status: 'approved',
						vatIncluded: true,
						notes: 'KDV dahil paket onarım bedeli',
						validDaysFromNow: 7,
						approvedDaysAgo: 5,
						items: [
							{
								kind: 'part',
								description: 'Besleme Kartı Yedek Seti',
								qty: 1,
								unitPriceKurus: 1200_00,
								vatRate: 20
							},
							{
								kind: 'labor',
								description: 'Onarım ve Renk/Parlaklık Testi',
								qty: 1,
								unitPriceKurus: 1200_00,
								vatRate: 20
							}
						]
					}
				],
				logs: [
					{
						actorRole: 'staff',
						type: 'status',
						message: 'Durum değişti: Onarımda → Teslime Hazır (48 saat açık test tamamlandı)',
						isPublic: true,
						daysAgo: 1
					}
				]
			},
			{
				customerIndex: 0,
				assigneeRole: 'staff',
				code: 'TS-DM0007',
				publicToken: 'tk_srv_07_yazici_3gR6tZ',
				workType: 'service',
				title: 'Ofis lazer yazıcı fırın ünitesi değişimi',
				status: 'delivered',
				priority: 'low',
				metadata: {
					device: 'Lazer Yazıcı',
					brand: 'Brother',
					model: 'HL-L5100DN',
					serialNo: 'DM-BRT-6201'
				},
				description: 'Kağıt sıkışması giderildi, cihaz müşteriye teslim edildi.',
				createdDaysAgo: 12,
				dueDeltaDays: -5,
				deliveredDaysAgo: 2,
				quotes: [
					{
						version: 1,
						status: 'approved',
						vatIncluded: false,
						notes: '6 ay parça garantisi dahildir.',
						validDaysFromNow: 15,
						approvedDaysAgo: 6,
						items: [
							{
								kind: 'part',
								description: 'Fırın Ünitesi (Fuser Kit)',
								qty: 1,
								unitPriceKurus: 2500_00,
								vatRate: 20
							},
							{
								kind: 'labor',
								description: 'Bakım ve Kalibrasyon',
								qty: 1,
								unitPriceKurus: 500_00,
								vatRate: 20
							}
						]
					}
				],
				payments: [
					{
						amountKurus: 3600_00,
						method: 'card',
						invoiceRef: 'FTR-2026-102',
						note: 'Teslimatta kredi kartı ile kapatıldı',
						paidDaysAgo: 2
					}
				],
				logs: [
					{
						actorRole: 'staff',
						type: 'status',
						message: 'Durum değişti: Teslime Hazır → Teslim Edildi',
						isPublic: true,
						daysAgo: 2
					}
				]
			},

			// --- AJANS / HİZMET (7) ---
			{
				customerIndex: 6,
				assigneeRole: null,
				code: 'AJ-DM0001',
				publicToken: 'tk_agy_01_kimlik_6hS7uA',
				workType: 'agency',
				title: 'Yeni sezon kurumsal kimlik ve logo yenileme',
				status: 'new',
				priority: 'normal',
				metadata: {
					channel: 'Marka & Baskı',
					brief: 'Logo modernizasyonu, kartvizit ve kitap ayracı seti'
				},
				description: 'İlk keşif toplantısı planlanıyor, kapsam netleştirilecek.',
				createdDaysAgo: 1,
				dueDeltaDays: 10,
				logs: [
					{
						actorRole: 'admin',
						type: 'status',
						message: 'İş kaydı oluşturuldu (Talep / Lead)',
						isPublic: true,
						daysAgo: 1
					}
				]
			},
			{
				customerIndex: 7,
				assigneeRole: 'admin',
				code: 'AJ-DM0002',
				publicToken: 'tk_agy_02_landing_1jT8vB',
				workType: 'agency',
				title: 'E-ticaret sezon kampanyası açılış sayfası',
				status: 'quoted',
				priority: 'high',
				metadata: {
					channel: 'Web / E-ticaret',
					brief: 'Mobil öncelikli kampanya sayfası + dönüşüm ölçüm kurulumu'
				},
				description: 'Müşteri takip sayfasından doğrudan onaylayabilir.',
				createdDaysAgo: 3,
				dueDeltaDays: 7,
				quotes: [
					{
						version: 1,
						status: 'sent',
						vatIncluded: false,
						notes: '2 revizyon turu ve mobil uyumlu kodlama dahildir.',
						validDaysFromNow: 12,
						items: [
							{
								kind: 'service',
								description: 'UI/UX Tasarım (Masaüstü + Mobil)',
								qty: 1,
								unitPriceKurus: 6500_00,
								vatRate: 20
							},
							{
								kind: 'service',
								description: 'Önyüz Geliştirme ve Hız Optimizasyonu',
								qty: 1,
								unitPriceKurus: 5500_00,
								vatRate: 20
							}
						]
					}
				],
				logs: [
					{
						actorRole: 'admin',
						type: 'quote',
						message: 'Teklif gönderildi: TKL-AJ-DM0002-V1 (14.400,00 TL)',
						isPublic: true,
						daysAgo: 2
					},
					{
						actorRole: 'admin',
						type: 'note',
						message: 'İç not: Müşteri hafta sonuna kadar karar vereceğini iletti.',
						isPublic: false,
						daysAgo: 1
					}
				]
			},
			{
				customerIndex: 1,
				assigneeRole: 'admin',
				code: 'AJ-DM0003',
				publicToken: 'tk_agy_03_sosyal_9kU9wC',
				workType: 'agency',
				title: 'Aylık sosyal medya içerik ve tasarım paketi',
				status: 'approved',
				priority: 'normal',
				metadata: {
					channel: 'Instagram & LinkedIn',
					brief: '12 gönderi, 4 kısa video kurgu ve aylık raporlama'
				},
				description: 'İçerik takvimi onaylandı, prodüksiyon başlıyor.',
				createdDaysAgo: 4,
				dueDeltaDays: 8,
				quotes: [
					{
						version: 1,
						status: 'approved',
						vatIncluded: false,
						notes: 'Aylık dönemlik hizmet paketidir.',
						validDaysFromNow: 14,
						approvedDaysAgo: 3,
						items: [
							{
								kind: 'service',
								description: 'Sosyal Medya Tasarım ve İçerik Yönetimi',
								qty: 1,
								unitPriceKurus: 9000_00,
								vatRate: 20
							}
						]
					}
				],
				logs: [
					{
						actorRole: 'admin',
						type: 'status',
						message: 'Teklif onaylandı, aylık içerik takvimi hazırlanıyor.',
						isPublic: true,
						daysAgo: 3
					}
				]
			},
			{
				// GECİKMİŞ #2
				customerIndex: 2,
				assigneeRole: 'admin',
				code: 'AJ-DM0004',
				publicToken: 'tk_agy_04_webseo_4mV2xD',
				workType: 'agency',
				title: 'Kurumsal web sitesi hız ve teknik SEO iyileştirmesi',
				status: 'in_progress',
				priority: 'high',
				metadata: {
					channel: 'Web & SEO',
					deliverableUrl: 'https://ornek-onizleme.test/cinar-mobilya',
					brief: 'Core Web Vitals iyileştirme, görsel sıkıştırma, meta şema'
				},
				description: 'Görsel optimizasyonu tamamlandı, şema işaretlemeleri test ediliyor.',
				createdDaysAgo: 10,
				dueDeltaDays: -2,
				quotes: [
					{
						version: 1,
						status: 'approved',
						vatIncluded: false,
						notes: 'Öncesi/sonrası performans raporu teslim edilir.',
						validDaysFromNow: 10,
						approvedDaysAgo: 5,
						items: [
							{
								kind: 'service',
								description: 'Teknik SEO Denetimi ve Uygulama',
								qty: 1,
								unitPriceKurus: 7500_00,
								vatRate: 20
							}
						]
					}
				],
				logs: [
					{
						actorRole: 'admin',
						type: 'status',
						message: 'Durum değişti: Onaylandı → Üretimde',
						isPublic: true,
						daysAgo: 4
					}
				]
			},
			{
				customerIndex: 3,
				assigneeRole: 'admin',
				code: 'AJ-DM0005',
				publicToken: 'tk_agy_05_video_7nW3yE',
				workType: 'agency',
				title: 'Koleksiyon tanıtım videosu kurgu ve renk düzenleme',
				status: 'waiting',
				priority: 'normal',
				metadata: {
					channel: 'YouTube & Reels',
					deliverableUrl: 'https://ornek-onizleme.test/yildiz-video-v1',
					brief: '60 sn ana kurgu + 3 adet 15 sn dikey kesit'
				},
				description: 'İlk kurgu paylaşıldı, müşteriden alt yazı onayı bekleniyor.',
				createdDaysAgo: 6,
				dueDeltaDays: 3,
				quotes: [
					{
						version: 1,
						status: 'approved',
						vatIncluded: false,
						notes: 'Müzik lisansı dahildir.',
						validDaysFromNow: 14,
						approvedDaysAgo: 4,
						items: [
							{
								kind: 'service',
								description: 'Video Kurgu ve Renk Düzenleme',
								qty: 1,
								unitPriceKurus: 8000_00,
								vatRate: 20
							}
						]
					}
				],
				logs: [
					{
						actorRole: 'admin',
						type: 'status',
						message: 'Durum değişti: Üretimde → Müşteri Geri Bildirimi (İlk kurgu paylaşıldı)',
						isPublic: true,
						daysAgo: 1
					}
				]
			},
			{
				customerIndex: 4,
				assigneeRole: 'admin',
				code: 'AJ-DM0006',
				publicToken: 'tk_agy_06_katalog_2pX4zF',
				workType: 'agency',
				title: '2026 ürün kataloğu ve dijital broşür tasarımı',
				status: 'ready',
				priority: 'normal',
				metadata: {
					channel: 'Dijital & Baskı',
					deliverableUrl: 'https://ornek-onizleme.test/atlas-katalog',
					brief: '24 sayfa baskıya hazır PDF + web versiyonu'
				},
				description: 'Baskı dosyaları onaylandı, teslim linki hazır.',
				createdDaysAgo: 9,
				dueDeltaDays: 2,
				quotes: [
					{
						version: 1,
						status: 'approved',
						vatIncluded: true,
						notes: 'KDV dahil tasarım bedeli',
						validDaysFromNow: 10,
						approvedDaysAgo: 6,
						items: [
							{
								kind: 'service',
								description: '24 Sayfa Katalog Tasarımı',
								qty: 1,
								unitPriceKurus: 10800_00,
								vatRate: 20
							}
						]
					}
				],
				payments: [
					{
						amountKurus: 10800_00,
						method: 'transfer',
						invoiceRef: 'FTR-2026-109',
						note: 'Tamamı havale ile tahsil edildi',
						paidDaysAgo: 1
					}
				],
				logs: [
					{
						actorRole: 'admin',
						type: 'status',
						message: 'Durum değişti: Üretimde → Teslime Hazır (Final baskı dosyaları yüklendi)',
						isPublic: true,
						daysAgo: 1
					}
				]
			},
			{
				customerIndex: 5,
				assigneeRole: null,
				code: 'AJ-DM0007',
				publicToken: 'tk_agy_07_banner_5qY5aG',
				workType: 'agency',
				title: 'Fuar dönemi dijital banner seti',
				status: 'cancelled',
				priority: 'low',
				metadata: {
					channel: 'Google Display',
					brief: 'Fuar ertelendiği için proje iptal edildi'
				},
				description: 'Müşteri talebiyle ileri tarihe ertelendi ve iptal edildi.',
				createdDaysAgo: 14,
				dueDeltaDays: -4,
				quotes: [
					{
						version: 1,
						status: 'rejected',
						vatIncluded: false,
						notes: 'Fuar ertelendi',
						validDaysFromNow: 5,
						items: [
							{
								kind: 'service',
								description: '8 Boyut Banner Tasarım Seti',
								qty: 1,
								unitPriceKurus: 3200_00,
								vatRate: 20
							}
						]
					}
				],
				logs: [
					{
						actorRole: 'admin',
						type: 'status',
						message: 'Durum değişti: Teklif Gönderildi → İptal (Fuar ertelendi)',
						isPublic: true,
						daysAgo: 7
					}
				]
			}
		];

		let quoteCount = 0;
		let paymentCount = 0;
		let logCount = 0;

		for (const spec of workSpecs) {
			const customer = insertedCustomers[spec.customerIndex];
			const assignedTo =
				spec.assigneeRole === 'admin'
					? adminUser.id
					: spec.assigneeRole === 'staff'
						? staffUser.id
						: null;

			const createdAt = shiftDays(now, -spec.createdDaysAgo);
			const [createdWork] = await tx
				.insert(workItems)
				.values({
					customerId: customer.id,
					assignedTo,
					code: spec.code,
					publicToken: spec.publicToken,
					workType: spec.workType,
					title: spec.title,
					status: spec.status,
					priority: spec.priority,
					metadata: spec.metadata,
					description: spec.description,
					dueDate: spec.dueDeltaDays !== null ? shiftDays(now, spec.dueDeltaDays) : null,
					deliveredAt:
						spec.deliveredDaysAgo !== undefined ? shiftDays(now, -spec.deliveredDaysAgo) : null,
					createdAt,
					updatedAt: createdAt
				})
				.returning();

			if (spec.quotes) {
				for (const qSpec of spec.quotes) {
					const calc = calculateQuoteTotals(qSpec.items, qSpec.vatIncluded);
					const quoteNo = `TKL-${spec.code}-V${qSpec.version}`;
					const approvedAt =
						qSpec.status === 'approved'
							? withinCurrentMonth(now, qSpec.approvedDaysAgo ?? 1)
							: null;

					const [createdQuote] = await tx
						.insert(quotes)
						.values({
							workItemId: createdWork.id,
							quoteNo,
							version: qSpec.version,
							status: qSpec.status,
							vatIncluded: qSpec.vatIncluded,
							subtotalKurus: calc.subtotalKurus,
							vatTotalKurus: calc.vatTotalKurus,
							totalKurus: calc.totalKurus,
							notes: qSpec.notes,
							validUntil: shiftDays(now, qSpec.validDaysFromNow),
							approvedAt,
							createdAt,
							updatedAt: approvedAt ?? createdAt
						})
						.returning();
					quoteCount += 1;

					await tx.insert(quoteItems).values(
						qSpec.items.map((line, idx) => ({
							quoteId: createdQuote.id,
							kind: line.kind,
							description: line.description,
							qty: line.qty.toFixed(2),
							unitPriceKurus: line.unitPriceKurus,
							vatRate: line.vatRate,
							lineSubtotalKurus: calc.lines[idx].lineSubtotalKurus,
							lineVatKurus: calc.lines[idx].lineVatKurus,
							lineTotalKurus: calc.lines[idx].lineTotalKurus,
							sortOrder: idx
						}))
					);
				}
			}

			if (spec.payments) {
				for (const pSpec of spec.payments) {
					const paidAt = shiftDays(now, -pSpec.paidDaysAgo);
					await tx.insert(payments).values({
						workItemId: createdWork.id,
						amountKurus: pSpec.amountKurus,
						method: pSpec.method,
						invoiceRef: pSpec.invoiceRef,
						note: pSpec.note,
						paidAt,
						createdAt: paidAt
					});
					paymentCount += 1;

					await tx.insert(workLogs).values({
						workItemId: createdWork.id,
						actorId: adminUser.id,
						type: 'payment',
						message: `Tahsilat kaydedildi: ${formatKurus(pSpec.amountKurus)} · Belge: ${pSpec.invoiceRef}`,
						isPublic: false,
						createdAt: paidAt
					});
					logCount += 1;
				}
			}

			for (const lSpec of spec.logs) {
				const actorId =
					lSpec.actorRole === 'admin'
						? adminUser.id
						: lSpec.actorRole === 'staff'
							? staffUser.id
							: null;
				await tx.insert(workLogs).values({
					workItemId: createdWork.id,
					actorId,
					type: lSpec.type,
					message: lSpec.message,
					isPublic: lSpec.isPublic,
					createdAt: shiftDays(now, -lSpec.daysAgo)
				});
				logCount += 1;
			}
		}

		return {
			users: insertedUsers.length,
			customers: insertedCustomers.length,
			workItems: workSpecs.length,
			quotes: quoteCount,
			payments: paymentCount,
			logs: logCount
		};
	});
}
