<script lang="ts">
	import { formatTrPhone } from '$lib/domain/phone';

	let { data, form } = $props();
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold text-slate-900">Müşteriler</h1>
		<span class="text-sm text-slate-500">Toplam {data.customers.length} kayıt</span>
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

	<section class="rounded-lg border border-slate-200 bg-white p-5">
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
					placeholder="ornek@firma.com"
				/>
			</label>
			<label class="block text-sm">
				<span class="text-slate-700">Vergi No</span>
				<input name="taxNo" class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5" />
			</label>
			<label class="block text-sm">
				<span class="text-slate-700">Tür</span>
				<select name="kind" class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5">
					<option value="lead">Aday (Lead)</option>
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

	<section class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
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
						<td colspan="5" class="px-4 py-6 text-center text-slate-500">
							Henüz müşteri kaydı yok.
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
								<div class="text-xs text-slate-500">{c.company}</div>
							{/if}
						</td>
						<td class="px-4 py-3 text-slate-700">{c.phone ? formatTrPhone(c.phone) : '—'}</td>
						<td class="px-4 py-3 text-slate-700">{c.email ?? '—'}</td>
						<td class="px-4 py-3">
							<span
								class="rounded px-2 py-0.5 text-xs font-medium {c.kind === 'active'
									? 'bg-emerald-100 text-emerald-800'
									: 'bg-amber-100 text-amber-800'}"
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
									<button type="submit" class="text-xs text-red-600 hover:underline">Sil</button>
								</form>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
</div>
