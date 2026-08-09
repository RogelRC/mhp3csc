<script lang="ts">
	import CharmCard from '$lib/components/CharmCard.svelte';
	import ResultCard from '$lib/components/ResultCard.svelte';
	import {
		armors,
		decorations,
		positiveSkillsByTree,
		SKILL_CATEGORIES,
		treeCategory
	} from '$lib/gameData';
	import { runSearch } from '$lib/search';
	import type { PossibleCharmMode } from '$lib/search';
	import { decryptSaveFile } from '$lib/mh3/saveCipher';
	import { parseCharmEntries } from '$lib/mh3/charmParser';
	import { charmSkillTree } from '$lib/mh3/skillTable';
	import type { Charm, SearchProgress, SearchSettings, SetResult, SkillTarget } from '$lib/types';

	let targetSkills = $state<SkillTarget[]>([]);
	let charms = $state<Charm[]>([]);
	let showCharms = $state(true);
	let includeNoCharm = $state(false);
	let possibleMode = $state<PossibleCharmMode | ''>('');
	let settings = $state<SearchSettings>({
		weaponSlots: 3,
		gender: 'Any',
		hunterType: 'Blademaster',
		maxRarity: null,
		maxHr: null,
		maxVillageStars: null
	});

	let showSkillPicker = $state(false);
	let skillQuery = $state('');
	let skillCategory = $state<string>('All');

	let searching = $state(false);
	let searched = $state(false);
	let searchTime = $state(0);
	let message = $state('');
	let results = $state<SetResult[]>([]);
	let progress = $state<SearchProgress>({ phase: '', nodes: 0, found: 0, done: false });
	let controller: AbortController | null = null;

	const LS = {
		targets: 'mhp3csc:targets',
		charms: 'mhp3csc:charms',
		showcharms: 'mhp3csc:showcharms',
		settings: 'mhp3csc:settings',
		nocharm: 'mhp3csc:nocharm',
		possiblemode: 'mhp3csc:possiblemode'
	};

	function readLS<T>(key: string): T | null {
		try {
			const raw = localStorage.getItem(key);
			return raw ? (JSON.parse(raw) as T) : null;
		} catch {
			return null;
		}
	}

	function writeLS(key: string, value: unknown) {
		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch {
			/* storage unavailable */
		}
	}

	let hydrated = false;
	$effect(() => {
		if (typeof window === 'undefined') return;
		if (!hydrated) {
			hydrated = true;
			const t = readLS<SkillTarget[]>(LS.targets);
			if (t && Array.isArray(t)) targetSkills = t;
			const c = readLS<Charm[]>(LS.charms);
			if (c && Array.isArray(c)) charms = c;
			const sc = readLS<boolean>(LS.showcharms);
			showCharms = sc ?? charms.length <= 60;
			const s = readLS<Partial<SearchSettings>>(LS.settings);
			if (s) settings = { ...settings, ...s };
			const nc = readLS<boolean>(LS.nocharm);
			if (nc != null) includeNoCharm = nc;
			const pm = readLS<PossibleCharmMode | ''>(LS.possiblemode);
			if (pm) possibleMode = pm;
			return;
		}
		writeLS(LS.targets, targetSkills);
		writeLS(LS.charms, charms);
		writeLS(LS.showcharms, showCharms);
		writeLS(LS.settings, settings);
		writeLS(LS.nocharm, includeNoCharm);
		writeLS(LS.possiblemode, possibleMode);
	});

	const filteredTrees = $derived(
		positiveSkillsByTree
			.map((g) => ({
				tree: g.tree,
				skills: g.skills.filter(
					(s) =>
						(!skillCategory || skillCategory === 'All' || treeCategory(g.tree) === skillCategory) &&
						(!skillQuery ||
							g.tree.toLowerCase().includes(skillQuery.toLowerCase()) ||
							s.name.toLowerCase().includes(skillQuery.toLowerCase()))
				)
			}))
			.filter((g) => g.skills.length > 0)
	);

	function addSkill(s: { name: string; tree: string; points: number }) {
		const idx = targetSkills.findIndex((t) => t.tree === s.tree);
		if (idx >= 0) {
			if (targetSkills[idx].points === s.points) return;
			targetSkills[idx] = { name: s.name, tree: s.tree, points: s.points };
		} else {
			if (targetSkills.length >= 8) return;
			targetSkills = [...targetSkills, { name: s.name, tree: s.tree, points: s.points }];
		}
	}

	function removeTarget(tree: string) {
		targetSkills = targetSkills.filter((t) => t.tree !== tree);
	}

	function addCharm() {
		charms = [
			...charms,
			{
				id: crypto.randomUUID(),
				name: '',
				slots: 0,
				skill1: { tree: '', points: 0 },
				skill2: null,
				included: true
			}
		];
	}

	function removeCharm(id: string) {
		charms = charms.filter((c) => c.id !== id);
	}

	function removeAllCharms() {
		charms = [];
	}

	let importNote = $state('');
	let importFailed = $state(false);

	async function importSave(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		try {
			const plain = decryptSaveFile(new Uint8Array(await file.arrayBuffer()));
			const parsed = parseCharmEntries(plain);
			if (parsed.length === 0) {
				importNote = 'No charms found in that save.';
				importFailed = true;
				return;
			}
			const imported: Charm[] = parsed.map((p) => {
				const has1 = p.skill1Code !== 0;
				const has2 = p.skill2Code !== 0;
				return {
					id: crypto.randomUUID(),
					name: '',
					slots: p.slots,
					skill1: {
						tree: has1 ? (charmSkillTree(p.skill1Code) ?? '') : '',
						points: has1 ? p.skill1Points : 0
					},
					skill2: has2
						? { tree: charmSkillTree(p.skill2Code) ?? '', points: p.skill2Points }
						: null,
					included: true
				};
			});
			charms = [...charms, ...imported];
			showCharms = charms.length <= 60;
			importNote = `Imported ${imported.length} charm${imported.length === 1 ? '' : 's'} from ${file.name}.`;
			importFailed = false;
		} catch (err) {
			console.error(err);
			importNote = 'Could not read that file. It may not be a valid MHP3rd Save.BIN.';
			importFailed = true;
		}
	}

	async function doSearch() {
		if (targetSkills.length === 0) {
			message = 'Select at least one target skill.';
			return;
		}
		if (!includeNoCharm && !possibleMode && !charms.some((c) => c.included)) {
			message = 'Add at least one charm, or enable "no charm" or "possible charm" sets.';
			return;
		}
		message = '';
		controller = new AbortController();
		searching = true;
		searched = true;
		results = [];
		searchTime = 0;
		progress = { phase: 'Starting…', nodes: 0, found: 0, done: false };
		const t0 = performance.now();
		try {
			const found = await runSearch(
				{
					targets: targetSkills,
					charms: charms.map((c) => ({
						...c,
						skill1: { ...c.skill1 },
						skill2: c.skill2 ? { ...c.skill2 } : null
					})),
					possibleCharms: possibleMode || undefined,
					includeNoCharm,
					settings: {
						...settings,
						maxRarity: settings.maxRarity ?? null,
						maxHr: settings.maxHr ?? null,
						maxVillageStars: settings.maxVillageStars ?? null
					},
					maxResults: 400,
					onResult: (res) => {
						results = [...results, res];
					}
				},
				{ armors, decorations },
				(p) => {
					progress = p;
				},
				controller.signal
			);
			results = found;
		} catch (e) {
			console.error(e);
			message = 'Search failed.';
		} finally {
			searching = false;
			searchTime = performance.now() - t0;
			if (progress.phase.includes('combination limit')) {
				message =
					'Too many combinations to check exhaustively. Showing best found so far — try loosening your skills or adding a stronger charm.';
			}
		}
	}

	function stopSearch() {
		controller?.abort();
	}
</script>

<svelte:head>
	<title>MHP3 Armor Set Search</title>
	<meta
		name="description"
		content="Armor set search for Monster Hunter Portable 3rd — find sets that activate your chosen skills."
	/>
</svelte:head>

<div class="min-h-screen overflow-x-clip bg-zinc-950 text-zinc-100">
	<header class="border-b border-zinc-800 bg-zinc-900/60">
		<div class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4">
			<div
				class="flex aspect-square h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-xl text-amber-400"
			>
				⚔
			</div>
			<div>
				<h1 class="text-lg font-bold tracking-tight text-zinc-50">MHP3 Armor Set Search</h1>
				<p class="text-xs text-zinc-400">
					A set searcher for Monster Hunter Portable 3rd (Athena's-style), driven by data from
					Athena's ASS.
				</p>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-7xl px-4 py-6">
		<div class="grid gap-6 lg:grid-cols-[400px_1fr]">
			<aside class="min-w-0 space-y-5">
				<section class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
					<h2 class="mb-3 text-sm font-semibold tracking-wide text-zinc-300 uppercase">
						Target skills
					</h2>

					{#if targetSkills.length === 0}
						<p class="mb-3 text-xs text-zinc-500">
							No skills selected. Pick the skills you want your set to activate.
						</p>
					{:else}
						<div class="mb-3 flex flex-wrap gap-1.5">
							{#each targetSkills as t (t.tree)}
								<button
									type="button"
									onclick={() => removeTarget(t.tree)}
									title="Remove"
									class="group flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-200 hover:border-red-500 hover:text-red-300"
								>
									{t.name}
									<span class="text-amber-400/70 group-hover:text-red-400">✕</span>
								</button>
							{/each}
						</div>
					{/if}

					<button
						type="button"
						onclick={() => (showSkillPicker = !showSkillPicker)}
						class="mb-2 w-full rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-500 hover:text-amber-300"
					>
						{showSkillPicker ? 'Close skill list' : 'Add skills…'}
					</button>

					{#if showSkillPicker}
						<div class="mb-2 flex flex-wrap gap-2">
							<input
								type="text"
								placeholder="Search skills…"
								bind:value={skillQuery}
								class="min-w-0 flex-1 basis-40 rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
							/>
							<select
								bind:value={skillCategory}
								class="max-w-full rounded border border-zinc-700 bg-zinc-800 px-1.5 py-1.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
								title="Skill category"
							>
								<option value="All">All</option>
								{#each SKILL_CATEGORIES as cat (cat)}
									<option value={cat}>{cat}</option>
								{/each}
							</select>
						</div>
						<div class="max-h-72 overflow-y-auto pr-1">
							{#each filteredTrees as g (g.tree)}
								<div class="mb-2">
									<div class="mb-1 text-[11px] font-semibold text-zinc-500 uppercase">{g.tree}</div>
									<div class="space-y-0.5">
										{#each g.skills as s (g.tree + s.points)}
											{@const selected = targetSkills.find((t) => t.tree === g.tree)}
											<button
												type="button"
												onclick={() => addSkill({ name: s.name, tree: g.tree, points: s.points })}
												class="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs text-zinc-300 hover:bg-zinc-800
													{selected?.points === s.points ? 'bg-amber-500/10 text-amber-200' : ''}"
											>
												<span>{s.name}</span>
												<span class="text-zinc-500">+{s.points}</span>
											</button>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</section>

				<section class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
					<div class="mb-3 flex items-center justify-between">
						<h2 class="text-sm font-semibold tracking-wide text-zinc-300 uppercase">Charms</h2>
						<div class="flex items-center gap-2">
							{#if charms.length > 0}
								<button
									type="button"
									onclick={() => (showCharms = !showCharms)}
									class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-amber-500 hover:text-amber-300"
								>
									{showCharms ? 'Hide list' : 'Show list'} ({charms.length})
								</button>
							{/if}
							<button
								type="button"
								onclick={addCharm}
								class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-amber-500 hover:text-amber-300"
							>
								+ Add charm
							</button>
							{#if charms.length > 0}
								<button
									type="button"
									onclick={removeAllCharms}
									class="rounded border border-red-900 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
								>
									Remove all
								</button>
							{/if}
						</div>
					</div>

					<p class="mb-3 text-xs text-zinc-500">
						Enter the charms you own. The search will build sets using one of them.
					</p>

					<label
						class="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-amber-500 hover:text-amber-300"
					>
						<input
							type="file"
							accept=".bin,.BIN,application/octet-stream"
							class="hidden"
							onchange={importSave}
						/>
						Import charms from a MHP3rd Save.BIN
					</label>

					{#if importNote}
						<p class="mb-3 text-xs {importFailed ? 'text-red-400' : 'text-emerald-400'}">
							{importNote}
						</p>
					{/if}

					{#if charms.length > 0 && !showCharms}
						<p class="mb-3 text-xs text-zinc-500">
							{charms.length} charm{charms.length === 1 ? '' : 's'} hidden. Use “Show list” above to review
							them.
						</p>
					{/if}

					{#if showCharms}
						<div class="space-y-2">
							{#each charms as c (c.id)}
								<CharmCard charm={c} onremove={() => removeCharm(c.id)} />
							{/each}
						</div>
					{/if}

					<label class="mt-3 flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
						<input type="checkbox" bind:checked={includeNoCharm} class="accent-amber-500" />
						<span>Also search sets without a charm</span>
					</label>

					<div class="mt-4">
						<span class="mb-1 block text-xs text-zinc-400">Possible charms</span>
						<div class="flex overflow-hidden rounded border border-zinc-700">
							{#each [{ v: '', l: 'Off' }, { v: 'oneSkill', l: '1 skill' }, { v: 'twoSkills', l: '2 skills' }, { v: 'slotted', l: 'Slotted' }] as o (o.v)}
								<button
									type="button"
									onclick={() => (possibleMode = o.v as PossibleCharmMode | '')}
									class="flex-1 px-2 py-1.5 text-xs transition-colors
										{possibleMode === o.v ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:bg-zinc-800'}"
								>
									{o.l}
								</button>
							{/each}
						</div>
						<p class="mt-1 text-[11px] text-zinc-500">
							Adds real charms from MHP3rd's official charm tables, so results tell you which charm
							each set needs — even ones you don't own yet.
						</p>
					</div>
				</section>

				<section class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
					<h2 class="mb-3 text-sm font-semibold tracking-wide text-zinc-300 uppercase">Options</h2>

					<div class="space-y-4 text-sm">
						<div>
							<span class="mb-1 block text-xs text-zinc-400">Weapon slots</span>
							<div class="flex overflow-hidden rounded border border-zinc-700">
								{#each [0, 1, 2, 3] as n (n)}
									<button
										type="button"
										onclick={() => (settings.weaponSlots = n)}
										class="flex-1 px-3 py-1.5 text-xs transition-colors
											{n === settings.weaponSlots ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:bg-zinc-800'}"
									>
										{n}◯
									</button>
								{/each}
							</div>
						</div>

						<div>
							<span class="mb-1 block text-xs text-zinc-400">Gender</span>
							<div class="flex overflow-hidden rounded border border-zinc-700">
								{#each [{ v: 'Any', l: 'Any' }, { v: 'Male', l: 'Male' }, { v: 'Female', l: 'Female' }] as o (o.v)}
									<button
										type="button"
										onclick={() => (settings.gender = o.v as SearchSettings['gender'])}
										class="flex-1 px-3 py-1.5 text-xs transition-colors
											{settings.gender === o.v ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:bg-zinc-800'}"
									>
										{o.l}
									</button>
								{/each}
							</div>
						</div>

						<div>
							<span class="mb-1 block text-xs text-zinc-400">Hunter type</span>
							<div class="flex overflow-hidden rounded border border-zinc-700">
								{#each [{ v: 'Blademaster', l: 'Blademaster' }, { v: 'Gunner', l: 'Gunner' }] as o (o.v)}
									<button
										type="button"
										onclick={() => (settings.hunterType = o.v as SearchSettings['hunterType'])}
										class="flex-1 px-3 py-1.5 text-xs transition-colors
											{settings.hunterType === o.v
											? 'bg-amber-500/20 text-amber-300'
											: 'text-zinc-400 hover:bg-zinc-800'}"
									>
										{o.l}
									</button>
								{/each}
							</div>
						</div>

						<div class="flex gap-4">
							<div class="flex-1">
								<span class="mb-1 block text-xs text-zinc-400">Max rarity</span>
								<select
									bind:value={settings.maxRarity}
									class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
								>
									<option value={null}>Any</option>
									{#each [1, 2, 3, 4, 5, 6, 7] as r (r)}
										<option value={r}>{r}</option>
									{/each}
								</select>
							</div>
							<div class="flex-1">
								<span class="mb-1 block text-xs text-zinc-400">Max HR req</span>
								<select
									bind:value={settings.maxHr}
									class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
								>
									<option value={null}>Any</option>
									{#each [1, 2, 3, 4, 5, 6] as r (r)}
										<option value={r}>{r}</option>
									{/each}
								</select>
							</div>
						</div>
						<div>
							<span class="mb-1 block text-xs text-zinc-400">Village quest progress</span>
							<select
								bind:value={settings.maxVillageStars}
								class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
							>
								<option value={null}>Any</option>
								{#each [1, 2, 3, 4, 5, 6] as r (r)}
									<option value={r}>{r}★</option>
								{/each}
							</select>
							<p class="mt-1 text-[11px] text-zinc-500">
								Armors obtainable via this village quest rank are always included; guild-exclusive
								sets still require their HR.
							</p>
						</div>
					</div>
				</section>

				<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
					<button
						type="button"
						onclick={doSearch}
						disabled={searching}
						class="w-full rounded bg-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{searching ? 'Searching…' : 'Search sets'}
					</button>

					{#if searching}
						<div class="mt-3">
							<div class="mb-1 flex items-center justify-between text-xs text-zinc-400">
								<span>{progress.phase}</span>
								<span>{results.length} found</span>
							</div>
							<div class="h-1.5 overflow-hidden rounded bg-zinc-800">
								<div
									class="h-full bg-amber-500 transition-all"
									style="width: {Math.min(100, progress.nodes / 400000) * 100}%"
								></div>
							</div>
							<button
								type="button"
								onclick={stopSearch}
								class="mt-2 w-full rounded border border-red-800 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10"
							>
								Stop
							</button>
						</div>
					{/if}

					{#if message}
						<p
							class="mt-3 rounded border border-red-800 bg-red-500/10 px-3 py-2 text-xs text-red-300"
						>
							{message}
						</p>
					{/if}
				</div>
			</aside>

			<section class="min-w-0">
				<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
					<h2 class="text-sm font-semibold tracking-wide text-zinc-300 uppercase">Results</h2>
					{#if searched}
						<span class="text-xs text-zinc-500">
							{results.length} set{results.length === 1 ? '' : 's'}
							{#if !searching && searchTime > 0}
								· {Math.round(searchTime)}ms
							{/if}
							{#if searching}
								· searching…
							{/if}
						</span>
					{/if}
				</div>

				{#if !searched}
					<div
						class="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-600"
					>
						Configure your skills and charms, then run a search.
					</div>
				{:else if results.length > 0}
					<div class="space-y-2">
						{#each results as r, i (i)}
							<ResultCard result={r} index={i} />
						{/each}
					</div>
				{:else if !searching}
					<div
						class="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-500"
					>
						No sets found. Try loosening your requirements (fewer skills, more charm points, or
						allow higher rarity armor).
					</div>
				{:else}
					<div
						class="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-600"
					>
						Searching…
					</div>
				{/if}
			</section>
		</div>
	</main>

	<footer class="border-t border-zinc-800 py-4 text-center text-xs text-zinc-600">
		Data extracted from Athena's ASS for Monster Hunter Portable 3rd. Not affiliated with Capcom.
	</footer>
</div>
