<script lang="ts">
	import { formatKurus } from '$lib/domain/money';
	import { getStatusLabel } from '$lib/domain/status';

	let { data, form } = $props();

	const quoteStatusLabels: Record<string, string> = {
		sent: 'Onay Bekliyor',
		approved: 'Onaylandı',
		rejected: 'Reddedildi',
		expired: 'Süresi Doldu'
	};

	const kindLabels: Record<string, string> = {
		part: 'Parça',
		labor: 'İşçilik',
		service: 'Hizmet'
	};
</script>

<svelte:head>
	<title>İş Takibi — {data.workItem.code}</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<header class="rounded-lg border border-slate-200 bg-white p-5">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<div class="text-xs font-medium tracking-wide text-slate-500 uppercase">
					Müşteri İş Takip Ekranı · {data.workItem.workType === 'service'
						? 'Teknik Servis'
						: 'Ajans / Hizmet'}
				</div>
				<h1 class="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">
					{data.workItem.code} — {data.workItem.title}
				</h1>
			</div>
			<span class="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white sm:text-sm">
				{getStatusLabel(data.workItem.status, data.workItem.workType)}
			</span>
		</div>

		<div class="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
			<span>Kayıt: {new Date(data.workItem.createdAt).toLocaleDateString('tr-TR')}</span>
			{#if data.workItem.dueDate}
				<span>Tahmini Termin: {new Date(data.workItem.dueDate).toLocaleDateString('tr-TR')}</span>
			{/if}
			{#if data.workItem.deliveredAt}
				<span>Teslim: {new Date(data.workItem.deliveredAt).toLocaleDateString('tr-TR')}</span>
			{/if}
		</div>
	</header>

	{#if form?.error}
		<div class="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
			{form.error}
		</div>
	{/if}
	{#if form?.success}
		<div class="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
			{form.success}
		</div>
	{/if}

	<!-- Teklifler -->
	{#if data.quotes.length > 0}
		<section class="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
			<h2 class="text-base font-semibold text-slate-800">Teklifler</h2>

			{#each data.quotes as q (q.id)}
				<div class="rounded-md border border-slate-200 p-4">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div>
							<span class="font-semibold text-slate-900">{q.quoteNo}</span>
							<span
								class="ml-2 rounded px-2 py-0.5 text-xs font-medium {q.status === 'approved'
									? 'bg-emerald-100 text-emerald-800'
									: q.status === 'rejected'
										? 'bg-red-100 text-red-700'
										: 'bg-amber-100 text-amber-800'}"
							>
								{quoteStatusLabels[q.status] ?? q.status}
							</span>
							<span class="ml-2 text-xs text-slate-500">
								{q.vatIncluded ? 'KDV Dahil' : 'KDV Hariç'}
							</span>
						</div>

						{#if q.validUntil}
							<span class="text-xs text-slate-500">
								Geçerlilik: {new Date(q.validUntil).toLocaleDateString('tr-TR')}
							</span>
						{/if}
					</div>

					<div class="mt-3 overflow-x-auto">
						<table class="w-full text-left text-xs">
							<thead class="border-b border-slate-200 text-slate-500">
								<tr>
									<th class="py-1.5 pr-2">Tür</th>
									<th class="py-1.5 pr-2">Açıklama</th>
									<th class="py-1.5 pr-2 text-right">Miktar</th>
									<th class="py-1.5 pr-2 text-right">Birim</th>
									<th class="py-1.5 pr-2 text-right">KDV</th>
									<th class="py-1.5 text-right">Tutar</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100">
								{#each q.items as line (line.id)}
									<tr>
										<td class="py-1.5 pr-2">{kindLabels[line.kind] ?? line.kind}</td>
										<td class="py-1.5 pr-2">{line.description}</td>
										<td class="py-1.5 pr-2 text-right">{Number(line.qty)}</td>
										<td class="py-1.5 pr-2 text-right">{formatKurus(line.unitPriceKurus)}</td>
										<td class="py-1.5 pr-2 text-right">%{line.vatRate}</td>
										<td class="py-1.5 text-right font-medium">
											{formatKurus(line.lineTotalKurus)}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<div
						class="mt-3 flex flex-wrap justify-end gap-x-5 gap-y-1 border-t border-slate-100 pt-2 text-xs"
					>
						<span>Ara Toplam: <strong>{formatKurus(q.subtotalKurus)}</strong></span>
						<span>KDV: <strong>{formatKurus(q.vatTotalKurus)}</strong></span>
						<span class="text-sm">Genel Toplam: <strong>{formatKurus(q.totalKurus)}</strong></span>
					</div>

					{#if q.notes}
						<p class="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600">{q.notes}</p>
					{/if}

					{#if q.status === 'sent' && data.canDecideQuotes}
						<div class="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
							<form method="POST" action="?/approveQuote">
								<input type="hidden" name="quoteId" value={q.id} />
								<button
									type="submit"
									class="rounded bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
								>
									Teklifi Onayla
								</button>
							</form>
							<form method="POST" action="?/rejectQuote">
								<input type="hidden" name="quoteId" value={q.id} />
								<button
									type="submit"
									class="rounded border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
								>
									Teklifi Reddet
								</button>
							</form>
						</div>
					{/if}
				</div>
			{/each}

			<p class="text-[11px] text-slate-400">
				Gösterilen teklif tutarları bilgilendirme amaçlı temsili teklif özetidir; resmi e-Fatura
				yerine geçmez.
			</p>
		</section>
	{/if}

	<!-- Zaman Çizelgesi (Yalnız müşteriye açık kayıtlar) -->
	<section class="rounded-lg border border-slate-200 bg-white p-5">
		<h2 class="text-base font-semibold text-slate-800">İşlem Geçmişi</h2>
		{#if data.publicLogs.length === 0}
			<p class="mt-3 text-sm text-slate-500">Henüz paylaşılan durum güncellemesi bulunmuyor.</p>
		{:else}
			<ul class="mt-3 space-y-2.5 text-sm">
				{#each data.publicLogs as log (log.id)}
					<li class="rounded bg-slate-50 p-3">
						<div class="text-xs text-slate-500">
							{new Date(log.createdAt).toLocaleString('tr-TR')}
						</div>
						<p class="mt-1 text-slate-800">{log.message}</p>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
