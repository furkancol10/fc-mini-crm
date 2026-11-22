<script lang="ts">
	import { getStatusLabel } from '$lib/domain/status';

	let { data, form } = $props();
	let selectedWorkType = $state<'service' | 'agency'>('service');

	const priorityLabels: Record<'low' | 'normal' | 'high', string> = {
		low: 'Düşük',
		normal: 'Normal',
		high: 'Yüksek'
	};
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold text-slate-900">İş Kayıtları</h1>
		<span class="text-sm text-slate-500">
			{data.workItems.length} kayıt
			{#if data.user?.role === 'staff'}
				(yalnız size atananlar)
			{/if}
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

	<section class="rounded-lg border border-slate-200 bg-white p-5">
		<h2 class="text-base font-semibold text-slate-800">Yeni İş / Talep Oluştur</h2>
		{#if data.customers.length === 0}
			<p class="mt-3 text-sm text-amber-800">
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
						<span class="text-slate-700">Marka / Model</span>
						<input
							name="meta_brand"
							class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
							placeholder="Örn. Lenovo ThinkPad"
						/>
					</label>
					<label class="block text-sm">
						<span class="text-slate-700">Seri No</span>
						<input
							name="meta_serialNo"
							class="mt-1 w-full rounded border border-slate-300 px-3 py-1.5"
						/>
					</label>
					<label class="block text-sm sm:col-span-2 lg:col-span-3">
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
					<span class="text-slate-700">Açıklama / Ön Teşhis / Brief</span>
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
	</section>

	<section class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
				<tr>
					<th class="px-4 py-3">Kod / Başlık</th>
					<th class="px-4 py-3">Müşteri</th>
					<th class="px-4 py-3">Sektör</th>
					<th class="px-4 py-3">Durum</th>
					<th class="px-4 py-3">Öncelik</th>
					<th class="px-4 py-3">Atanan</th>
					<th class="px-4 py-3 text-right">İşlem</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if data.workItems.length === 0}
					<tr>
						<td colspan="7" class="px-4 py-6 text-center text-slate-500">
							Görüntülenecek iş kaydı bulunamadı.
						</td>
					</tr>
				{/if}
				{#each data.workItems as w (w.id)}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-3">
							<a href="/isler/{w.id}" class="font-medium text-slate-900 hover:underline">
								{w.code} — {w.title}
							</a>
						</td>
						<td class="px-4 py-3 text-slate-700">{w.customerName}</td>
						<td class="px-4 py-3 text-xs text-slate-600">
							{w.workType === 'service' ? 'Teknik Servis' : 'Ajans'}
						</td>
						<td class="px-4 py-3">
							<span class="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
								{getStatusLabel(w.status, w.workType)}
							</span>
						</td>
						<td class="px-4 py-3 text-xs text-slate-600">{priorityLabels[w.priority]}</td>
						<td class="px-4 py-3 text-slate-600">{w.assigneeName ?? '—'}</td>
						<td class="px-4 py-3 text-right">
							<a
								href="/isler/{w.id}"
								class="mr-2 text-xs font-medium text-slate-700 hover:underline"
							>
								Aç
							</a>
							{#if data.user?.role === 'admin'}
								<form method="POST" action="?/delete" class="inline">
									<input type="hidden" name="id" value={w.id} />
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
