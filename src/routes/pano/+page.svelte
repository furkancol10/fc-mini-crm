<script lang="ts">
	import { formatKurus } from '$lib/domain/money';

	let { data, form } = $props();

	const logTypeLabels: Record<'status' | 'note' | 'quote' | 'payment', string> = {
		status: 'Durum',
		note: 'Not',
		quote: 'Teklif',
		payment: 'Tahsilat'
	};
</script>

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold text-slate-900">Pano</h1>
			<p class="mt-0.5 text-sm text-slate-500">
				{#if data.user?.role === 'admin'}
					Genel operasyon özeti ve son işlemler
				{:else}
					Size atanan aktif işler ve son hareketler
				{/if}
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<a
				href="/isler?view=kanban"
				class="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
			>
				Kanban Görünümü
			</a>
			<a
				href="/isler"
				class="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
			>
				Tüm İşler
			</a>
		</div>
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

	<!-- KPI Kartları -->
	<section
		class="grid gap-4 {data.summary.financial ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'}"
	>
		{#if data.summary.financial}
			<div class="rounded-lg border border-slate-200 bg-white p-5">
				<div class="text-xs font-medium text-slate-500">Açık Teklif Tutarı</div>
				<div class="mt-2 text-2xl font-bold text-slate-900">
					{formatKurus(data.summary.financial.openQuoteTotalKurus)}
				</div>
				<div class="mt-1 text-xs text-slate-500">
					{data.summary.financial.openQuoteCount} gönderilmiş teklif
				</div>
			</div>

			<div class="rounded-lg border border-slate-200 bg-white p-5">
				<div class="text-xs font-medium text-slate-500">Aylık Onaylanan</div>
				<div class="mt-2 text-2xl font-bold text-emerald-700">
					{formatKurus(data.summary.financial.monthlyApprovedTotalKurus)}
				</div>
				<div class="mt-1 text-xs text-slate-500">
					Bu ay {data.summary.financial.monthlyApprovedCount} onaylı teklif
				</div>
			</div>
		{/if}

		<a
			href="/isler"
			class="block rounded-lg border border-slate-200 bg-white p-5 transition hover:border-slate-400"
		>
			<div class="text-xs font-medium text-slate-500">Aktif İş</div>
			<div class="mt-2 text-2xl font-bold text-slate-900">{data.summary.activeWorkCount}</div>
			<div class="mt-1 text-xs text-slate-500">Teslim ve iptal hariç</div>
		</a>

		<a
			href="/isler?overdue=1"
			class="block rounded-lg border p-5 transition {data.summary.overdueWorkCount > 0
				? 'border-red-200 bg-red-50/50 hover:border-red-400'
				: 'border-slate-200 bg-white hover:border-slate-400'}"
		>
			<div class="text-xs font-medium text-slate-500">Geciken İş</div>
			<div
				class="mt-2 text-2xl font-bold {data.summary.overdueWorkCount > 0
					? 'text-red-700'
					: 'text-slate-900'}"
			>
				{data.summary.overdueWorkCount}
			</div>
			<div class="mt-1 text-xs text-slate-500">Termini geçmiş aktif kayıtlar</div>
		</a>
	</section>

	<!-- Son 10 Log -->
	<section class="rounded-lg border border-slate-200 bg-white p-5">
		<div class="flex items-center justify-between">
			<h2 class="text-base font-semibold text-slate-800">Son 10 İşlem Kaydı</h2>
			<span class="text-xs text-slate-500">{data.summary.recentLogs.length} kayıt</span>
		</div>

		{#if data.summary.recentLogs.length === 0}
			<p class="mt-4 text-sm text-slate-500">Henüz kayıtlı işlem bulunmuyor.</p>
		{:else}
			<ul class="mt-4 divide-y divide-slate-100 text-sm">
				{#each data.summary.recentLogs as log (log.id)}
					<li class="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between">
						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-2 text-xs">
								<a
									href="/isler/{log.workItemId}"
									class="font-semibold text-slate-900 hover:underline"
								>
									{log.workCode}
								</a>
								<span class="truncate text-slate-500">{log.workTitle}</span>
								<span class="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">
									{logTypeLabels[log.type] ?? log.type}
								</span>
								<span class="text-slate-400">·</span>
								<span class="text-slate-500">{log.isPublic ? 'Müşteriye açık' : 'İç kayıt'}</span>
							</div>
							<p class="mt-1 text-slate-800">{log.message}</p>
						</div>
						<div class="shrink-0 text-xs text-slate-500 sm:text-right">
							<div>{new Date(log.createdAt).toLocaleString('tr-TR')}</div>
							<div>{log.actorName ?? 'Müşteri / Sistem'}</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if data.user?.role === 'admin'}
		<!-- Yönetici Araçları: CSV Dışa Aktarım & Demo Sıfırlama -->
		<section class="grid gap-4 lg:grid-cols-2">
			<div class="rounded-lg border border-slate-200 bg-white p-5">
				<h2 class="text-base font-semibold text-slate-800">CSV Dışa Aktarım</h2>
				<p class="mt-1 text-xs text-slate-500">
					Excel uyumlu UTF-8 BOM, noktalı virgül ayırıcılı ve formül enjeksiyonuna karşı korumalı
					dışa aktarım.
				</p>
				<div class="mt-3 flex flex-wrap gap-2">
					<a
						href="/api/export?type=work_items"
						class="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
					>
						İşler CSV
					</a>
					<a
						href="/api/export?type=customers"
						class="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
					>
						Müşteriler CSV
					</a>
					<a
						href="/api/export?type=payments"
						class="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
					>
						Tahsilatlar CSV
					</a>
				</div>
			</div>

			<div class="rounded-lg border border-amber-200 bg-amber-50/60 p-5">
				<h2 class="text-base font-semibold text-amber-950">Demo Verisini Sıfırla</h2>
				<p class="mt-1 text-xs text-amber-900">
					Tüm kayıtları temizler ve temsili başlangıç verisini (8 müşteri, 14 iş, teklifler ve
					tahsilatlar) yeniden yükler. Hız sınırlıdır.
				</p>
				<form method="POST" action="?/resetDemo" class="mt-3">
					<button
						type="submit"
						class="rounded bg-amber-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
					>
						Demo verisini sıfırla
					</button>
				</form>
			</div>
		</section>
	{/if}
</div>
