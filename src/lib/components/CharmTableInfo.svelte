<script lang="ts">
	import { CHARM_TABLE_COUNT, charmProfileTables } from '$lib/mh3/charmTables';
	import { t } from '$lib/i18n/i18n.svelte';

	let {
		charm
	}: {
		charm: {
			skill1: { tree: string; points: number };
			skill2: { tree: string; points: number } | null;
			slots: number;
		};
	} = $props();

	let open = $state(false);
	let btnEl: HTMLButtonElement | null = $state(null);

	const tables = $derived(charmProfileTables(charm));

	// Rendered into <body> so the card's overflow-hidden can't clip it.
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return { destroy: () => node.remove() };
	}

	function floating(node: HTMLElement, trigger: HTMLButtonElement | null) {
		if (!trigger) return {};

		const pad = 8;

		function position() {
			if (!trigger) return;
			const rect = trigger.getBoundingClientRect();
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			node.style.left = '0px';
			node.style.top = '0px';
			node.style.visibility = 'hidden';
			const w = node.offsetWidth;
			const h = node.offsetHeight;
			node.style.visibility = '';

			let left = Math.max(pad, Math.min(rect.right - w, vw - w - pad));
			let top = rect.bottom + 6;
			if (top + h > vh - pad && rect.top - h - 6 >= pad) top = rect.top - h - 6;
			top = Math.max(pad, top);

			node.style.left = `${left}px`;
			node.style.top = `${top}px`;
		}

		function onPointerDown(e: PointerEvent) {
			if (!node.contains(e.target as Node) && !trigger?.contains(e.target as Node)) open = false;
		}

		function onKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') open = false;
		}

		position();
		window.addEventListener('resize', position);
		window.addEventListener('scroll', position, true);
		document.addEventListener('pointerdown', onPointerDown, true);
		document.addEventListener('keydown', onKeyDown);

		return {
			update(newTrigger: HTMLButtonElement | null) {
				trigger = newTrigger;
				position();
			},
			destroy() {
				window.removeEventListener('resize', position);
				window.removeEventListener('scroll', position, true);
				document.removeEventListener('pointerdown', onPointerDown, true);
				document.removeEventListener('keydown', onKeyDown);
			}
		};
	}
</script>

<button
	bind:this={btnEl}
	type="button"
	aria-label={t('tablesAria')}
	aria-expanded={open}
	onclick={() => (open = !open)}
	class="inline-flex align-middle text-sky-400/80 transition-colors hover:text-sky-300"
>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="h-3.5 w-3.5"
	>
		<circle cx="12" cy="12" r="10"></circle>
		<line x1="12" y1="16" x2="12" y2="12"></line>
		<line x1="12" y1="8" x2="12.01" y2="8"></line>
	</svg>
</button>

{#if open}
	<div
		use:portal
		use:floating={btnEl}
		class="fixed z-50 w-60 rounded border border-zinc-700 bg-zinc-900 p-2 text-left text-xs shadow-xl"
	>
		<p class="text-[10px] font-semibold tracking-wide text-zinc-400 uppercase">
			{t('charmTables')}
		</p>
		{#if tables === null}
			<p class="mt-1 text-[11px] text-zinc-400">
				{t('notInTables')}
			</p>
		{:else if tables.length === CHARM_TABLE_COUNT}
			<p class="mt-1 text-[11px] text-zinc-300">
				{t('anyTable', { n: CHARM_TABLE_COUNT })}
			</p>
		{:else}
			<p class="mt-1 text-[11px] text-zinc-300">
				{t('onlyTables')}
				<span class="font-medium text-sky-300">{tables.join(', ')}</span>
			</p>
		{/if}
		<p class="mt-1.5 text-[10px] leading-snug text-zinc-500">
			{t('randomTableNote')}
		</p>
	</div>
{/if}
