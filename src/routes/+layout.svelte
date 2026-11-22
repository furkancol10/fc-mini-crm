<script lang="ts">
	import '../app.css';

	let { data, children } = $props();
</script>

<svelte:head>
	<title>Mini CRM — Teklif & İş Takip</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<header class="no-print border-b border-slate-200 bg-white">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
			<div class="flex items-center gap-6">
				<a href="/isler" class="text-lg font-semibold text-slate-900">Mini CRM</a>
				{#if data.user}
					<nav class="flex items-center gap-4 text-sm font-medium text-slate-600">
						<a href="/isler" class="hover:text-slate-900">İşler</a>
						<a href="/musteriler" class="hover:text-slate-900">Müşteriler</a>
					</nav>
				{/if}
			</div>

			<div class="flex flex-wrap items-center gap-2 text-sm">
				{#if data.user}
					<span class="rounded bg-slate-100 px-2.5 py-1 text-slate-700">
						{data.user.name}
						<strong class="ml-1 text-xs text-slate-500 uppercase">
							({data.user.role === 'admin' ? 'Yönetici' : 'Teknisyen'})
						</strong>
					</span>
				{/if}

				<form method="POST" action="/giris?/switchRole" class="flex items-center gap-1">
					{#each data.demoUsers as demoUser (demoUser.id)}
						<button
							type="submit"
							name="userId"
							value={demoUser.id}
							class="rounded border px-2.5 py-1 text-xs font-medium transition {data.user?.id ===
							demoUser.id
								? 'border-slate-900 bg-slate-900 text-white'
								: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}"
						>
							{demoUser.role === 'admin' ? 'Yönetici' : 'Teknisyen'}
						</button>
					{/each}
				</form>

				{#if data.user}
					<form method="POST" action="/giris?/logout">
						<button
							type="submit"
							class="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
						>
							Çıkış
						</button>
					</form>
				{/if}
			</div>
		</div>
	</header>

	<main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
		{@render children()}
	</main>
</div>
