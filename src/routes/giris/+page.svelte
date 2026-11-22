<script lang="ts">
	let { data, form } = $props();
</script>

<div class="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
	<h1 class="text-xl font-semibold text-slate-900">Demo Rol Seçimi</h1>
	<p class="mt-2 text-sm text-slate-600">
		Tek tıkla Yönetici veya Teknisyen rolüyle paneli inceleyebilirsiniz. Yetkiler sunucu tarafında
		imzalı çerez ile denetlenir.
	</p>

	<div class="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
		<strong>KVKK Uyarısı:</strong> Gerçek kişisel veri girmeyin. Bu uygulama demo amaçlıdır; gerçek ad,
		T.C. kimlik, telefon veya e-posta adresi paylaşmayınız.
	</div>

	{#if form?.error}
		<p class="mt-4 rounded bg-red-50 p-2 text-sm text-red-700">{form.error}</p>
	{/if}

	<form method="POST" action="?/switchRole" class="mt-5 space-y-3">
		{#each data.demoUsers as demoUser (demoUser.id)}
			<button
				type="submit"
				name="userId"
				value={demoUser.id}
				class="flex w-full items-center justify-between rounded-md border border-slate-300 px-4 py-3 text-left transition hover:border-slate-900 hover:bg-slate-50"
			>
				<div>
					<div class="font-medium text-slate-900">{demoUser.name}</div>
					<div class="text-xs text-slate-500">
						{demoUser.role === 'admin'
							? 'Tüm işler, teklif onayı, tahsilat ve silme yetkisi'
							: 'Yalnız atanan işler, durum güncelleme ve not ekleme'}
					</div>
				</div>
				<span class="rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
					{demoUser.role === 'admin' ? 'Yönetici' : 'Teknisyen'}
				</span>
			</button>
		{/each}
	</form>
</div>
