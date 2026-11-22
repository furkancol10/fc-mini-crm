<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		ALL_WORK_STATUSES,
		getAllowedNextStatuses,
		getStatusLabel,
		type WorkStatus
	} from '$lib/domain/status';

	let { data, form } = $props();
	let selectedWorkType = $state<'service' | 'agency'>('service');
	let selectedMobileTab = $state<WorkStatus | null>(null);
	const mobileTab = $derived<WorkStatus>(
		selectedMobileTab ??
			(data.query.status && ALL_WORK_STATUSES.includes(data.query.status as WorkStatus)
				? (data.query.status as WorkStatus)
				: 'new')
	);

	const priorityLabels: Record<'low' | 'normal' | 'high', string> = {
		low: 'Düşük',
		normal: 'Normal',
		high: 'Yüksek'
	};

	const columnLabels: Record<WorkStatus, string> = {
		new: 'Yeni / Kabul',
		quoted: 'Teklif Verildi',
		approved: 'Onaylandı',
		in_progress: 'İşlemde',
		waiting: 'Bekliyor',
		ready: 'Teslime Hazır',
		delivered: 'Teslim Edildi',
		cancelled: 'İptal'
	};

	function isOverdue(w: (typeof data.workItems)[number]): boolean {
		if (!w.dueDate) return false;
		if (w.status === 'delivered' || w.status === 'cancelled') return false;
		return new Date(w.dueDate).getTime() < Date.now();
	}

	function encodePairs(pairs: Array<[string, string]>): string {
		return pairs
			.filter(([, value]) => value.length > 0)
			.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
			.join('&');
	}

	function buildActionUrl(actionName: string): string {
		const qs = encodePairs([
			['view', data.query.view === 'kanban' ? 'kanban' : ''],
			['q', data.query.q],
			['status', data.query.status],
			['workType', data.query.workType],
			['priority', data.query.priority],
			['assignedTo', data.query.assignedTo],
			['overdue', data.query.overdue ? '1' : '']
		]);
		return qs ? `?/${actionName}&${qs}` : `?/${actionName}`;
	}

	function buildQueryUrl(basePath: string, overrides?: Partial<typeof data.query>): string {
		const merged = { ...data.query, ...overrides };
		const qs = encodePairs([
			['view', merged.view === 'kanban' ? 'kanban' : ''],
			['q', merged.q],
			['status', merged.status],
			['workType', merged.workType],
			['priority', merged.priority],
			['assignedTo', merged.assignedTo],
			['overdue', merged.overdue ? '1' : '']
		]);
		return qs ? `${basePath}?${qs}` : basePath;
	}

	function buildCsvUrl(): string {
		const qs = encodePairs([
			['type', 'work_items'],
			['q', data.query.q],
			['status', data.query.status],
			['workType', data.query.workType],
			['priority', data.query.priority],
			['assignedTo', data.query.assignedTo],
			['overdue', data.query.overdue ? '1' : '']
		]);
		return `/api/export?${qs}`;
	}

	const groupedByStatus = $derived.by(() => {
		const groups: Record<WorkStatus, Array<(typeof data.workItems)[number]>> = {
			new: [],
			quoted: [],
			approved: [],
			in_progress: [],
			waiting: [],
			ready: [],
			delivered: [],
			cancelled: []
		};
		for (const item of data.workItems) {
			groups[item.status].push(item);
		}
		return groups;
	});

	const hasActiveFilters = $derived(
		Boolean(
			data.query.q ||
			data.query.status ||
			data.query.workType ||
			data.query.priority ||
			data.query.assignedTo ||
			data.query.overdue
		)
	);

	const emptyWorkMessage = $derived(
		hasActiveFilters ? 'Filtrelere uygun iş kaydı bulunamadı.' : 'Henüz iş kaydı bulunmuyor.'
	);
</script>

<svelte:head>
	<title>İş Kayıtları — Mini CRM</title>
</svelte:head>

{#snippet kanbanCard(w: (typeof data.workItems)[number])}
	{@const nextOptions = getAllowedNextStatuses(w.status)}
	{@const overdue = isOverdue(w)}
	<article
		class="space-y-2.5 rounded-md border bg-white p-3 shadow-xs {overdue
			? 'border-red-300'
			: 'border-slate-200'}"
	>
		<div class="flex items-start justify-between gap-2">
			<a href="/isler/{w.id}" class="text-xs font-semibold text-slate-900 hover:underline">
				{w.code}
			</a>
			<div class="flex flex-wrap justify-end gap-1">
				<span
					class="rounded px-1.5 py-0.5 text-[10px] font-medium {w.workType === 'service'
						? 'bg-sky-100 text-sky-900'
						: 'bg-violet-100 text-violet-900'}"
				>
					{w.workType === 'service' ? 'Servis' : 'Ajans'}
				</span>
				{#if w.priority === 'high'}
					<span class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
						Yüksek
					</span>
				{/if}
				{#if overdue}
					<span class="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
						Gecikmiş
					</span>
				{/if}
			</div>
		</div>

		<a
			href="/isler/{w.id}"
			class="block text-sm leading-snug font-medium break-words text-slate-900 hover:underline"
		>
			{w.title}
		</a>

		<div class="space-y-0.5 text-xs text-slate-600">
			<div>Müşteri: <span class="text-slate-800">{w.customerName}</span></div>
			<div>Atanan: <span class="text-slate-800">{w.assigneeName ?? '—'}</span></div>
			{#if w.dueDate}
				<div class={overdue ? 'font-medium text-red-700' : ''}>
					Termin: {new Date(w.dueDate).toLocaleDateString('tr-TR')}
				</div>
			{/if}
		</div>

		{#if nextOptions.length > 0}
			<form
				method="POST"
				action={buildActionUrl('transition')}
				use:enhance
				class="flex items-center gap-1.5 border-t border-slate-100 pt-2"
			>
				<input type="hidden" name="workItemId" value={w.id} />
				<select
					name="nextStatus"
					aria-label="Durum değiştir ({w.code})"
					class="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
				>
					{#each nextOptions as st (st)}
						<option value={st}>{getStatusLabel(st, w.workType)}</option>
					{/each}
				</select>
				<button
					type="submit"
					class="shrink-0 rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
				>
					Taşı
				</button>
			</form>
		{:else}
			<div class="border-t border-slate-100 pt-2 text-[11px] text-slate-600">Son durum</div>
		{/if}
	</article>
{/snippet}

<div class="space-y-5">
	<!-- Başlık ve Görünüm Seçici -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold text-slate-900">İş Kayıtları</h1>
			<span class="text-xs text-slate-600">
				{data.workItems.length} kayıt
				{#if data.user?.role === 'staff'}
					(yalnız size atananlar)
				{/if}
			</span>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<div
				class="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs"
				role="group"
				aria-label="Görünüm seçimi"
			>
				<a
					href={buildQueryUrl('/isler', { view: 'list' })}
					aria-current={data.query.view === 'list' ? 'page' : undefined}
					class="rounded px-3 py-1 font-medium transition {data.query.view === 'list'
						? 'bg-slate-900 text-white'
						: 'text-slate-700 hover:bg-slate-100'}"
				>
					Liste
				</a>
				<a
					href={buildQueryUrl('/isler', { view: 'kanban' })}
					aria-current={data.query.view === 'kanban' ? 'page' : undefined}
					class="rounded px-3 py-1 font-medium transition {data.query.view === 'kanban'
						? 'bg-slate-900 text-white'
						: 'text-slate-700 hover:bg-slate-100'}"
				>
					Kanban
				</a>
			</div>

			{#if data.user?.role === 'admin'}
				<a
					href={buildCsvUrl()}
					class="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
				>
					CSV İndir
				</a>
			{/if}
		</div>
	</div>

	{#if form?.error}
		<div
			role="alert"
			class="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
		>
			{form.error}
		</div>
	{/if}
	{#if form?.success}
		<div
			role="status"
			class="rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800"
		>
			{form.success}
		</div>
	{/if}

	<!-- URL Tabanlı Filtreler -->
	<section aria-label="İş filtreleri" class="rounded-lg border border-slate-200 bg-white p-4">
		<form method="GET" action="/isler" class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
			{#if data.query.view === 'kanban'}
				<input type="hidden" name="view" value="kanban" />
			{/if}

			<input
				type="search"
				name="q"
				aria-label="Kod, başlık veya müşteri ara"
				value={data.query.q}
				placeholder="Kod, başlık veya müşteri ara..."
				class="min-w-0 rounded border border-slate-300 px-3 py-1.5 text-sm sm:col-span-2"
			/>

			<select
				name="workType"
				aria-label="Sektör filtresi"
				value={data.query.workType}
				class="min-w-0 rounded border border-slate-300 px-2.5 py-1.5 text-sm"
			>
				<option value="">Tüm Sektörler</option>
				<option value="service">Teknik Servis</option>
				<option value="agency">Ajans / Hizmet</option>
			</select>

			<select
				name="status"
				aria-label="Durum filtresi"
				value={data.query.status}
				class="min-w-0 rounded border border-slate-300 px-2.5 py-1.5 text-sm"
			>
				<option value="">Tüm Durumlar</option>
				{#each ALL_WORK_STATUSES as st (st)}
					<option value={st}>{columnLabels[st]}</option>
				{/each}
			</select>

			<select
				name="priority"
				aria-label="Öncelik filtresi"
				value={data.query.priority}
				class="min-w-0 rounded border border-slate-300 px-2.5 py-1.5 text-sm"
			>
				<option value="">Tüm Öncelikler</option>
				<option value="high">Yüksek</option>
				<option value="normal">Normal</option>
				<option value="low">Düşük</option>
			</select>

			{#if data.user?.role === 'admin'}
				<select
					name="assignedTo"
					aria-label="Sorumlu kişi filtresi"
					value={data.query.assignedTo}
					class="min-w-0 rounded border border-slate-300 px-2.5 py-1.5 text-sm"
				>
					<option value="">Tüm Sorumlular</option>
					<option value="unassigned">Atanmamış</option>
					{#each data.users as u (u.id)}
						<option value={String(u.id)}>{u.name}</option>
					{/each}
				</select>
			{/if}

			<div class="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 lg:col-span-6">
				<label class="flex items-center gap-2 text-xs text-slate-700">
					<input type="checkbox" name="overdue" value="1" checked={data.query.overdue} />
					Yalnız gecikmiş işler
				</label>

				<div class="flex items-center gap-2">
					{#if hasActiveFilters}
						<a
							href={data.query.view === 'kanban' ? '/isler?view=kanban' : '/isler'}
							class="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
						>
							Filtreleri Temizle
						</a>
					{/if}
					<button
						type="submit"
						class="rounded bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
					>
						Filtrele
					</button>
				</div>
			</div>
		</form>
	</section>

	<!-- Yeni İş / Talep Oluştur -->
	<details class="rounded-lg border border-slate-200 bg-white p-4">
		<summary class="cursor-pointer text-sm font-semibold text-slate-800">
			+ Yeni İş / Talep Oluştur
		</summary>
		{#if data.customers.length === 0}
			<p class="mt-3 text-sm text-amber-900">
				İş kaydı açmak için önce <a href="/musteriler" class="underline">Müşteriler</a> sayfasından bir
				müşteri ekleyin.
			</p>
		{:else}
			<form method="POST" action="?/create" class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				<label class="block text-sm">
					<span class="text-slate-700">Müşteri *</span>
					<select
						name="customerId"
						required
						class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
					>
						{#each data.customers as c (c.id)}
							<option value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>
						{/each}
					</select>
				</label>

				<label class="block text-sm">
					<span class="text-slate-700">Sektör / İş Türü *</span>
					<select
						name="workType"
						bind:value={selectedWorkType}
						class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
					>
						<option value="service">Teknik Servis</option>
						<option value="agency">Ajans / Hizmet</option>
					</select>
				</label>

				<label class="block text-sm">
					<span class="text-slate-700">Başlık *</span>
					<input
						name="title"
						required
						class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
						placeholder="Örn. Ekran değişimi veya Web sitesi yenileme"
					/>
				</label>

				<label class="block text-sm">
					<span class="text-slate-700">Öncelik</span>
					<select name="priority" class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5">
						<option value="normal">Normal</option>
						<option value="high">Yüksek</option>
						<option value="low">Düşük</option>
					</select>
				</label>

				{#if data.user?.role === 'admin'}
					<label class="block text-sm">
						<span class="text-slate-700">Atanan Kişi</span>
						<select
							name="assignedTo"
							class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
						>
							<option value="">Atanmadı</option>
							{#each data.users as u (u.id)}
								<option value={u.id}>{u.name}</option>
							{/each}
						</select>
					</label>
				{/if}

				<label class="block text-sm">
					<span class="text-slate-700">Termin Tarihi</span>
					<input
						type="date"
						name="dueDate"
						class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
					/>
				</label>

				{#if selectedWorkType === 'service'}
					<label class="block text-sm">
						<span class="text-slate-700">Cihaz</span>
						<input
							name="meta_device"
							class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
							placeholder="Örn. Dizüstü Bilgisayar"
						/>
					</label>
					<label class="block text-sm">
						<span class="text-slate-700">Marka</span>
						<input
							name="meta_brand"
							class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
							placeholder="Örn. Lenovo"
						/>
					</label>
					<label class="block text-sm">
						<span class="text-slate-700">Model</span>
						<input
							name="meta_model"
							class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
							placeholder="Örn. ThinkPad E15"
						/>
					</label>
					<label class="block text-sm">
						<span class="text-slate-700">Seri No</span>
						<input
							name="meta_serialNo"
							class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
						/>
					</label>
					<label class="block text-sm sm:col-span-2">
						<span class="text-slate-700">Aksesuarlar</span>
						<input
							name="meta_accessories"
							class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
							placeholder="Örn. Adaptör, çanta"
						/>
					</label>
				{:else}
					<label class="block text-sm">
						<span class="text-slate-700">Kanal</span>
						<input
							name="meta_channel"
							class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
							placeholder="Örn. Web, Instagram, Google Ads"
						/>
					</label>
					<label class="block text-sm sm:col-span-2">
						<span class="text-slate-700">Teslim Bağlantısı (https://...)</span>
						<input
							name="meta_deliverableUrl"
							class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
							placeholder="https://..."
						/>
					</label>
				{/if}

				<label class="block text-sm sm:col-span-2 lg:col-span-3">
					<span class="text-slate-700">Açıklama / Ön Teşhis / Kapsam</span>
					<textarea
						name="description"
						rows="2"
						class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"></textarea>
				</label>

				<div class="sm:col-span-2 lg:col-span-3">
					<button
						type="submit"
						class="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
					>
						İş Kaydı Oluştur
					</button>
				</div>
			</form>
		{/if}
	</details>

	{#if data.query.view === 'kanban'}
		<!-- KANBAN GÖRÜNÜMÜ (Sürükle-bırak yok; kartta durum seçici; mobilde sekmeler) -->
		<section class="space-y-4">
			<!-- Mobil (360px): Durum Sekmeleri -->
			<div class="md:hidden">
				<div class="flex flex-wrap gap-1.5" role="tablist" aria-label="Durum sekmeleri">
					{#each ALL_WORK_STATUSES as st (st)}
						{@const count = groupedByStatus[st].length}
						<button
							type="button"
							role="tab"
							aria-selected={mobileTab === st}
							onclick={() => (selectedMobileTab = st)}
							class="rounded-full border px-2.5 py-1 text-xs font-medium transition {mobileTab ===
							st
								? 'border-slate-900 bg-slate-900 text-white'
								: 'border-slate-300 bg-white text-slate-700'}"
						>
							{columnLabels[st]} ({count})
						</button>
					{/each}
				</div>

				<div class="mt-3 space-y-3" role="tabpanel">
					{#if groupedByStatus[mobileTab].length === 0}
						<p
							class="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600"
						>
							Bu durumda iş kaydı bulunmuyor.
						</p>
					{:else}
						{#each groupedByStatus[mobileTab] as w (w.id)}
							{@render kanbanCard(w)}
						{/each}
					{/if}
				</div>
			</div>

			<!-- Masaüstü: Sütunlu Kanban -->
			<div class="hidden gap-3 overflow-x-auto pb-3 md:flex">
				{#each ALL_WORK_STATUSES as st (st)}
					{@const colItems = groupedByStatus[st]}
					<div class="w-72 shrink-0 rounded-lg border border-slate-200 bg-slate-100/70 p-3">
						<div class="mb-3 flex items-center justify-between">
							<h2 class="text-xs font-semibold tracking-wide text-slate-700 uppercase">
								{columnLabels[st]}
							</h2>
							<span class="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
								{colItems.length}
							</span>
						</div>
						<div class="space-y-2.5">
							{#if colItems.length === 0}
								<p
									class="rounded border border-dashed border-slate-300 p-3 text-center text-xs text-slate-600"
								>
									Kayıt yok
								</p>
							{:else}
								{#each colItems as w (w.id)}
									{@render kanbanCard(w)}
								{/each}
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</section>
	{:else}
		<!-- LİSTE GÖRÜNÜMÜ -->
		<!-- Mobil Kart Listesi (360px uyumlu) -->
		<section class="space-y-3 sm:hidden">
			{#if data.workItems.length === 0}
				<p
					class="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-600"
				>
					{emptyWorkMessage}
				</p>
			{:else}
				{#each data.workItems as w (w.id)}
					{@const overdue = isOverdue(w)}
					<div
						class="space-y-2 rounded-lg border bg-white p-4 {overdue
							? 'border-red-300'
							: 'border-slate-200'}"
					>
						<div class="flex items-center justify-between gap-2">
							<a href="/isler/{w.id}" class="text-sm font-semibold text-slate-900 hover:underline">
								{w.code}
							</a>
							<span
								class="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800"
							>
								{getStatusLabel(w.status, w.workType)}
							</span>
						</div>
						<a
							href="/isler/{w.id}"
							class="block text-sm font-medium break-words text-slate-900 hover:underline"
						>
							{w.title}
						</a>
						<div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
							<span>{w.customerName}</span>
							<span>· {w.workType === 'service' ? 'Teknik Servis' : 'Ajans / Hizmet'}</span>
							<span>· {priorityLabels[w.priority]}</span>
							{#if overdue}
								<span class="font-semibold text-red-700">· Gecikmiş</span>
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</section>

		<!-- Masaüstü / Tablet Tablo -->
		<section class="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white sm:block">
			<table class="w-full text-left text-sm">
				<thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
					<tr>
						<th class="px-4 py-3">Kod / Başlık</th>
						<th class="px-4 py-3">Müşteri</th>
						<th class="px-4 py-3">Sektör</th>
						<th class="px-4 py-3">Durum</th>
						<th class="px-4 py-3">Öncelik</th>
						<th class="px-4 py-3">Termin</th>
						<th class="px-4 py-3">Atanan</th>
						<th class="px-4 py-3 text-right">İşlem</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#if data.workItems.length === 0}
						<tr>
							<td colspan="8" class="px-4 py-6 text-center text-slate-600">
								{emptyWorkMessage}
							</td>
						</tr>
					{/if}
					{#each data.workItems as w (w.id)}
						{@const overdue = isOverdue(w)}
						<tr class="hover:bg-slate-50">
							<td class="px-4 py-3">
								<a href="/isler/{w.id}" class="font-medium text-slate-900 hover:underline">
									{w.code} — {w.title}
								</a>
							</td>
							<td class="px-4 py-3 text-slate-700">{w.customerName}</td>
							<td class="px-4 py-3 text-xs text-slate-700">
								{w.workType === 'service' ? 'Teknik Servis' : 'Ajans / Hizmet'}
							</td>
							<td class="px-4 py-3">
								<span
									class="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-slate-800"
								>
									{getStatusLabel(w.status, w.workType)}
								</span>
							</td>
							<td class="px-4 py-3 text-xs text-slate-700">{priorityLabels[w.priority]}</td>
							<td
								class="px-4 py-3 text-xs whitespace-nowrap {overdue
									? 'font-semibold text-red-700'
									: 'text-slate-700'}"
							>
								{#if w.dueDate}
									{new Date(w.dueDate).toLocaleDateString('tr-TR')}
									{#if overdue}
										<span class="ml-1 rounded bg-red-100 px-1 py-0.5 text-[10px]">Gecikmiş</span>
									{/if}
								{:else}
									—
								{/if}
							</td>
							<td class="px-4 py-3 text-slate-700">{w.assigneeName ?? '—'}</td>
							<td class="px-4 py-3 text-right whitespace-nowrap">
								<a
									href="/isler/{w.id}"
									class="mr-2 text-xs font-medium text-slate-700 hover:underline"
								>
									Aç
								</a>
								{#if data.user?.role === 'admin'}
									<form method="POST" action="?/delete" class="inline">
										<input type="hidden" name="id" value={w.id} />
										<button type="submit" class="text-xs font-medium text-red-700 hover:underline">
											Sil
										</button>
									</form>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}
</div>
