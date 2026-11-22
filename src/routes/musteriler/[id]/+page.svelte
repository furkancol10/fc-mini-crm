<script lang="ts">
	import { getStatusLabel } from '$lib/domain/status';

	let { data, form } = $props();
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<a href="/musteriler" class="text-xs text-slate-500 hover:underline">← Müşterilere Dön</a>
			<h1 class="mt-1 text-2xl font-semibold text-slate-900">{data.customer.name}</h1>
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

	<section class="rounded-lg border border-slate-200 bg-white p-5">
		<h2 class="text-base font-semibold text-slate-800">Müşteri Bilgileri</h2>
		<form method="POST" action="?/update" class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			<label class="block text-sm">
				<span class="text-slate-700">Ad Soyad *</span>
				<input
					name="name"
					required
					value={data.customer.name}
					class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
				/>
			</label>
			<label class="block text-sm">
				<span class="text-slate-700">Firma</span>
				<input
					name="company"
					value={data.customer.company ?? ''}
					class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
				/>
			</label>
			<label class="block text-sm">
				<span class="text-slate-700">Telefon</span>
				<input
					name="phone"
					value={data.customer.phone ?? ''}
					class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
				/>
			</label>
			<label class="block text-sm">
				<span class="text-slate-700">E-posta</span>
				<input
					name="email"
					type="email"
					value={data.customer.email ?? ''}
					class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
				/>
			</label>
			<label class="block text-sm">
				<span class="text-slate-700">Vergi No</span>
				<input
					name="taxNo"
					value={data.customer.taxNo ?? ''}
					class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
				/>
			</label>
			<label class="block text-sm">
				<span class="text-slate-700">Tür</span>
				<select
					name="kind"
					value={data.customer.kind}
					class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
				>
					<option value="lead">Aday (Lead)</option>
					<option value="active">Aktif Müşteri</option>
				</select>
			</label>
			<label class="block text-sm sm:col-span-2 lg:col-span-3">
				<span class="text-slate-700">Notlar</span>
				<textarea
					name="notes"
					rows="2"
					class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
					>{data.customer.notes ?? ''}</textarea
				>
			</label>
			<div class="sm:col-span-2 lg:col-span-3">
				<button
					type="submit"
					class="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
				>
					Güncelle
				</button>
			</div>
		</form>
	</section>

	<section class="rounded-lg border border-slate-200 bg-white p-5">
		<h2 class="text-base font-semibold text-slate-800">Bağlı İş Kayıtları</h2>
		{#if data.workItems.length === 0}
			<p class="mt-3 text-sm text-slate-500">Bu müşteriye ait görüntülenecek iş kaydı yok.</p>
		{:else}
			<ul class="mt-3 divide-y divide-slate-100 text-sm">
				{#each data.workItems as w (w.id)}
					<li class="flex items-center justify-between py-2.5">
						<div>
							<a href="/isler/{w.id}" class="font-medium text-slate-900 hover:underline">
								{w.code} — {w.title}
							</a>
							<div class="text-xs text-slate-500">
								{w.workType === 'service' ? 'Teknik Servis' : 'Ajans'}
							</div>
						</div>
						<span class="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
							{getStatusLabel(w.status, w.workType)}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
