<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { inject } from '@vercel/analytics';
	import { onMount } from 'svelte';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { t } from '$lib/i18n/i18n.svelte';

	let { children } = $props();

	onMount(() => {
		inject();
	});

	injectSpeedInsights();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}

<footer class="bg-zinc-950 pt-2 pb-6">
	<div class="mx-auto w-full max-w-4xl px-4">
		<p class="text-center text-xs text-zinc-500">
			<span class="mr-1">{t('foundBug')}</span>
			<a
				href="https://discord.com/users/1136464673479340203"
				target="_blank"
				rel="noopener noreferrer"
				class="text-amber-400 hover:text-amber-300 hover:underline"
			>
				{t('reportOnDiscord')}
			</a>
		</p>
		<p class="mt-1 text-center text-xs text-zinc-500">
			<span class="mr-1">{t('enjoyProject')}</span>
			<a
				href="https://github.com/RogelRC/mhp3csc"
				target="_blank"
				rel="noopener noreferrer"
				class="text-amber-400 hover:text-amber-300 hover:underline"
			>
				{t('starOnGitHub')}
			</a>
		</p>
		<p class="mt-1 text-center text-xs text-zinc-500">
			<span class="mr-1">{t('downloadLatest')}</span>
			<a
				href="https://github.com/RogelRC/mhp3csc/releases/latest"
				target="_blank"
				rel="noopener noreferrer"
				class="text-amber-400 hover:text-amber-300 hover:underline"
			>
				{t('goToReleases')}
			</a>
		</p>
		<p class="mt-4 text-center text-xs text-zinc-500">{t('youMayAlsoLike')}</p>
		<p class="mt-1 text-center text-xs text-zinc-500">
			<a
				href="https://mhfucsc.vercel.app/"
				target="_blank"
				rel="noopener noreferrer"
				class="text-amber-400 hover:text-amber-300 hover:underline"
			>
				{t('mhfuLink')}
			</a>
		</p>
	</div>
</footer>
