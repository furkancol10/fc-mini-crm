<script lang="ts">
	import { page } from '$app/state';

	const heading = $derived.by(() => {
		if (page.status === 404) return 'Sayfa veya kayıt bulunamadı';
		if (page.status === 403) return 'Erişim yetkisi yok';
		if (page.status === 429) return 'Çok fazla istek';
		return 'Bir hata oluştu';
	});

	const fallbackMessage = $derived.by(() => {
		if (page.status === 404) return 'Aradığınız kayıt silinmiş veya bağlantı geçersiz olabilir.';
		if (page.status === 403) return 'Bu işlem için Yönetici rolüne geçmeniz gerekiyor.';
		if (page.status === 429)
			return 'Kısa sürede çok fazla istek gönderildi. Lütfen biraz bekleyin.';
		return 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';
	});
</script>

<svelte:head>
	<title>Hata {page.status} — Mini CRM</title>
</svelte:head>

<div class="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-xs">
	<div class="text-xs font-semibold tracking-wider text-slate-600 uppercase">
		Hata {page.status}
	</div>
	<h1 class="mt-2 text-xl font-semibold text-slate-900">{heading}</h1>
	<p class="mt-2 text-sm text-slate-600">{page.error?.message || fallbackMessage}</p>
	<div class="mt-5 flex flex-wrap justify-center gap-2">
		<a
			href="/pano"
			class="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
		>
			Panoya Dön
		</a>
		<a
			href="/giris"
			class="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
		>
			Rol Seçimi
		</a>
	</div>
</div>
