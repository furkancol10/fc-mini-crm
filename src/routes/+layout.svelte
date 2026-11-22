<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { data, children } = $props();

	const pathname = $derived(page.url.pathname);
</script>

<svelte:head>
	<title>Mini CRM — Teklif & İş Takip</title>
</svelte:head>

<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-slate-900 focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
>
	İçeriğe atla
</a>

<div class="flex min-h-screen flex-col bg-slate-50">
	{#if !data.isPublicTracking}
		<header class="no-print border-b border-slate-200 bg-white">
			<div
				class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-4"
			>
				<div class="flex flex-wrap items-center gap-4 sm:gap-6">
					<a href="/pano" class="text-base font-semibold text-slate-900 sm:text-lg">Mini CRM</a>
					{#if data.user}
						<nav
							aria-label="Ana gezinme"
							class="flex items-center gap-3 text-sm font-medium text-slate-600 sm:gap-4"
						>
							<a
								href="/pano"
								aria-current={pathname.startsWith('/pano') ? 'page' : undefined}
								class="hover:text-slate-900 {pathname.startsWith('/pano')
									? 'font-semibold text-slate-900 underline underline-offset-4'
									: ''}"
							>
								Pano
							</a>
							<a
								href="/isler"
								aria-current={pathname.startsWith('/isler') ? 'page' : undefined}
								class="hover:text-slate-900 {pathname.startsWith('/isler')
									? 'font-semibold text-slate-900 underline underline-offset-4'
									: ''}"
							>
								İşler
							</a>
							<a
								href="/musteriler"
								aria-current={pathname.startsWith('/musteriler') ? 'page' : undefined}
								class="hover:text-slate-900 {pathname.startsWith('/musteriler')
									? 'font-semibold text-slate-900 underline underline-offset-4'
									: ''}"
							>
								Müşteriler
							</a>
						</nav>
					{/if}
				</div>

				<div class="flex flex-wrap items-center gap-1.5 text-sm sm:gap-2">
					{#if data.user}
						<span class="hidden rounded bg-slate-100 px-2.5 py-1 text-xs text-slate-700 sm:inline">
							{data.user.name}
							<strong class="ml-1 text-[11px] text-slate-600 uppercase">
								({data.user.role === 'admin' ? 'Yönetici' : 'Teknisyen'})
							</strong>
						</span>
					{/if}

					<form
						method="POST"
						action="/giris?/switchRole"
						aria-label="Demo rol geçişi"
						class="flex items-center gap-1"
					>
						{#each data.demoUsers as demoUser (demoUser.id)}
							<button
								type="submit"
								name="userId"
								value={demoUser.id}
								aria-pressed={data.user?.id === demoUser.id}
								class="rounded border px-2 py-1 text-xs font-medium transition sm:px-2.5 {data.user
									?.id === demoUser.id
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
								class="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 sm:px-2.5"
							>
								Çıkış
							</button>
						</form>
					{/if}
				</div>
			</div>
		</header>
	{/if}

	<main id="main-content" class="mx-auto w-full max-w-6xl flex-1 px-3 py-5 sm:px-4 sm:py-6">
		{@render children()}
	</main>
</div>
