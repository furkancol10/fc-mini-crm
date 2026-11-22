<script lang="ts">
	import { page } from '$app/state';
	import { getPaymentStatusLabel } from '$lib/domain/balance';
	import { buildMailtoUrl, buildTrackingShareMessage } from '$lib/domain/links';
	import { COMMON_VAT_RATES, formatKurus } from '$lib/domain/money';
	import { buildWhatsAppUrl } from '$lib/domain/phone';
	import { getAllowedNextStatuses, getStatusLabel } from '$lib/domain/status';

	let { data, form } = $props();
	let copiedTracking = $state(false);

	interface DraftLine {
		id: number;
		kind: 'part' | 'labor' | 'service';
		description: string;
		qty: string;
		unitPriceTl: string;
		vatRate: number;
	}

	let nextRowId = 2;
	let newQuoteLines = $state<DraftLine[]>([
		{ id: 1, kind: 'service', description: '', qty: '1', unitPriceTl: '', vatRate: 20 }
	]);
	let editingQuoteId = $state<number | null>(null);
	let editQuoteLines = $state<DraftLine[]>([]);
	let editVatIncluded = $state(false);
	let editNotes = $state('');

	function addNewQuoteLine() {
		newQuoteLines = [
			...newQuoteLines,
			{ id: nextRowId++, kind: 'service', description: '', qty: '1', unitPriceTl: '', vatRate: 20 }
		];
	}

	function removeNewQuoteLine(rowId: number) {
		if (newQuoteLines.length <= 1) return;
		newQuoteLines = newQuoteLines.filter((l) => l.id !== rowId);
	}

	function startEditDraft(quote: (typeof data.quotes)[number]) {
		editingQuoteId = quote.id;
		editVatIncluded = quote.vatIncluded;
		editNotes = quote.notes ?? '';
		editQuoteLines = quote.items.map((item) => ({
			id: nextRowId++,
			kind: item.kind,
			description: item.description,
			qty: String(Number(item.qty)),
			unitPriceTl: (item.unitPriceKurus / 100).toFixed(2).replace('.', ','),
			vatRate: item.vatRate
		}));
	}

	function addEditLine() {
		editQuoteLines = [
			...editQuoteLines,
			{ id: nextRowId++, kind: 'service', description: '', qty: '1', unitPriceTl: '', vatRate: 20 }
		];
	}

	function removeEditLine(rowId: number) {
		if (editQuoteLines.length <= 1) return;
		editQuoteLines = editQuoteLines.filter((l) => l.id !== rowId);
	}

	const quoteStatusLabels: Record<string, string> = {
		draft: 'Taslak',
		sent: 'Gönderildi',
		approved: 'Onaylandı',
		rejected: 'Reddedildi',
		expired: 'Süresi Doldu'
	};

	const kindLabels: Record<string, string> = {
		part: 'Parça',
		labor: 'İşçilik',
		service: 'Hizmet'
	};

	const methodLabels: Record<string, string> = {
		cash: 'Nakit',
		card: 'Kart',
		transfer: 'Havale / EFT'
	};

	const allowedNext = $derived(getAllowedNextStatuses(data.item.status));
	const metadataEntries = $derived(
		Object.entries(data.item.metadata ?? {}).filter(([, v]) => v !== undefined && v !== '')
	);
	const trackingPath = $derived(`/takip/${data.item.publicToken}`);
	const trackingFullUrl = $derived(`${page.url.origin}${trackingPath}`);
	const shareMessage = $derived(
		buildTrackingShareMessage({
			code: data.item.code,
			title: data.item.title,
			statusLabel: getStatusLabel(data.item.status, data.item.workType),
			trackingUrl: trackingFullUrl
		})
	);
	const waShareUrl = $derived(buildWhatsAppUrl(data.customer.phone, shareMessage));
	const mailtoShareUrl = $derived(
		buildMailtoUrl(
			data.customer.email,
			`${data.item.code} — İş Takip ve Teklif Bilgilendirmesi`,
			shareMessage
		)
	);

	async function copyTrackingUrl() {
		try {
			await navigator.clipboard.writeText(trackingFullUrl);
			copiedTracking = true;
			setTimeout(() => (copiedTracking = false), 2000);
		} catch {
			copiedTracking = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<a href="/isler" class="text-xs text-slate-500 hover:underline">← İşlere Dön</a>
			<h1 class="mt-1 text-2xl font-semibold text-slate-900">
				{data.item.code} — {data.item.title}
			</h1>
			<p class="mt-1 text-sm text-slate-600">
				Müşteri:
				<a href="/musteriler/{data.customer.id}" class="font-medium text-slate-900 hover:underline">
					{data.customer.name}
				</a>
				· Sektör: {data.item.workType === 'service' ? 'Teknik Servis' : 'Ajans'}
				· Atanan: {data.assignee?.name ?? 'Atanmadı'}
			</p>
		</div>
		<span class="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
			{getStatusLabel(data.item.status, data.item.workType)}
		</span>
	</div>

	{#if form?.error}
		<div class="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
			{form.error}
		</div>
	{/if}
	{#if form?.success}
		<div class="rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
			{form.success}
		</div>
	{/if}

	<!-- Müşteri Takip Bağlantısı ve Hızlı İletişim (wa.me / mailto) -->
	<section class="rounded-lg border border-slate-200 bg-white p-4">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="min-w-0">
				<div class="text-xs font-semibold text-slate-600 uppercase">Müşteri Takip Bağlantısı</div>
				<a
					href={trackingPath}
					target="_blank"
					rel="noopener noreferrer"
					class="mt-0.5 block truncate text-sm font-medium text-slate-900 underline"
				>
					{trackingPath}
				</a>
			</div>

			<div class="flex flex-wrap items-center gap-2 text-xs">
				<button
					type="button"
					onclick={copyTrackingUrl}
					class="rounded border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
				>
					{copiedTracking ? 'Kopyalandı' : 'Bağlantıyı Kopyala'}
				</button>
				<a
					href={trackingPath}
					target="_blank"
					rel="noopener noreferrer"
					class="rounded border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
				>
					Takip Sayfası
				</a>
				{#if waShareUrl}
					<a
						href={waShareUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="rounded bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700"
					>
						WhatsApp Mesaj
					</a>
				{/if}
				{#if mailtoShareUrl}
					<a
						href={mailtoShareUrl}
						class="rounded border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
					>
						E-posta Gönder
					</a>
				{/if}
			</div>
		</div>
	</section>

	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Detay & Durum Geçişi -->
		<section class="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
			<h2 class="text-base font-semibold text-slate-800">İş Bilgileri ve Durum Geçişi</h2>

			{#if data.item.description}
				<p class="text-sm text-slate-700">{data.item.description}</p>
			{/if}

			{#if metadataEntries.length > 0}
				<dl class="grid grid-cols-2 gap-2 rounded bg-slate-50 p-3 text-xs">
					{#each metadataEntries as [key, value] (key)}
						<div>
							<dt class="font-medium text-slate-500">{key}</dt>
							<dd class="text-slate-900">{String(value)}</dd>
						</div>
					{/each}
				</dl>
			{/if}

			{#if allowedNext.length > 0}
				<form method="POST" action="?/transition" class="space-y-3 border-t border-slate-100 pt-4">
					<label class="block text-sm">
						<span class="text-slate-700">Sonraki Durum</span>
						<select
							name="nextStatus"
							required
							class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
						>
							{#each allowedNext as st (st)}
								<option value={st}>{getStatusLabel(st, data.item.workType)}</option>
							{/each}
						</select>
					</label>
					<label class="block text-sm">
						<span class="text-slate-700">Geçiş Notu (isteğe bağlı)</span>
						<input
							name="note"
							class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
							placeholder="Örn. Parça siparişi verildi"
						/>
					</label>
					<label class="flex items-center gap-2 text-xs text-slate-600">
						<input type="checkbox" name="isPublic" checked />
						Müşteri takip ekranında görünsün
					</label>
					<button
						type="submit"
						class="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
					>
						Durumu Güncelle
					</button>
				</form>
			{:else}
				<p class="text-xs text-slate-500">Bu iş son durumda olduğu için yeni geçiş yapılamaz.</p>
			{/if}
		</section>

		<!-- Zaman Çizelgesi -->
		<section class="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
			<h2 class="text-base font-semibold text-slate-800">Zaman Çizelgesi</h2>

			<form method="POST" action="?/addLog" class="space-y-2">
				<textarea
					name="message"
					rows="2"
					required
					class="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
					placeholder="İşlem notu ekleyin..."></textarea>
				<div class="flex items-center justify-between">
					<label class="flex items-center gap-2 text-xs text-slate-600">
						<input type="checkbox" name="isPublic" />
						Müşteriye görünür
					</label>
					<button
						type="submit"
						class="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
					>
						Not Ekle
					</button>
				</div>
			</form>

			<ul class="max-h-72 space-y-2 overflow-y-auto border-t border-slate-100 pt-3 text-sm">
				{#each data.logs as log (log.id)}
					<li class="rounded bg-slate-50 p-2.5">
						<div class="flex items-center justify-between text-xs text-slate-500">
							<span>{log.actorName ?? 'Sistem'} · {log.isPublic ? 'Açık' : 'İç Not'}</span>
							<span>{new Date(log.createdAt).toLocaleString('tr-TR')}</span>
						</div>
						<p class="mt-1 text-slate-800">{log.message}</p>
					</li>
				{/each}
			</ul>
		</section>
	</div>

	{#if data.user?.role === 'admin'}
		<!-- Teklifler -->
		<section class="space-y-5 rounded-lg border border-slate-200 bg-white p-5">
			<h2 class="text-base font-semibold text-slate-800">Teklifler</h2>

			{#each data.quotes as q (q.id)}
				<div class="rounded-md border border-slate-200 p-4">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div>
							<span class="font-semibold text-slate-900">{q.quoteNo}</span>
							<span class="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">
								{quoteStatusLabels[q.status] ?? q.status}
							</span>
							<span class="ml-2 text-xs text-slate-500">
								{q.vatIncluded ? 'KDV Dahil' : 'KDV Hariç'}
							</span>
						</div>
						<div class="flex flex-wrap items-center gap-2 text-xs">
							<a
								href="/teklif/{q.id}/yazdir"
								class="rounded border border-slate-300 px-2.5 py-1 text-slate-700 hover:bg-slate-100"
							>
								Yazdır
							</a>
							{#if q.status === 'draft'}
								<button
									type="button"
									onclick={() => startEditDraft(q)}
									class="rounded border border-slate-300 px-2.5 py-1 text-slate-700 hover:bg-slate-100"
								>
									Düzenle
								</button>
								<form method="POST" action="?/sendQuote" class="inline">
									<input type="hidden" name="quoteId" value={q.id} />
									<button
										type="submit"
										class="rounded bg-blue-600 px-2.5 py-1 text-white hover:bg-blue-700"
									>
										Gönder
									</button>
								</form>
							{/if}
							{#if q.status === 'draft' || q.status === 'sent'}
								<form method="POST" action="?/approveQuote" class="inline">
									<input type="hidden" name="quoteId" value={q.id} />
									<button
										type="submit"
										class="rounded bg-emerald-600 px-2.5 py-1 text-white hover:bg-emerald-700"
									>
										Onayla
									</button>
								</form>
								<form method="POST" action="?/rejectQuote" class="inline">
									<input type="hidden" name="quoteId" value={q.id} />
									<button
										type="submit"
										class="rounded border border-red-300 px-2.5 py-1 text-red-700 hover:bg-red-50"
									>
										Reddet
									</button>
								</form>
							{/if}
							{#if q.status !== 'approved'}
								<form method="POST" action="?/reviseQuote" class="inline">
									<input type="hidden" name="quoteId" value={q.id} />
									<button
										type="submit"
										class="rounded border border-slate-300 px-2.5 py-1 text-slate-700 hover:bg-slate-100"
									>
										Revize Et
									</button>
								</form>
							{/if}
						</div>
					</div>

					{#if editingQuoteId === q.id && q.status === 'draft'}
						<form
							method="POST"
							action="?/updateDraftQuote"
							class="mt-4 space-y-3 rounded bg-slate-50 p-3"
						>
							<input type="hidden" name="quoteId" value={q.id} />
							<div class="flex items-center gap-4 text-xs">
								<label class="flex items-center gap-1.5">
									<span>KDV Modu:</span>
									<select
										name="vatIncluded"
										value={editVatIncluded ? 'true' : 'false'}
										class="rounded border border-slate-300 px-2 py-1"
									>
										<option value="false">KDV Hariç</option>
										<option value="true">KDV Dahil</option>
									</select>
								</label>
							</div>
							{#each editQuoteLines as line (line.id)}
								<div class="grid gap-2 sm:grid-cols-12">
									<select
										name="item_kind"
										bind:value={line.kind}
										class="rounded border border-slate-300 px-2 py-1 text-xs sm:col-span-2"
									>
										<option value="service">Hizmet</option>
										<option value="part">Parça</option>
										<option value="labor">İşçilik</option>
									</select>
									<input
										name="item_description"
										bind:value={line.description}
										required
										placeholder="Açıklama"
										class="rounded border border-slate-300 px-2 py-1 text-xs sm:col-span-4"
									/>
									<input
										name="item_qty"
										bind:value={line.qty}
										required
										placeholder="Miktar"
										class="rounded border border-slate-300 px-2 py-1 text-xs sm:col-span-1"
									/>
									<input
										name="item_unitPriceTl"
										bind:value={line.unitPriceTl}
										required
										placeholder="Birim TL"
										class="rounded border border-slate-300 px-2 py-1 text-xs sm:col-span-2"
									/>
									<select
										name="item_vatRate"
										bind:value={line.vatRate}
										class="rounded border border-slate-300 px-2 py-1 text-xs sm:col-span-2"
									>
										{#each COMMON_VAT_RATES as rate (rate)}
											<option value={rate}>%{rate} KDV</option>
										{/each}
									</select>
									<button
										type="button"
										onclick={() => removeEditLine(line.id)}
										class="text-xs text-red-600 sm:col-span-1"
									>
										Sil
									</button>
								</div>
							{/each}
							<input
								name="notes"
								bind:value={editNotes}
								placeholder="Teklif notu"
								class="w-full rounded border border-slate-300 px-2 py-1 text-xs"
							/>
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={addEditLine}
									class="rounded border border-slate-300 px-2.5 py-1 text-xs"
								>
									+ Kalem Ekle
								</button>
								<button
									type="submit"
									class="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white"
								>
									Taslağı Kaydet
								</button>
								<button
									type="button"
									onclick={() => (editingQuoteId = null)}
									class="text-xs text-slate-500"
								>
									Vazgeç
								</button>
							</div>
						</form>
					{:else}
						<table class="mt-3 w-full text-left text-xs">
							<thead class="border-b border-slate-200 text-slate-500">
								<tr>
									<th class="py-1">Tür</th>
									<th class="py-1">Açıklama</th>
									<th class="py-1 text-right">Miktar</th>
									<th class="py-1 text-right">Birim</th>
									<th class="py-1 text-right">KDV</th>
									<th class="py-1 text-right">Tutar</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100">
								{#each q.items as line (line.id)}
									<tr>
										<td class="py-1.5">{kindLabels[line.kind] ?? line.kind}</td>
										<td class="py-1.5">{line.description}</td>
										<td class="py-1.5 text-right">{Number(line.qty)}</td>
										<td class="py-1.5 text-right">{formatKurus(line.unitPriceKurus)}</td>
										<td class="py-1.5 text-right">%{line.vatRate}</td>
										<td class="py-1.5 text-right font-medium">
											{formatKurus(line.lineTotalKurus)}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
						<div class="mt-3 flex justify-end gap-6 border-t border-slate-100 pt-2 text-xs">
							<span>Ara Toplam: <strong>{formatKurus(q.subtotalKurus)}</strong></span>
							<span>KDV: <strong>{formatKurus(q.vatTotalKurus)}</strong></span>
							<span>Genel Toplam: <strong>{formatKurus(q.totalKurus)}</strong></span>
						</div>
					{/if}
				</div>
			{/each}

			<!-- Yeni Taslak Teklif Formu -->
			<form
				method="POST"
				action="?/createQuote"
				class="space-y-3 rounded-md border border-dashed border-slate-300 p-4"
			>
				<h3 class="text-sm font-semibold text-slate-800">Yeni Teklif Oluştur</h3>
				<div class="flex flex-wrap gap-4 text-xs">
					<label class="flex items-center gap-2">
						<span class="text-slate-700">KDV Modu:</span>
						<select name="vatIncluded" class="rounded border border-slate-300 px-2 py-1">
							<option value="false">KDV Hariç (Varsayılan)</option>
							<option value="true">KDV Dahil</option>
						</select>
					</label>
					<label class="flex items-center gap-2">
						<span class="text-slate-700">Geçerlilik:</span>
						<input
							type="date"
							name="validUntil"
							class="rounded border border-slate-300 px-2 py-1"
						/>
					</label>
				</div>

				{#each newQuoteLines as line (line.id)}
					<div class="grid gap-2 sm:grid-cols-12">
						<select
							name="item_kind"
							bind:value={line.kind}
							class="rounded border border-slate-300 px-2 py-1.5 text-xs sm:col-span-2"
						>
							<option value="service">Hizmet</option>
							<option value="part">Parça</option>
							<option value="labor">İşçilik</option>
						</select>
						<input
							name="item_description"
							bind:value={line.description}
							required
							placeholder="Kalem açıklaması"
							class="rounded border border-slate-300 px-2 py-1.5 text-xs sm:col-span-4"
						/>
						<input
							name="item_qty"
							bind:value={line.qty}
							required
							placeholder="Miktar"
							class="rounded border border-slate-300 px-2 py-1.5 text-xs sm:col-span-1"
						/>
						<input
							name="item_unitPriceTl"
							bind:value={line.unitPriceTl}
							required
							placeholder="Birim TL (örn. 1500,00)"
							class="rounded border border-slate-300 px-2 py-1.5 text-xs sm:col-span-2"
						/>
						<select
							name="item_vatRate"
							bind:value={line.vatRate}
							class="rounded border border-slate-300 px-2 py-1.5 text-xs sm:col-span-2"
						>
							{#each COMMON_VAT_RATES as rate (rate)}
								<option value={rate}>%{rate} KDV</option>
							{/each}
						</select>
						<button
							type="button"
							onclick={() => removeNewQuoteLine(line.id)}
							class="text-xs text-red-600 sm:col-span-1"
						>
							Sil
						</button>
					</div>
				{/each}

				<input
					name="notes"
					placeholder="Teklif notu (isteğe bağlı)"
					class="w-full rounded border border-slate-300 px-3 py-1.5 text-xs"
				/>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={addNewQuoteLine}
						class="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
					>
						+ Kalem Ekle
					</button>
					<button
						type="submit"
						class="rounded bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
					>
						Taslak Teklif Kaydet
					</button>
				</div>
			</form>
		</section>

		<!-- Tahsilat ve Türetilmiş Bakiye -->
		{#if data.balance}
			<section class="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<h2 class="text-base font-semibold text-slate-800">Tahsilat ve Bakiye</h2>
					<span class="rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
						{getPaymentStatusLabel(data.balance.status)}
					</span>
				</div>

				<div class="grid gap-3 sm:grid-cols-3">
					<div class="rounded bg-slate-50 p-3">
						<div class="text-xs text-slate-500">Onaylı Teklif</div>
						<div class="mt-1 text-lg font-semibold text-slate-900">
							{formatKurus(data.balance.approvedTotalKurus)}
						</div>
					</div>
					<div class="rounded bg-slate-50 p-3">
						<div class="text-xs text-slate-500">Toplam Tahsilat</div>
						<div class="mt-1 text-lg font-semibold text-emerald-700">
							{formatKurus(data.balance.paidTotalKurus)}
						</div>
					</div>
					<div class="rounded bg-slate-50 p-3">
						<div class="text-xs text-slate-500">Kalan Bakiye</div>
						<div class="mt-1 text-lg font-semibold text-slate-900">
							{formatKurus(data.balance.remainingKurus)}
						</div>
					</div>
				</div>

				<form
					method="POST"
					action="?/addPayment"
					class="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4"
				>
					<label class="block text-xs">
						<span class="text-slate-700">Tutar (TL) *</span>
						<input
							name="amountTl"
							required
							placeholder="Örn. 500,00"
							class="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
						/>
					</label>
					<label class="block text-xs">
						<span class="text-slate-700">Yöntem</span>
						<select
							name="method"
							class="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
						>
							<option value="cash">Nakit</option>
							<option value="card">Kart</option>
							<option value="transfer">Havale / EFT</option>
						</select>
					</label>
					<label class="block text-xs">
						<span class="text-slate-700">Belge / Fatura No</span>
						<input
							name="invoiceRef"
							placeholder="FTR-2026-001"
							class="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
						/>
					</label>
					<div class="flex items-end">
						<button
							type="submit"
							class="w-full rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
						>
							Tahsilat Ekle
						</button>
					</div>
				</form>

				{#if data.payments.length > 0}
					<table class="w-full text-left text-xs">
						<thead class="border-b border-slate-200 text-slate-500">
							<tr>
								<th class="py-1.5">Tarih</th>
								<th class="py-1.5">Yöntem</th>
								<th class="py-1.5">Belge No</th>
								<th class="py-1.5 text-right">Tutar</th>
								<th class="py-1.5 text-right">İşlem</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#each data.payments as p (p.id)}
								<tr>
									<td class="py-2">{new Date(p.paidAt).toLocaleString('tr-TR')}</td>
									<td class="py-2">{methodLabels[p.method] ?? p.method}</td>
									<td class="py-2">{p.invoiceRef ?? '—'}</td>
									<td class="py-2 text-right font-medium">{formatKurus(p.amountKurus)}</td>
									<td class="py-2 text-right">
										<form method="POST" action="?/deletePayment" class="inline">
											<input type="hidden" name="paymentId" value={p.id} />
											<button type="submit" class="text-red-600 hover:underline">Sil</button>
										</form>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</section>
		{/if}
	{/if}
</div>
