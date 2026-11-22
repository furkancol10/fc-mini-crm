<script lang="ts">
	import { buildMailtoUrl } from '$lib/domain/links';
	import { buildWhatsAppUrl, formatTrPhone } from '$lib/domain/phone';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Müşteriler — Mini CRM</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<div>
			<h1 class="text-2xl font-semibold text-slate-900">Müşteriler</h1>
			<span class="text-xs text-slate-600">Toplam {data.customers.length} kayıt</span>
		</div>
		{#if data.user?.role === 'admin'}
			<a
				href="/api/export?type=customers"
				class="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
			>
				CSV İndir
			</a>
		{/if}
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

	<section class="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
		<h2 class="text-base font-semibold text-slate-800">Yeni Müşteri Ekle</h2>
		<form method="POST" action="?/create" class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			<label class="block text-sm">
				<span class="text-slate-700">Ad Soyad *</span>
				<input
					name="name"
					required
					class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
					placeholder="Örn. Ahmet Yılmaz"
				/>
			</label>
			<label class="block text-sm">
				<span class="text-slate-700">Firma</span>
				<input
					name="company"
					class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
					placeholder="Örn. Yılmaz Elektronik"
				/>
			</label>
			<label class="block text-sm">
				<span class="text-slate-700">Telefon</span>
				<input
					name="phone"
					class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
					placeholder="0532 123 45 67"
				/>
			</label>
			<label class="block text-sm">
				<span class="text-slate-700">E-posta</span>
				<input
					name="email"
					type="email"
					class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
					placeholder="ornek@firma.test"
				/>
			</label>
			<label class="block text-sm">
				<span class="text-slate-700">Vergi No</span>
				<input name="taxNo" class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5" />
			</label>
			<label class="block text-sm">
				<span class="text-slate-700">Tür</span>
				<select name="kind" class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5">
					<option value="lead">Aday Müşteri</option>
					<option value="active">Aktif Müşteri</option>
				</select>
			</label>
			<label class="block text-sm sm:col-span-2 lg:col-span-3">
				<span class="text-slate-700">Notlar</span>
				<textarea
					name="notes"
					rows="2"
					class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"></textarea>
			</label>
			<div class="sm:col-span-2 lg:col-span-3">
				<button
					type="submit"
					class="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
				>
					Müşteri Kaydet
				</button>
			</div>
		</form>
	</section>

	<!-- Mobil Kart Listesi (360px uyumlu) -->
	<section class="space-y-3 sm:hidden">
		{#if data.customers.length === 0}
			<p class="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
				Henüz müşteri kaydı bulunmuyor.
			</p>
		{:else}
			{#each data.customers as c (c.id)}
				{@const waUrl = c.phone ? buildWhatsAppUrl(c.phone) : null}
				{@const mailUrl = c.email ? buildMailtoUrl(c.email) : null}
				<article class="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<a
								href="/musteriler/{c.id}"
								class="block font-medium break-words text-slate-900 hover:underline"
							>
								{c.name}
							</a>
							{#if c.company}
								<div class="text-xs text-slate-600">{c.company}</div>
							{/if}
						</div>
						<span
							class="shrink-0 rounded px-2 py-0.5 text-xs font-medium {c.kind === 'active'
								? 'bg-emerald-100 text-emerald-800'
								: 'bg-amber-100 text-amber-900'}"
						>
							{c.kind === 'active' ? 'Aktif' : 'Aday'}
						</span>
					</div>

					<div class="space-y-1 text-xs text-slate-700">
						{#if c.phone}
							<div class="flex flex-wrap items-center gap-2">
								<span>{formatTrPhone(c.phone)}</span>
								{#if waUrl}
									<a
										href={waUrl}
										target="_blank"
										rel="noopener noreferrer"
										class="font-medium text-emerald-700 hover:underline"
									>
										WhatsApp
									</a>
								{/if}
							</div>
						{/if}
						{#if c.email}
							<div class="break-all">
								{#if mailUrl}
									<a href={mailUrl} class="hover:underline">{c.email}</a>
								{:else}
									{c.email}
								{/if}
							</div>
						{/if}
					</div>

					<div class="flex items-center justify-end gap-3 border-t border-slate-100 pt-2 text-xs">
						<a href="/musteriler/{c.id}" class="font-medium text-slate-700 hover:underline">
							Detay
						</a>
						{#if data.user?.role === 'admin'}
							<form method="POST" action="?/delete" class="inline">
								<input type="hidden" name="id" value={c.id} />
								<button type="submit" class="font-medium text-red-700 hover:underline">Sil</button>
							</form>
						{/if}
					</div>
				</article>
			{/each}
		{/if}
	</section>

	<!-- Masaüstü / Tablet Tablo -->
	<section class="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white sm:block">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
				<tr>
					<th class="px-4 py-3">Ad / Firma</th>
					<th class="px-4 py-3">Telefon</th>
					<th class="px-4 py-3">E-posta</th>
					<th class="px-4 py-3">Tür</th>
					<th class="px-4 py-3 text-right">İşlem</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if data.customers.length === 0}
					<tr>
						<td colspan="5" class="px-4 py-6 text-center text-slate-600">
							Henüz müşteri kaydı bulunmuyor.
						</td>
					</tr>
				{/if}
				{#each data.customers as c (c.id)}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-3">
							<a href="/musteriler/{c.id}" class="font-medium text-slate-900 hover:underline">
								{c.name}
							</a>
							{#if c.company}
								<div class="text-xs text-slate-600">{c.company}</div>
							{/if}
						</td>
						<td class="px-4 py-3 text-slate-700">
							{#if c.phone}
								{@const waUrl = buildWhatsAppUrl(c.phone)}
								<div>{formatTrPhone(c.phone)}</div>
								{#if waUrl}
									<a
										href={waUrl}
										target="_blank"
										rel="noopener noreferrer"
										class="text-xs font-medium text-emerald-700 hover:underline"
									>
										WhatsApp
									</a>
								{/if}
							{:else}
								—
							{/if}
						</td>
						<td class="px-4 py-3 text-slate-700">
							{#if c.email}
								{@const mailUrl = buildMailtoUrl(c.email)}
								{#if mailUrl}
									<a href={mailUrl} class="text-slate-700 hover:underline">{c.email}</a>
								{:else}
									{c.email}
								{/if}
							{:else}
								—
							{/if}
						</td>
						<td class="px-4 py-3">
							<span
								class="rounded px-2 py-0.5 text-xs font-medium {c.kind === 'active'
									? 'bg-emerald-100 text-emerald-800'
									: 'bg-amber-100 text-amber-900'}"
							>
								{c.kind === 'active' ? 'Aktif' : 'Aday'}
							</span>
						</td>
						<td class="px-4 py-3 text-right">
							<a
								href="/musteriler/{c.id}"
								class="mr-2 text-xs font-medium text-slate-700 hover:underline"
							>
								Detay
							</a>
							{#if data.user?.role === 'admin'}
								<form method="POST" action="?/delete" class="inline">
									<input type="hidden" name="id" value={c.id} />
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
</div>
