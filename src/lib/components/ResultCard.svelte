<script lang="ts">
	import type { SetResult } from '$lib/types';
	import { aggregateSetMaterials, formatSkillPoints, rarityColor } from '$lib/gameData';
	import { t, tr } from '$lib/i18n/i18n.svelte';
	import CharmTableInfo from './CharmTableInfo.svelte';

	let { result, index }: { result: SetResult; index: number } = $props();
	let open = $state(false);
	let cardEl: HTMLElement | null = $state(null);
	let exporting = $state(false);

	async function exportImage() {
		if (!cardEl) return;
		open = true;
		exporting = true;
		const wm = cardEl.querySelector<HTMLElement>('[data-watermark]');
		if (wm) wm.style.display = '';
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		try {
			const { toPng } = await import('html-to-image');
			const dataUrl = await toPng(cardEl, {
				pixelRatio: 2,
				backgroundColor: '#18181b',
				cacheBust: true,
				filter: (node) => !(node instanceof HTMLElement && node.hasAttribute('data-no-export'))
			});
			const a = document.createElement('a');
			a.download = `mhp3-set-${index + 1}.png`;
			a.href = dataUrl;
			a.click();
		} catch (e) {
			console.error(e);
		} finally {
			if (wm) wm.style.display = 'none';
			exporting = false;
		}
	}

	function slotsMarkup(n: number): string {
		return 'O'.repeat(Math.min(n, 3));
	}

	function copyText(): string {
		const lines: string[] = [];
		lines.push(t('copyTextHeader', { n: index + 1, def: result.defenseSumMax }));
		for (const p of result.pieces) {
			lines.push(
				`  ${tr(p.part)}: ${tr(p.name)} [${slotsMarkup(p.slots)}] (R${p.rarity}) ${p.defenseBase}–${p.defenseMax}`
			);
		}
		const c = result.charm;
		lines.push(
			t('copyTextCharm', {
				v: c
					? `${c.name || t('unnamed')} [${slotsMarkup(c.slots)}] ${tr(c.skill1.tree)}${formatSkillPoints(c.skill1.points)}${c.skill2 && c.skill2.tree ? `, ${tr(c.skill2.tree)}${formatSkillPoints(c.skill2.points)}` : ''}`
					: t('copyTextNone')
			})
		);
		lines.push(t('copyTextWeaponSlots', { n: result.weaponSlots }));
		if (result.decorations.length) {
			lines.push(
				t('copyTextDecorations', {
					v: result.decorations.map((d) => `${tr(d.name)} x${d.count}`).join(', ')
				})
			);
		}
		lines.push(t('copyTextSkills', { v: result.activated.map((a) => tr(a.name)).join(', ') }));
		if (result.negativeActivated.length) {
			lines.push(
				t('copyTextNegative', { v: result.negativeActivated.map((a) => tr(a.name)).join(', ') })
			);
		}
		const matLine = materialsMarkup();
		if (matLine) lines.push(t('copyTextMaterials', { v: matLine }));
		return lines.join('\n');
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(copyText());
		} catch {
			/* clipboard unavailable */
		}
	}

	function materialsMarkup(): string {
		return aggregateSetMaterials(
			result.pieces.flatMap((p) => p.materials),
			result.decorations
		)
			.map((m) => `${tr(m.name)} x${m.quantity}`)
			.join(', ');
	}
</script>

<div class="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900" bind:this={cardEl}>
	<div
		data-watermark
		style="display:none"
		class="bg-zinc-950 px-4 py-1 text-center text-[11px] font-medium tracking-wide text-zinc-500"
	>
		mhp3csc.vercel.app
	</div>
	<button
		type="button"
		onclick={() => (open = !open)}
		class="flex w-full flex-col gap-2 px-4 py-3 text-left hover:bg-zinc-800/60"
	>
		<div class="flex items-center gap-2">
			<span class="text-sm font-bold text-amber-400">#{index + 1}</span>
			<div class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
				{#each result.activated as a (a.tree + ':' + a.name)}
					<span
						class="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-medium text-emerald-300"
					>
						{tr(a.name)}
					</span>
				{/each}
				{#each result.negativeActivated as a (a.tree + ':' + a.name)}
					<span class="rounded bg-red-500/15 px-1.5 py-0.5 text-[11px] font-medium text-red-300">
						{tr(a.name)}
					</span>
				{/each}
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
			<span class="text-sm text-zinc-300">{t('def')} {result.defenseSumMax}</span>
			{#if result.charm}
				<span class="min-w-0 flex-1 truncate text-xs text-zinc-500" title={result.charm.name}>
					{result.charm.name || t('charmFallback')} · {result.charm.slots}◯
					{#if result.charm.hypothetical}
						<span class="ml-1 rounded bg-sky-500/15 px-1 text-[10px] text-sky-300"
							>{t('possibleBadge')}</span
						>
					{/if}
				</span>
			{/if}
			<span class="ml-auto text-zinc-500">{open ? '▲' : '▼'}</span>
		</div>
	</button>

	{#if open}
		<div class="border-t border-zinc-800 px-4 py-3">
			<table class="w-full text-sm">
				<thead>
					<tr class="text-left text-[11px] tracking-wide text-zinc-500 uppercase">
						<th class="hidden py-1 sm:table-cell">{t('part')}</th>
						<th class="py-1">{t('piece')}</th>
						<th class="py-1">{t('slots')}</th>
						<th class="py-1 text-right">{t('def')}</th>
						<th class="py-1 text-right">{t('rarity')}</th>
					</tr>
				</thead>
				<tbody>
					{#each result.pieces as p (p.name)}
						<tr class="border-t border-zinc-800/60">
							<td class="hidden py-1 text-zinc-400 sm:table-cell">{tr(p.part)}</td>
							<td class="py-1 text-zinc-100">
								{tr(p.name)}
								{#if p.isTorsoInc}
									<span class="ml-1 rounded bg-violet-500/15 px-1 text-[10px] text-violet-300"
										>{t('torsoUp')}</span
									>
								{/if}
							</td>
							<td class="py-1 text-zinc-400">{slotsMarkup(p.slots) || '—'}</td>
							<td class="py-1 text-right text-zinc-300">
								{p.defenseBase}–{p.defenseMax}
							</td>
							<td class="py-1 text-right" style="color: {rarityColor(p.rarity)}">
								R{p.rarity}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<div class="mt-3 rounded border border-zinc-800 bg-zinc-950/50 p-2 text-xs">
				<span class="text-zinc-500">{t('stats')}</span>
				<div class="mt-1 flex flex-wrap gap-x-5 gap-y-1.5">
					<span class="text-zinc-300">
						🛡 {t('defBase')}
						<span class="text-zinc-100"> {result.defenseSumBase}</span>
					</span>
					<span class="text-zinc-300">
						🛡 {t('defMax')}
						<span class="text-zinc-100"> {result.defenseSumMax}</span>
					</span>
					<span class="text-zinc-300">
						💎 {t('rarity')}
						<span style="color: {rarityColor(result.raritySum)}"> R{result.raritySum}</span>
					</span>
					<span class="text-zinc-300">
						⭐ {t('difficulty')}
						<span class="text-zinc-100"> HR {result.hrSum}</span>
					</span>
				</div>
				<div class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
					{#each [{ label: 'sortFire', icon: '🔥', value: result.resistanceSum.fire }, { label: 'sortWater', icon: '💧', value: result.resistanceSum.water }, { label: 'sortIce', icon: '❄', value: result.resistanceSum.ice }, { label: 'sortThunder', icon: '⚡', value: result.resistanceSum.thunder }, { label: 'sortDragon', icon: '🐉', value: result.resistanceSum.dragon }] as r (r.label)}
						<span class="text-zinc-300">
							{r.icon}
							{t(r.label)}
							<span
								class={r.value > 0
									? 'text-emerald-400'
									: r.value < 0
										? 'text-red-400'
										: 'text-zinc-400'}
							>
								{r.value > 0 ? '+' : ''}{r.value}
							</span>
						</span>
					{/each}
				</div>
			</div>

			<div class="mt-3 grid gap-2 text-xs sm:grid-cols-2">
				{#if result.charm}
					<div class="rounded border border-zinc-800 bg-zinc-950/50 p-2">
						<span class="text-zinc-500">{t('charmLabel')}</span>
						<span class="text-zinc-200">
							{result.charm.name || t('unnamed')} [{slotsMarkup(result.charm.slots)}]
							{tr(result.charm.skill1.tree)}{formatSkillPoints(result.charm.skill1.points)}
							{#if result.charm.skill2 && result.charm.skill2.tree}
								, {tr(result.charm.skill2.tree)}{formatSkillPoints(result.charm.skill2.points)}
							{/if}
						</span>
						{#if result.charm.hypothetical}
							<span class="ml-1 rounded bg-sky-500/15 px-1 text-[10px] text-sky-300"
								>{t('notOwnedPossible')}</span
							>
							<CharmTableInfo charm={result.charm} />
						{/if}
					</div>
				{/if}
				<div class="rounded border border-zinc-800 bg-zinc-950/50 p-2">
					<span class="text-zinc-500">{t('weaponSlotsLabel')}</span>
					<span class="text-zinc-200">{result.weaponSlots}◯</span>
					<span class="ml-3 text-zinc-500">{t('used')}</span>
					<span class="text-zinc-200">{result.usedSlots}/{result.totalSlots}◯</span>
				</div>
			</div>

			{#if result.decorations.length}
				<div class="mt-2 rounded border border-zinc-800 bg-zinc-950/50 p-2 text-xs">
					<span class="text-zinc-500">{t('decorationsLabel')}</span>
					<span class="ml-1 text-zinc-200">
						{#each result.decorations as d (d.name)}
							<span class="mr-2 inline-block">
								{tr(d.name)} <span class="text-amber-400">x{d.count}</span>
							</span>
						{/each}
					</span>
				</div>
			{/if}

			<div class="mt-2 rounded border border-zinc-800 bg-zinc-950/50 p-2 text-xs">
				<span class="text-zinc-500">{t('skillPoints')}</span>
				<div class="mt-1 flex flex-wrap gap-x-4 gap-y-1">
					{#each result.treePoints as tp (tp.tree)}
						<span class="text-zinc-300">
							{tr(tp.tree)}
							<span class={tp.points >= 0 ? 'text-emerald-400' : 'text-red-400'}
								>{tp.points >= 0 ? '+' : ''}{tp.points}</span
							>
						</span>
					{/each}
				</div>
			</div>

			{#if materialsMarkup()}
				<div class="mt-2 rounded border border-zinc-800 bg-zinc-950/50 p-2 text-xs">
					<span class="text-zinc-500">{t('materials')}</span>
					<div class="mt-1 flex flex-wrap gap-x-4 gap-y-1">
						{#each aggregateSetMaterials( result.pieces.flatMap((p) => p.materials), result.decorations ) as m (m.name)}
							<span class="text-zinc-300">
								{tr(m.name)}
								<span class="text-amber-400">x{m.quantity}</span>
							</span>
						{/each}
					</div>
				</div>
			{/if}

			<div class="mt-3 flex gap-2" data-no-export>
				<button
					type="button"
					onclick={copy}
					class="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:border-amber-500 hover:text-amber-300"
				>
					{t('copySet')}
				</button>
				<button
					type="button"
					onclick={exportImage}
					disabled={exporting}
					title={t('exportImageTitle')}
					aria-label={t('exportImageTitle')}
					class="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:border-amber-500 hover:text-amber-300"
				>
					{exporting ? '…' : t('exportImage')}
				</button>
			</div>
		</div>
	{/if}
</div>
