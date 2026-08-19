<script lang="ts">
	import CharmCard from '$lib/components/CharmCard.svelte';
	import ResultCard from '$lib/components/ResultCard.svelte';
	import {
		armors,
		decorations,
		positiveSkillsByTree,
		negativeSkillsByTree,
		SKILL_CATEGORIES,
		treeCategory,
		formatSkillPoints
	} from '$lib/gameData';
	import { runSearch } from '$lib/search';
	import type { PossibleCharmMode } from '$lib/search';
	import { decryptSaveFile } from '$lib/mh3/saveCipher';
	import { parseCharmEntries } from '$lib/mh3/charmParser';
	import { charmNameForRarity } from '$lib/mh3/charmTable';
	import { charmSkillTree } from '$lib/mh3/skillTable';
	import type {
		ArmorPart,
		Charm,
		SearchProgress,
		SearchSettings,
		SetResult,
		SkillTarget
	} from '$lib/types';

	interface SearchHistoryEntry {
		id: string;
		ts: number;
		when: string;
		label: string;
		key: string;
		targets: SkillTarget[];
		charms: Charm[];
		includeNoCharm: boolean;
		possibleMode: PossibleCharmMode | '';
		settings: SearchSettings;
		showCharms: boolean;
	}

	const POSSIBLE_LABELS: Record<PossibleCharmMode, string> = {
		oneSkill: '1 skill',
		twoSkills: '2 skills',
		slotted: 'slotted'
	};

	let targetSkills = $state<SkillTarget[]>([]);
	let charms = $state<Charm[]>([]);
	let showCharms = $state(true);
	let history = $state<SearchHistoryEntry[]>([]);
	let showHistory = $state(false);
	let includeNoCharm = $state(false);
	let possibleMode = $state<PossibleCharmMode | ''>('');
	let settings = $state<SearchSettings>({
		weaponSlots: 3,
		gender: 'Any',
		hunterType: 'Blademaster',
		maxRarity: null,
		maxHr: null,
		maxVillageStars: null,
		allowPiercings: true
	});

	let showSkillPicker = $state(false);
	let skillQuery = $state('');
	let skillCategory = $state<string>('All');
	let negativeMode = $state(false);
	let swordClickCount = $state(0);
	let swordClickTimer = $state<ReturnType<typeof setTimeout> | null>(null);

	let searching = $state(false);
	let searched = $state(false);
	let searchTime = $state(0);
	let toast = $state('');

	function showToast(msg: string) {
		toast = msg;
	}

	function onSwordClick() {
		if (swordClickTimer) clearTimeout(swordClickTimer);
		swordClickCount++;
		swordClickTimer = setTimeout(() => {
			swordClickCount = 0;
		}, 2000);
		if (swordClickCount >= 10) {
			negativeMode = !negativeMode;
			swordClickCount = 0;
			showToast(
				negativeMode ? 'Negative skill mode activated ⚔' : 'Negative skill mode deactivated'
			);
		}
	}
	let results = $state<SetResult[]>([]);
	let progress = $state<SearchProgress>({ phase: '', nodes: 0, found: 0, done: false });
	let controller: AbortController | null = null;

	let formDirty = $state(false);
	let formBaseline = formSnapshot();
	$effect(() => {
		if (formSnapshot() !== formBaseline) formDirty = true;
	});

	function formSnapshot(): string {
		return JSON.stringify({
			targets: targetSkills,
			charms,
			showCharms,
			includeNoCharm,
			possibleMode,
			settings
		});
	}

	let hideNegative = $state(false);
	let showAdvanced = $state(false);
	let excludedPieces = $state<Set<string>>(new Set());
	let excludedDecos = $state<Set<string>>(new Set());
	let sortBy = $state<
		| 'defenseMax'
		| 'defenseBase'
		| 'fire'
		| 'water'
		| 'ice'
		| 'thunder'
		| 'dragon'
		| 'difficulty'
		| 'rarity'
		| 'slotsLeft'
	>('defenseMax');
	let charmFilterId = $state('__all');
	let sortDir = $state<'asc' | 'desc'>('desc');

	const SORT_OPTIONS: { key: typeof sortBy; label: string }[] = [
		{ key: 'defenseMax', label: 'Def max' },
		{ key: 'defenseBase', label: 'Def base' },
		{ key: 'fire', label: 'Fire' },
		{ key: 'water', label: 'Water' },
		{ key: 'ice', label: 'Ice' },
		{ key: 'thunder', label: 'Thunder' },
		{ key: 'dragon', label: 'Dragon' },
		{ key: 'difficulty', label: 'Difficulty' },
		{ key: 'rarity', label: 'Rarity' },
		{ key: 'slotsLeft', label: 'Empty slots' }
	];

	const SORT_ICONS: Record<typeof sortBy, string> = {
		defenseMax: '🛡',
		defenseBase: '🛡',
		fire: '🔥',
		water: '💧',
		ice: '❄',
		thunder: '⚡',
		dragon: '🐉',
		difficulty: '⭐',
		rarity: '💎',
		slotsLeft: '◯'
	};

	function sortValue(r: SetResult): number {
		switch (sortBy) {
			case 'defenseBase':
				return r.defenseSumBase;
			case 'fire':
				return r.resistanceSum.fire;
			case 'water':
				return r.resistanceSum.water;
			case 'ice':
				return r.resistanceSum.ice;
			case 'thunder':
				return r.resistanceSum.thunder;
			case 'dragon':
				return r.resistanceSum.dragon;
			case 'difficulty':
				return r.hrSum;
			case 'rarity':
				return r.raritySum;
			case 'slotsLeft':
				return r.slotsLeft;
			default:
				return r.defenseSumMax;
		}
	}

	const charmFilterOptions = $derived.by(() => {
		const seen: Record<string, string> = {};
		for (const r of results) {
			if (!r.charm) continue;
			const id = r.charm.id;
			if (!(id in seen)) seen[id] = charmLabel(r.charm);
		}
		return Object.entries(seen);
	});

	function charmLabel(c: NonNullable<SetResult['charm']>): string {
		const skills =
			`${c.skill1.tree}${formatSkillPoints(c.skill1.points)}` +
			(c.skill2 && c.skill2.tree ? `, ${c.skill2.tree}${formatSkillPoints(c.skill2.points)}` : '');
		return `${c.name || '(unnamed)'} [${c.slots}◯] ${skills}`;
	}

	const displayResults = $derived.by(() => {
		let list = results;
		if (hideNegative) list = list.filter((r) => r.negativeActivated.length === 0);
		if (charmFilterId === '__none') {
			list = list.filter((r) => r.charm === null);
		} else if (charmFilterId !== '__all') {
			list = list.filter((r) => r.charm?.id === charmFilterId);
		}
		if (excludedPieces.size > 0) {
			list = list.filter((r) => !r.pieces.some((p) => excludedPieces.has(`${p.part}:${p.name}`)));
		}
		if (excludedDecos.size > 0) {
			list = list.filter((r) => !r.decorations.some((d) => excludedDecos.has(d.name)));
		}
		const withIdx = list.map((r, i) => ({ r, i }));
		withIdx.sort((a, b) => {
			const va = sortValue(a.r);
			const vb = sortValue(b.r);
			if (va !== vb) return sortDir === 'desc' ? vb - va : va - vb;
			return a.i - b.i;
		});
		return withIdx.map((x) => x.r);
	});

	const advancedFilters = $derived.by(() => {
		const order: ArmorPart[] = ['Head', 'Body', 'Arms', 'Waist', 'Legs'];
		const parts = order.map((part) => {
			const counts = new Map<string, number>();
			for (const r of results) {
				for (const p of r.pieces) {
					if (p.part === part) counts.set(p.name, (counts.get(p.name) ?? 0) + 1);
				}
			}
			const items = [...counts.entries()]
				.map(([name, count]) => ({ key: `${part}:${name}`, name, count }))
				.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
			return { part, items };
		});
		const decoCounts = new Map<string, number>();
		for (const r of results) {
			for (const d of r.decorations) {
				decoCounts.set(d.name, (decoCounts.get(d.name) ?? 0) + d.count);
			}
		}
		const decos = [...decoCounts.entries()]
			.map(([name, count]) => ({ key: `deco:${name}`, name, count }))
			.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
		return { parts, decos };
	});

	const LS = {
		targets: 'mhp3csc:targets',
		charms: 'mhp3csc:charms',
		showcharms: 'mhp3csc:showcharms',
		settings: 'mhp3csc:settings',
		nocharm: 'mhp3csc:nocharm',
		possiblemode: 'mhp3csc:possiblemode',
		hideneg: 'mhp3csc:hideneg',
		sortby: 'mhp3csc:sortby',
		sortdir: 'mhp3csc:sortdir',
		history: 'mhp3csc:history'
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
			const hn = readLS<boolean>(LS.hideneg);
			if (hn != null) hideNegative = hn;
			const sb = readLS<typeof sortBy>(LS.sortby);
			if (sb) sortBy = sb;
			const sd = readLS<typeof sortDir>(LS.sortdir);
			if (sd === 'asc' || sd === 'desc') sortDir = sd;
			const h = readLS<SearchHistoryEntry[]>(LS.history);
			if (h && Array.isArray(h)) history = h;
			return;
		}
		writeLS(LS.targets, targetSkills);
		writeLS(LS.charms, charms);
		writeLS(LS.showcharms, showCharms);
		writeLS(LS.settings, settings);
		writeLS(LS.nocharm, includeNoCharm);
		writeLS(LS.possiblemode, possibleMode);
		writeLS(LS.hideneg, hideNegative);
		writeLS(LS.sortby, sortBy);
		writeLS(LS.sortdir, sortDir);
		writeLS(LS.history, history);
	});

	const filteredTrees = $derived(
		(negativeMode
			? positiveSkillsByTree.map((pg) => {
					const ng = negativeSkillsByTree.find((n) => n.tree === pg.tree);
					return {
						tree: pg.tree,
						skills: [...pg.skills, ...(ng?.skills ?? [])]
					};
				})
			: positiveSkillsByTree
		)
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
					name: charmNameForRarity(p.rarity),
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
			showToast('Select at least one target skill.');
			document
				.getElementById('search-form')
				?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			return;
		}
		if (!includeNoCharm && !possibleMode && !charms.some((c) => c.included)) {
			showToast('Add at least one charm, or enable "no charm" or "possible charm" sets.');
			document
				.getElementById('search-form')
				?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			return;
		}
		formBaseline = formSnapshot();
		formDirty = false;
		controller = new AbortController();
		searching = true;
		searched = true;
		results = [];
		charmFilterId = '__all';
		showAdvanced = false;
		resetAdvancedFilters();
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
			pushHistory();
		} catch (e) {
			console.error(e);
			showToast('Search failed.');
		} finally {
			searching = false;
			searchTime = performance.now() - t0;
			if (progress.phase.includes('combination limit')) {
				showToast(
					'Too many combinations to check exhaustively. Showing best found so far — try loosening your skills or adding a stronger charm.'
				);
			}
		}
	}

	function stopSearch() {
		controller?.abort();
	}

	function togglePiece(key: string, allowed: boolean) {
		const next = new Set(excludedPieces);
		if (allowed) next.delete(key);
		else next.add(key);
		excludedPieces = next;
	}

	function toggleDeco(key: string, allowed: boolean) {
		const next = new Set(excludedDecos);
		if (allowed) next.delete(key);
		else next.add(key);
		excludedDecos = next;
	}

	function resetAdvancedFilters() {
		excludedPieces = new Set();
		excludedDecos = new Set();
	}

	function excludeAllAdvanced() {
		excludedPieces = new Set(advancedFilters.parts.flatMap((p) => p.items.map((i) => i.key)));
		excludedDecos = new Set(advancedFilters.decos.map((d) => d.key));
	}

	const excludedCount = $derived(excludedPieces.size + excludedDecos.size);

	function historyLabel(): string {
		const targetPart = targetSkills.map((t) => t.name).join(', ') || 'No skills';
		let charmPart: string;
		if (possibleMode) charmPart = `possible (${POSSIBLE_LABELS[possibleMode]})`;
		else if (charms.length > 0)
			charmPart = `${charms.length} charm${charms.length === 1 ? '' : 's'}`;
		else charmPart = 'no charms';
		const extras = includeNoCharm ? ' · +no charm' : '';
		return `${targetPart} · ${charmPart}${extras}`;
	}

	// Display label for a history entry, derived from its stored skills so old
	// entries (saved with points-only labels) still show the skill names.
	// Matches the "most searched" format: skills · weapon slots · hunter type
	// (charms are personal to each user, so they're not shown).
	function historyLabelFor(h: SearchHistoryEntry): string {
		const targetPart = h.targets.map((t) => t.name).join(', ') || 'No skills';
		const weaponSlots = h.settings.weaponSlots;
		const weaponPart = !weaponSlots
			? 'no slots'
			: `${weaponSlots} slot${weaponSlots === 1 ? '' : 's'}`;
		return `${targetPart} · ${weaponPart} · ${h.settings.hunterType || ''}`.trimEnd();
	}

	function pushHistory() {
		const key = JSON.stringify({ targetSkills, charms, includeNoCharm, possibleMode, settings });
		const entry: SearchHistoryEntry = {
			id: crypto.randomUUID(),
			ts: Date.now(),
			when: new Date().toLocaleString([], {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			}),
			label: historyLabel(),
			key,
			targets: targetSkills.map((t) => ({ ...t })),
			charms: charms.map((c) => ({
				...c,
				skill1: { ...c.skill1 },
				skill2: c.skill2 ? { ...c.skill2 } : null
			})),
			includeNoCharm,
			possibleMode,
			settings: { ...settings },
			showCharms
		};
		history = [entry, ...history.filter((h) => h.key !== key)].slice(0, 50);
	}

	function loadHistory(h: SearchHistoryEntry) {
		targetSkills = h.targets.map((t) => ({ ...t }));
		charms = h.charms.map((c) => ({
			...c,
			skill1: { ...c.skill1 },
			skill2: c.skill2 ? { ...c.skill2 } : null
		}));
		includeNoCharm = h.includeNoCharm;
		possibleMode = h.possibleMode;
		settings = { ...h.settings };
		showCharms = h.showCharms;
		searched = false;
		results = [];
		searchTime = 0;
		formBaseline = formSnapshot();
		formDirty = true;
		document.getElementById('search-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function clearHistory() {
		history = [];
	}

	let showScrollTop = $state(false);
	let showFab = $state(true);

	let lastScrollY = 0;
	$effect(() => {
		if (typeof window === 'undefined') return;
		const updateFab = () => {
			const footers = document.querySelectorAll('footer');
			const footer = footers[footers.length - 1];
			const footerTop = footer ? footer.getBoundingClientRect().top : Infinity;
			showFab = footerTop >= window.innerHeight;
		};
		const onScroll = () => {
			const y = window.scrollY;
			const form = document.getElementById('search-form');
			// "Outside the form": its top edge has scrolled above the viewport, so
			// the user is reading the results, not the form.
			const rect = form ? form.getBoundingClientRect() : null;
			const outsideForm = !rect || rect.top < 0;
			const scrollingUp = y < lastScrollY;
			showScrollTop = y > 0 && outsideForm && scrollingUp;
			updateFab();
			lastScrollY = y;
		};
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', updateFab);
		onScroll();
		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', updateFab);
		};
	});

	function scrollToTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
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
				onclick={onSwordClick}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') onSwordClick();
				}}
				role="button"
				tabindex="-1"
				class="flex aspect-square h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-amber-500/15 text-xl text-amber-400 select-none {negativeMode
					? 'ring-2 ring-red-500/60'
					: ''}"
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
			<aside id="search-form" class="min-w-0 space-y-5">
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
									class="group flex items-center gap-1 rounded border px-2 py-1 text-xs hover:border-red-500 hover:text-red-300 {t.points <
									0
										? 'border-red-500/40 bg-red-500/10 text-red-300'
										: 'border-amber-500/40 bg-amber-500/10 text-amber-200'}"
								>
									{t.name}
									<span class={t.points < 0 ? 'text-red-400/70' : 'text-amber-400/70'}>✕</span>
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
													{selected?.points === s.points
													? s.points < 0
														? 'bg-red-500/10 text-red-300'
														: 'bg-amber-500/10 text-amber-200'
													: s.points < 0
														? 'text-red-400/80'
														: ''}"
											>
												<span>{s.name}</span>
												<span class={s.points < 0 ? 'text-red-500/70' : 'text-zinc-500'}
													>{s.points < 0 ? s.points : `+${s.points}`}</span
												>
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
						<label class="flex cursor-pointer items-center gap-2 text-zinc-300">
							<input
								type="checkbox"
								bind:checked={settings.allowPiercings}
								class="accent-amber-500"
							/>
							<span>Use piercings (Sword Saint, Barrage)</span>
						</label>
					</div>
				</section>

				<section class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
					<div
						role="button"
						tabindex="0"
						onclick={() => (showHistory = !showHistory)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								showHistory = !showHistory;
							}
						}}
						class="flex w-full cursor-pointer items-center justify-between select-none"
					>
						<span class="flex items-center gap-2">
							<h2 class="text-sm font-semibold tracking-wide text-zinc-300 uppercase">History</h2>
							<span
								class="text-xs text-zinc-400 transition-transform {showHistory ? 'rotate-180' : ''}"
								>▾</span
							>
						</span>
						{#if history.length > 0}
							<button
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									clearHistory();
								}}
								class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-red-700 hover:text-red-400"
							>
								Clear
							</button>
						{/if}
					</div>

					{#if showHistory}
						<div class="mt-3">
							{#if history.length === 0}
								<p class="text-xs text-zinc-500">Your last searches will show up here.</p>
							{:else}
								<div class="max-h-72 space-y-1 overflow-y-auto pr-1">
									{#each history as h (h.id)}
										<button
											type="button"
											onclick={() => loadHistory(h)}
											title={historyLabelFor(h)}
											class="flex w-full items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-800/50 px-2 py-1.5 text-left text-xs hover:border-amber-500 hover:bg-zinc-800"
										>
											<span class="min-w-0 flex-1">
												<span class="block text-zinc-200">{historyLabelFor(h)}</span>
												<span class="block text-[10px] text-zinc-500">{h.when}</span>
											</span>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</section>

				<div
					class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 {searching
						? 'block'
						: 'hidden'} lg:block"
				>
					<button
						type="button"
						id="search-btn"
						onclick={doSearch}
						disabled={searching}
						class="hidden w-full rounded bg-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50 lg:block"
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
				</div>
			</aside>

			<section class="min-w-0">
				<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
					<h2 class="text-sm font-semibold tracking-wide text-zinc-300 uppercase">Results</h2>
					{#if searched}
						<span class="text-xs text-zinc-500">
							{displayResults.length} set{displayResults.length === 1 ? '' : 's'}
							{#if displayResults.length !== results.length}
								(of {results.length})
							{/if}
							{#if !searching && searchTime > 0}
								· {Math.round(searchTime)}ms
							{/if}
							{#if searching}
								· searching…
							{/if}
						</span>
					{/if}
				</div>

				{#if searched && results.length > 0}
					<div
						class="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2"
					>
						<label class="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-300">
							<input type="checkbox" bind:checked={hideNegative} class="accent-amber-500" />
							No negative skills
						</label>
						<span class="mx-1 h-4 w-px bg-zinc-700"></span>
						<div class="flex flex-wrap items-center gap-1">
							{#each SORT_OPTIONS as o (o.key)}
								<button
									type="button"
									onclick={() => (sortBy = o.key)}
									title={o.label}
									class="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] transition-colors
										{sortBy === o.key
										? 'bg-amber-500/20 text-amber-300'
										: 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}"
								>
									<span>{SORT_ICONS[o.key]}</span>
									<span>{o.label}</span>
								</button>
							{/each}
						</div>
						<span class="mx-1 h-4 w-px bg-zinc-700"></span>
						<button
							type="button"
							title={sortDir === 'desc' ? 'Descending (high to low)' : 'Ascending (low to high)'}
							onclick={() => (sortDir = sortDir === 'desc' ? 'asc' : 'desc')}
							class="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] transition-colors
								{sortDir === 'desc' ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-amber-300'}"
						>
							<span>{sortDir === 'desc' ? '⬇' : '⬆'}</span>
							<span>{sortDir === 'desc' ? 'Desc' : 'Asc'}</span>
						</button>
						<span class="mx-1 h-4 w-px bg-zinc-700"></span>
						<select
							bind:value={charmFilterId}
							title="Filter by charm"
							class="max-w-56 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-1 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
						>
							<option value="__all">All charms</option>
							<option value="__none">No charm</option>
							{#each charmFilterOptions as [id, label] (id)}
								<option value={id}>{label}</option>
							{/each}
						</select>
						<span class="mx-1 h-4 w-px bg-zinc-700"></span>
						<button
							type="button"
							onclick={() => (showAdvanced = !showAdvanced)}
							class="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] transition-colors
								{showAdvanced
								? 'bg-amber-500/20 text-amber-300'
								: 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}"
						>
							<span>{showAdvanced ? '▾' : '▸'}</span>
							<span>Advanced search</span>
							{#if excludedCount > 0}
								<span class="rounded-full bg-red-500/20 px-1.5 text-[10px] text-red-300">
									{excludedCount}
								</span>
							{/if}
						</button>
					</div>
				{/if}

				{#if showAdvanced}
					<div class="mb-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
						<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
							<h3 class="text-xs font-semibold tracking-wide text-zinc-300 uppercase">
								Uncheck a piece to see only sets that don't need it
							</h3>
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={resetAdvancedFilters}
									class="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200 hover:border-amber-500 hover:text-amber-300"
								>
									Select all
								</button>
								<button
									type="button"
									onclick={excludeAllAdvanced}
									class="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200 hover:border-red-700 hover:text-red-400"
								>
									Unselect all
								</button>
							</div>
						</div>

						<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
							{#each advancedFilters.parts as g (g.part)}
								<div>
									<div class="mb-1 text-[11px] font-semibold text-zinc-500 uppercase">{g.part}</div>
									{#if g.items.length === 0}
										<p class="text-xs text-zinc-600">None used.</p>
									{:else}
										<div class="max-h-44 space-y-0.5 overflow-y-auto pr-1">
											{#each g.items as it (it.key)}
												<label
													class="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-300 hover:text-zinc-100"
												>
													<input
														type="checkbox"
														checked={!excludedPieces.has(it.key)}
														onchange={(e) => togglePiece(it.key, e.currentTarget.checked)}
														class="accent-amber-500"
													/>
													<span class="min-w-0 flex-1 truncate">{it.name}</span>
													<span class="text-[10px] text-zinc-500">×{it.count}</span>
												</label>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>

						<div class="mt-3">
							<div class="mb-1 text-[11px] font-semibold text-zinc-500 uppercase">
								Decorations (gems)
							</div>
							{#if advancedFilters.decos.length === 0}
								<p class="text-xs text-zinc-600">None used.</p>
							{:else}
								<div class="max-h-44 space-y-0.5 overflow-y-auto pr-1">
									{#each advancedFilters.decos as it (it.key)}
										<label
											class="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-300 hover:text-zinc-100"
										>
											<input
												type="checkbox"
												checked={!excludedDecos.has(it.name)}
												onchange={(e) => toggleDeco(it.name, e.currentTarget.checked)}
												class="accent-amber-500"
											/>
											<span class="min-w-0 flex-1 truncate">{it.name}</span>
											<span class="text-[10px] text-zinc-500">×{it.count}</span>
										</label>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{/if}

				{#if !searched}
					<div
						class="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-600"
					>
						Configure your skills and charms, then run a search.
					</div>
				{:else if displayResults.length > 0}
					<div class="space-y-2">
						{#each displayResults as r, i (i)}
							<ResultCard result={r} index={i} />
						{/each}
					</div>
				{:else if !searching}
					<div
						class="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-500"
					>
						{#if results.length > 0}
							No sets match the current filters.
						{:else}
							No sets found. Try loosening your requirements (fewer skills, more charm points, or
							allow higher rarity armor).
						{/if}
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

	<footer class="border-t border-zinc-800 px-4 py-4 text-center text-xs text-zinc-600">
		Data extracted from Athena's ASS for Monster Hunter Portable 3rd. Not affiliated with Capcom.
	</footer>

	<button
		type="button"
		onclick={scrollToTop}
		aria-label="Back to top"
		title="Back to top"
		class="fixed bottom-4 left-1/2 z-40 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-lg text-zinc-300 shadow-lg transition-opacity hover:border-amber-500 hover:text-amber-300
			{showScrollTop ? 'opacity-100' : 'pointer-events-none opacity-0'}"
	>
		↑
	</button>

	<button
		type="button"
		onclick={doSearch}
		disabled={!formDirty || searching}
		aria-label="Search sets"
		title="Search sets"
		class="fixed right-4 bottom-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all lg:hidden
			{showFab ? 'opacity-100' : 'pointer-events-none opacity-0'}
			{formDirty || searching
			? 'bg-amber-500 text-zinc-950 ring-1 shadow-amber-500/30 ring-amber-300/50 hover:bg-amber-400'
			: 'cursor-not-allowed bg-zinc-800 text-zinc-500 ring-1 ring-zinc-700'}"
	>
		{#if searching}
			<span
				class="h-6 w-6 animate-spin rounded-full border-[3px] border-zinc-900/30 border-t-zinc-900"
			></span>
		{:else}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="h-6 w-6"
			>
				<circle cx="11" cy="11" r="8"></circle>
				<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
			</svg>
		{/if}
	</button>

	{#if toast}
		<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
			<div
				class="pointer-events-auto flex max-w-sm flex-col gap-4 rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-4 shadow-2xl"
			>
				<p class="text-sm text-red-300">{toast}</p>
				<button
					type="button"
					onclick={() => (toast = '')}
					class="self-end rounded bg-amber-500 px-4 py-1.5 text-sm font-bold text-zinc-950 hover:bg-amber-400"
				>
					OK
				</button>
			</div>
		</div>
	{/if}
</div>
