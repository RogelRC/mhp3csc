<script lang="ts">
	import type { Charm } from '$lib/types';
	import { SKILL_TREE_NAMES } from '$lib/gameData';
	import { t, tr } from '$lib/i18n/i18n.svelte';

	let { charm, onremove }: { charm: Charm; onremove: () => void } = $props();

	function setPoints(slot: { tree: string; points: number }, value: string) {
		const n = Number.parseInt(value, 10);
		if (Number.isNaN(n)) {
			slot.points = 0;
		} else {
			slot.points = Math.max(-10, Math.min(15, n));
		}
	}
</script>

<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
	<div class="flex items-center gap-2">
		<label class="flex cursor-pointer items-center gap-1.5 text-sm">
			<input type="checkbox" bind:checked={charm.included} class="accent-amber-500" />
			<span>{t('useInSearch')}</span>
		</label>
		<input
			type="text"
			placeholder={t('charmNamePlaceholder')}
			bind:value={charm.name}
			class="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
		/>
		<button
			type="button"
			onclick={onremove}
			class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-red-700 hover:text-red-400"
			aria-label={t('removeCharmAria')}
		>
			{t('removeCharm')}
		</button>
	</div>

	<div class="mt-2 flex flex-wrap items-center gap-3 text-sm">
		<div class="flex items-center gap-1">
			<span class="text-xs text-zinc-400">{t('slotsLabel')}</span>
			{#each [0, 1, 2, 3] as n (n)}
				<button
					type="button"
					onclick={() => (charm.slots = n)}
					class="h-7 w-7 rounded border text-xs font-semibold transition-colors
						{n === charm.slots
						? 'border-amber-500 bg-amber-500/20 text-amber-300'
						: 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500'}"
				>
					{n}
				</button>
			{/each}
		</div>

		<div class="flex items-center gap-1">
			<select
				bind:value={charm.skill1.tree}
				class="max-w-full rounded border border-zinc-700 bg-zinc-800 px-1 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
			>
				<option value="">{t('skill1')}</option>
				{#each SKILL_TREE_NAMES as tree (tree)}
					<option value={tree}>{tr(tree)}</option>
				{/each}
			</select>
			<input
				type="number"
				value={charm.skill1.points}
				oninput={(e) => setPoints(charm.skill1, e.currentTarget.value)}
				class="w-14 rounded border border-zinc-700 bg-zinc-800 px-1 py-1 text-center text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
			/>
		</div>

		{#if charm.skill2}
			{@const second = charm.skill2}
			<div class="flex items-center gap-1">
				<select
					bind:value={second.tree}
					class="max-w-full rounded border border-zinc-700 bg-zinc-800 px-1 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
				>
					<option value="">{t('skill2')}</option>
					{#each SKILL_TREE_NAMES as tree (tree)}
						<option value={tree}>{tr(tree)}</option>
					{/each}
				</select>
				<input
					type="number"
					value={second.points}
					oninput={(e) => setPoints(second, e.currentTarget.value)}
					class="w-14 rounded border border-zinc-700 bg-zinc-800 px-1 py-1 text-center text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
				/>
				<button
					type="button"
					onclick={() => (charm.skill2 = null)}
					class="rounded border border-zinc-700 px-1.5 py-1 text-xs text-zinc-400 hover:border-red-700 hover:text-red-400"
					aria-label={t('removeSecondSkillAria')}
				>
					✕
				</button>
			</div>
		{:else}
			<button
				type="button"
				onclick={() => (charm.skill2 = { tree: '', points: 0 })}
				class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
			>
				{t('secondSkill')}
			</button>
		{/if}
	</div>
</div>
