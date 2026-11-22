<script lang="ts">
	import { formatKurus } from '$lib/domain/money';
	import { formatTrPhone } from '$lib/domain/phone';

	let { data } = $props();

	const kindLabels: Record<string, string> = {
		part: 'Parça',
		labor: 'İşçilik',
		service: 'Hizmet'
	};
</script>

<div
	class="mx-auto max-w-3xl space-y-6 rounded-lg border border-slate-200 bg-white p-8 print:border-0 print:p-0"
>
	<div class="no-print flex items-center justify-between border-b border-slate-200 pb-4">
		<a
			href={data.workItem ? `/isler/${data.workItem.id}` : '/isler'}
			class="text-sm text-slate-600 hover:underline"
		>
			← İş Kaydına Dön
		</a>
		<button
			type="button"
			onclick={() => window.print()}
			class="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
		>
			Yazdır / PDF Kaydet
		</button>
	</div>

	<div class="flex items-start justify-between">
		<div>
			<h1 class="text-2xl font-bold text-slate-900">TEKLİF FORMU</h1>
			<p class="mt-1 text-sm text-slate-600">
				Teklif No: <strong>{data.quote.quoteNo}</strong> (Sürüm {data.quote.version})
			</p>
			{#if data.workItem}
				<p class="text-sm text-slate-600">
					İş Kodu: <strong>{data.workItem.code}</strong> — {data.workItem.title}
				</p>
			{/if}
		</div>
		<div class="text-right text-sm text-slate-600">
			<div>Tarih: {new Date(data.quote.createdAt).toLocaleDateString('tr-TR')}</div>
			{#if data.quote.validUntil}
				<div>Geçerlilik: {new Date(data.quote.validUntil).toLocaleDateString('tr-TR')}</div>
			{/if}
			<div>KDV Modu: {data.quote.vatIncluded ? 'KDV Dahil' : 'KDV Hariç'}</div>
		</div>
	</div>

	{#if data.customer}
		<div class="rounded border border-slate-200 p-4 text-sm">
			<div class="text-xs font-semibold text-slate-500 uppercase">Müşteri Bilgileri</div>
			<div class="mt-1 font-medium text-slate-900">{data.customer.name}</div>
			{#if data.customer.company}
				<div class="text-slate-700">{data.customer.company}</div>
			{/if}
			<div class="text-slate-600">
				{#if data.customer.phone}{formatTrPhone(data.customer.phone)}{/if}
				{#if data.customer.email}
					· {data.customer.email}{/if}
			</div>
			{#if data.customer.taxNo}
				<div class="text-slate-600">Vergi No: {data.customer.taxNo}</div>
			{/if}
		</div>
	{/if}

	<table class="w-full text-left text-sm">
		<thead class="border-y border-slate-300 bg-slate-50 text-xs text-slate-600 uppercase">
			<tr>
				<th class="px-2 py-2">Tür</th>
				<th class="px-2 py-2">Açıklama</th>
				<th class="px-2 py-2 text-right">Miktar</th>
				<th class="px-2 py-2 text-right">Birim Fiyat</th>
				<th class="px-2 py-2 text-right">KDV</th>
				<th class="px-2 py-2 text-right">Toplam</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-slate-200">
			{#each data.items as line (line.id)}
				<tr>
					<td class="px-2 py-2">{kindLabels[line.kind] ?? line.kind}</td>
					<td class="px-2 py-2">{line.description}</td>
					<td class="px-2 py-2 text-right">{Number(line.qty)}</td>
					<td class="px-2 py-2 text-right">{formatKurus(line.unitPriceKurus)}</td>
					<td class="px-2 py-2 text-right">%{line.vatRate}</td>
					<td class="px-2 py-2 text-right font-medium">{formatKurus(line.lineTotalKurus)}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<div class="ml-auto max-w-xs space-y-1.5 border-t border-slate-300 pt-3 text-sm">
		<div class="flex justify-between">
			<span class="text-slate-600">Ara Toplam:</span>
			<span>{formatKurus(data.quote.subtotalKurus)}</span>
		</div>
		<div class="flex justify-between">
			<span class="text-slate-600">Toplam KDV:</span>
			<span>{formatKurus(data.quote.vatTotalKurus)}</span>
		</div>
		<div class="flex justify-between border-t border-slate-200 pt-1.5 text-base font-bold">
			<span>Genel Toplam:</span>
			<span>{formatKurus(data.quote.totalKurus)}</span>
		</div>
	</div>

	{#if data.quote.notes}
		<div class="rounded bg-slate-50 p-3 text-xs text-slate-700">
			<strong>Notlar:</strong>
			{data.quote.notes}
		</div>
	{/if}

	<p class="border-t border-slate-200 pt-4 text-xs text-slate-500">
		Bu belge bilgilendirme amaçlı temsili teklif çıktısıdır; resmi e-Fatura veya e-Arşiv yerine
		geçmez.
	</p>
</div>
