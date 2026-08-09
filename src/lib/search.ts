import type {
	ActivatedSkill,
	ArmorPiece,
	Charm,
	Decoration,
	DecorUse,
	SearchProgress,
	SearchSettings,
	SetPiece,
	SetResult,
	SkillTarget
} from './types';
import {
	PARTS,
	TORSO_INC_TREE,
	skillByTreeAndPoints,
	treeNegativeThresholds,
	treePositiveThresholds
} from './gameData';

export interface SearchData {
	armors: ArmorPiece[];
	decorations: Decoration[];
}

interface PreparedPiece {
	id: number;
	name: string;
	part: number;
	slots: number;
	rarity: number;
	hrRequired: number;
	defenseMax: number;
	defenseBase: number;
	torsoInc: boolean;
	vec: number[];
	totalPos: number;
	totalNeg: number;
	hasNegOnSelected: boolean;
}

interface PreparedCharm {
	id: string;
	name: string;
	slots: number;
	vec: number[];
	skill1: { tree: string; points: number };
	skill2: { tree: string; points: number } | null;
}

interface DecoOption {
	tree: string;
	name: string;
	size: number;
	points: number;
	negs: { tree: string; points: number }[];
	clean: boolean;
}

interface SearchCtx {
	armors: ArmorPiece[];
	relTrees: string[];
	targets: number[];
	piecesByPart: PreparedPiece[][];
	maxDirectSuffix: number[][];
	maxSlotsSuffix: number[];
	/** Max points the body can contribute per tree (used for torso copies). */
	bodyMaxVec: number[];
	hardCount: number[];
	bestPPS: number[];
	decoByTree: Map<string, DecoOption[]>;
	baseSlots: number;
	results: SetResult[];
	seen: Set<string>;
	nodeBudget: number;
	maxResults: number;
	perCharmCap: number;
	nodes: number;
	perCharm: Map<string, number>;
	budgetHit: boolean;
	onResult?: (result: SetResult) => void;
}

interface Frame {
	depth: number;
	pts: number[];
	slots: number;
	pieces: PreparedPiece[];
}

const PRIMARY_CAPS = [26, 22, 18, 14, 10];
const SLOT_CAP = 8;
const MET_CAP = 10;
const YIELD_EVERY = 15000;

function tick(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function buildPreparedPieces(
	armors: ArmorPiece[],
	relTrees: string[],
	settings: SearchSettings
): PreparedPiece[][] {
	const { gender, hunterType, maxRarity, maxHr } = settings;
	const piecesByPart: PreparedPiece[][] = PARTS.map(() => []);
	const seenSig = new Map<string, { totalPos: number; defense: number }>();
	for (let id = 0; id < armors.length; id++) {
		const a = armors[id];
		if (maxRarity != null && a.rarity > maxRarity) continue;
		if (maxHr != null && a.hrRequired > maxHr) continue;
		if (gender !== 'Any' && a.gender !== 'Both' && a.gender !== gender) continue;
		if (hunterType === 'Blademaster' && a.hunterType === 'Gunner') continue;
		if (hunterType === 'Gunner' && a.hunterType === 'Blademaster') continue;

		const torsoInc = a.skills.some((s) => s.skillTree === TORSO_INC_TREE);
		const vec = relTrees.map((t) => {
			if (torsoInc) return 0;
			const s = a.skills.find((x) => x.skillTree === t);
			return s ? s.points : 0;
		});
		let totalPos = 0;
		let totalNeg = 0;
		let hasNeg = false;
		for (const v of vec) {
			if (v > 0) totalPos += v;
			else if (v < 0) {
				totalNeg += -v;
				hasNeg = true;
			}
		}
		const sig = `${a.part}|${torsoInc ? 'TI' : ''}${a.slots}|${vec.join(',')}${torsoInc ? `|${a.rarity}|${a.defenseMax}` : ''}`;
		const prev = seenSig.get(sig);
		if (prev) {
			if (totalPos > prev.totalPos || (totalPos === prev.totalPos && a.defenseMax > prev.defense)) {
				prev.totalPos = totalPos;
				prev.defense = a.defenseMax;
			}
			continue;
		}
		seenSig.set(sig, { totalPos, defense: a.defenseMax });
		piecesByPart[PARTS.indexOf(a.part)].push({
			id,
			name: a.name,
			part: PARTS.indexOf(a.part),
			slots: a.slots,
			rarity: a.rarity,
			hrRequired: a.hrRequired,
			defenseMax: a.defenseMax,
			defenseBase: a.defenseBase,
			torsoInc,
			vec,
			totalPos,
			totalNeg,
			hasNegOnSelected: hasNeg
		});
	}
	return piecesByPart;
}

/** Remove pieces that are strictly dominated (equal or worse on every relevant axis). */
function dominancePrune(list: PreparedPiece[]): PreparedPiece[] {
	const out: PreparedPiece[] = [];
	for (const p of list) {
		if (p.torsoInc) {
			out.push(p);
			continue;
		}
		let dominated = false;
		for (const q of list) {
			if (q === p || q.torsoInc) continue;
			if (q.slots < p.slots) continue;
			if (q.defenseMax < p.defenseMax) continue;
			let allGe = true;
			for (let t = 0; t < p.vec.length; t++) {
				if (q.vec[t] < p.vec[t]) {
					allGe = false;
					break;
				}
			}
			if (allGe && (q.slots > p.slots || q.defenseMax > p.defenseMax || q.totalPos > p.totalPos)) {
				dominated = true;
				break;
			}
		}
		if (!dominated) out.push(p);
	}
	return out;
}

function buildSuffixBounds(
	piecesByPart: PreparedPiece[][],
	relTrees: string[]
): {
	maxDirectSuffix: number[][];
	maxSlotsSuffix: number[];
	bodyMaxVec: number[];
} {
	const n = PARTS.length;
	const partMax: number[][] = Array.from({ length: n }, () => relTrees.map(() => 0));
	const partMaxSlots: number[] = Array(n).fill(0);
	for (let d = 0; d < n; d++) {
		let hasTorso = false;
		for (const p of piecesByPart[d]) {
			if (p.torsoInc) hasTorso = true;
			p.vec.forEach((v, i) => {
				if (v > partMax[d][i]) partMax[d][i] = v;
			});
			if (p.slots > partMaxSlots[d]) partMaxSlots[d] = p.slots;
		}
		// A torso-up piece on any part can copy the body's skills, so that part
		// can contribute up to the best body piece's points too.
		if (hasTorso && d !== 1) {
			for (let t = 0; t < relTrees.length; t++) {
				if (partMax[1][t] > partMax[d][t]) partMax[d][t] = partMax[1][t];
			}
		}
	}
	// Suffix bounds = SUM over remaining parts (one piece per part), not the max
	// of a single piece. Summing is a correct upper bound for pruning.
	const maxDirect = Array.from({ length: n + 1 }, () => relTrees.map(() => 0));
	const maxSlots = Array(n + 1).fill(0);
	for (let d = n - 1; d >= 0; d--) {
		for (let t = 0; t < relTrees.length; t++) {
			maxDirect[d][t] = maxDirect[d + 1][t] + partMax[d][t];
		}
		maxSlots[d] = maxSlots[d + 1] + partMaxSlots[d];
	}
	return { maxDirectSuffix: maxDirect, maxSlotsSuffix: maxSlots, bodyMaxVec: partMax[1].slice() };
}

function buildDecoOptions(
	decorations: Decoration[],
	relTrees: string[]
): Map<string, DecoOption[]> {
	const selSet = new Set(relTrees);
	const out = new Map<string, DecoOption[]>();
	for (const d of decorations) {
		for (const s of d.skills) {
			if (s.points <= 0) continue;
			const negs = d.skills
				.filter((x) => x.points < 0)
				.map((x) => ({ tree: x.skillTree, points: x.points }));
			const clean = !negs.some((n) => selSet.has(n.tree));
			const list = out.get(s.skillTree) ?? [];
			list.push({ tree: s.skillTree, name: d.name, size: d.slots, points: s.points, negs, clean });
			out.set(s.skillTree, list);
		}
	}
	for (const list of out.values()) {
		list.sort((a, b) => {
			if (a.clean !== b.clean) return a.clean ? -1 : 1;
			const effA = a.points / a.size;
			const effB = b.points / b.size;
			if (effA !== effB) return effB - effA;
			return b.points - a.points;
		});
	}
	return out;
}

function computeHardCounts(piecesByPart: PreparedPiece[][], relTrees: string[]): number[] {
	const counts = relTrees.map(() => 0);
	for (const part of piecesByPart) {
		for (const p of part) {
			p.vec.forEach((v, i) => {
				if (v > 0) counts[i]++;
			});
		}
	}
	return counts;
}

function selectHardest(pts: number[], targets: number[], hardCount: number[]): number {
	let best = -1;
	let bestDef = -1;
	for (let i = 0; i < targets.length; i++) {
		const def = targets[i] - pts[i];
		if (def <= 0) continue;
		if (def > bestDef || (def === bestDef && (best < 0 || hardCount[i] < hardCount[best]))) {
			best = i;
			bestDef = def;
		}
	}
	return best;
}

/** Greedy decoration covering with repair loop for negative side effects. */
function solveDeficits(
	ctx: SearchCtx,
	deficits: { tree: string; need: number }[],
	slotsAvail: number
): { uses: DecorUse[]; usedSlots: number; delta: Map<string, number> } | null {
	const needs = new Map<string, number>();
	for (const d of deficits) needs.set(d.tree, d.need);
	const picks = new Map<string, number>();
	let usedSlots = 0;
	let iter = 0;
	const MAXITER = 80;

	while (true) {
		if (++iter > MAXITER) return null;
		let t: string | null = null;
		let maxNeed = 0;
		for (const [tree, need] of needs) {
			if (need > 0 && need > maxNeed) {
				maxNeed = need;
				t = tree;
			}
		}
		if (t === null) break;

		const all = ctx.decoByTree.get(t) ?? [];
		const clean = all.filter((o) => o.clean);
		const options = clean.length > 0 ? clean : all;
		if (options.length === 0) return null;

		const cover = coverTree(options, maxNeed, slotsAvail - usedSlots);
		if (!cover) return null;
		for (const [name, count] of cover.picks) picks.set(name, (picks.get(name) ?? 0) + count);
		usedSlots += cover.usedSlots;
		needs.set(t, 0);

		// Apply negative side effects on selected trees.
		for (const [name, count] of cover.picks) {
			const opt = options.find((o) => o.name === name);
			if (!opt) continue;
			for (const neg of opt.negs) {
				if (needs.has(neg.tree)) {
					needs.set(neg.tree, (needs.get(neg.tree) ?? 0) + neg.points * count);
				}
			}
		}
	}

	const delta = new Map<string, number>();
	for (const [name, count] of picks) {
		for (const list of ctx.decoByTree.values()) {
			const opt = list.find((o) => o.name === name);
			if (opt) {
				delta.set(opt.tree, (delta.get(opt.tree) ?? 0) + opt.points * count);
				for (const neg of opt.negs) {
					delta.set(neg.tree, (delta.get(neg.tree) ?? 0) + neg.points * count);
				}
				break;
			}
		}
	}

	return {
		uses: [...picks.entries()].map(([name, count]) => ({ name, count })),
		usedSlots,
		delta
	};
}

/** Minimal slots to reach `need` points using the given decorations. */
function coverTree(
	options: DecoOption[],
	need: number,
	slotsAvail: number
): { picks: Map<string, number>; usedSlots: number } | null {
	const maxSlots = Math.min(slotsAvail, need + 8);
	const dp = new Int32Array(maxSlots + 1).fill(-1);
	const pick = new Int32Array(maxSlots + 1).fill(-1);
	dp[0] = 0;
	for (let s = 0; s <= maxSlots; s++) {
		if (dp[s] < 0) continue;
		for (let o = 0; o < options.length; o++) {
			const ns = s + options[o].size;
			if (ns > maxSlots) continue;
			const np = dp[s] + options[o].points;
			if (np > dp[ns]) {
				dp[ns] = np;
				pick[ns] = o;
			}
		}
	}
	let best = -1;
	for (let s = 0; s <= maxSlots; s++) {
		if (dp[s] >= need) {
			best = s;
			break;
		}
	}
	if (best < 0) return null;
	const picks = new Map<string, number>();
	let s = best;
	while (s > 0) {
		const o = pick[s];
		if (o < 0) return null;
		picks.set(options[o].name, (picks.get(options[o].name) ?? 0) + 1);
		s -= options[o].size;
	}
	return { picks, usedSlots: best };
}

function leafResult(
	ctx: SearchCtx,
	charm: PreparedCharm | null,
	pieces: PreparedPiece[],
	slots: number
): SetResult | null {
	const armors = ctx.armors;
	const full = new Map<string, number>();
	const addPoints = (tree: string, p: number) => {
		full.set(tree, (full.get(tree) ?? 0) + p);
	};

	if (charm) {
		addPoints(charm.skill1.tree, charm.skill1.points);
		if (charm.skill2) addPoints(charm.skill2.tree, charm.skill2.points);
	}

	const bodyPiece = pieces[1];
	const bodySkills = bodyPiece && !bodyPiece.torsoInc ? armors[bodyPiece.id].skills : [];
	let torsoIncUsed = false;

	for (const piece of pieces) {
		const orig = armors[piece.id];
		if (piece.torsoInc) {
			torsoIncUsed = true;
			for (const s of bodySkills) addPoints(s.skillTree, s.points);
		} else {
			for (const s of orig.skills) addPoints(s.skillTree, s.points);
		}
	}

	// Deficits on selected trees.
	const deficits: { tree: string; need: number }[] = [];
	for (let i = 0; i < ctx.relTrees.length; i++) {
		const tree = ctx.relTrees[i];
		const need = ctx.targets[i] - (full.get(tree) ?? 0);
		if (need > 0) deficits.push({ tree, need });
	}

	let decorations: DecorUse[] = [];
	let usedSlots = 0;
	if (deficits.length > 0) {
		const solved = solveDeficits(ctx, deficits, slots);
		if (!solved) return null;
		decorations = solved.uses;
		usedSlots = solved.usedSlots;
		for (const [tree, pts] of solved.delta) addPoints(tree, pts);
	}

	// Verify all targets met after decorations.
	for (let i = 0; i < ctx.relTrees.length; i++) {
		if ((full.get(ctx.relTrees[i]) ?? 0) < ctx.targets[i]) return null;
	}

	const activated: ActivatedSkill[] = [];
	const negativeActivated: ActivatedSkill[] = [];
	if (torsoIncUsed) activated.push({ name: 'Torso Inc', tree: TORSO_INC_TREE, points: 1 });
	for (const [tree, pts] of full) {
		for (const th of treePositiveThresholds(tree)) {
			if (pts >= th) {
				const name = skillByTreeAndPoints.get(tree)?.get(th);
				if (name) activated.push({ name, tree, points: pts });
			}
		}
		for (const th of treeNegativeThresholds(tree)) {
			if (pts <= th) {
				const name = skillByTreeAndPoints.get(tree)?.get(th);
				if (name) negativeActivated.push({ name, tree, points: pts });
			}
		}
	}
	activated.sort((a, b) => b.points - a.points);
	negativeActivated.sort((a, b) => a.points - b.points);

	const setPieces: SetPiece[] = pieces.map((p) => {
		const orig = armors[p.id];
		return {
			name: orig.name,
			part: PARTS[p.part],
			slots: orig.slots,
			defenseBase: orig.defenseBase,
			defenseMax: orig.defenseMax,
			rarity: orig.rarity,
			hrRequired: orig.hrRequired,
			isTorsoInc: p.torsoInc
		};
	});

	let defenseSumMax = 0;
	for (const p of setPieces) defenseSumMax += p.defenseMax;

	const key = [
		pieces.map((p) => p.name).join('|'),
		charm ? charm.id : 'no-charm',
		...decorations.map((d) => `${d.name}x${d.count}`).sort()
	].join('~');
	if (ctx.seen.has(key)) return null;
	ctx.seen.add(key);

	const charmOut =
		charm && charm.id !== '__nocharm'
			? {
					id: charm.id,
					name: charm.name,
					slots: charm.slots,
					skill1: charm.skill1,
					skill2: charm.skill2
				}
			: null;

	const treePoints = [...full.entries()]
		.map(([tree, points]) => ({ tree, points }))
		.sort((a, b) => b.points - a.points);

	return {
		pieces: setPieces,
		charm: charmOut,
		weaponSlots: ctx.baseSlots,
		decorations,
		usedSlots,
		totalSlots: slots,
		treePoints,
		activated,
		negativeActivated,
		defenseSumMax,
		allTargetsMet: true
	};
}

function candidatesFor(ctx: SearchCtx, frame: Frame): PreparedPiece[] {
	const depth = frame.depth;
	const part = ctx.piecesByPart[depth];
	const hardest = selectHardest(frame.pts, ctx.targets, ctx.hardCount);
	const out: PreparedPiece[] = [];

	if (hardest >= 0) {
		const primary = part.filter((p) => !p.torsoInc && p.vec[hardest] > 0);
		primary.sort(
			(a, b) =>
				b.vec[hardest] - a.vec[hardest] ||
				b.totalPos - a.totalPos ||
				b.slots - a.slots ||
				Number(a.hasNegOnSelected) - Number(b.hasNegOnSelected)
		);
		const cap = PRIMARY_CAPS[depth] ?? 12;
		const seenNames = new Set<string>();
		for (const p of primary) {
			if (out.length >= cap) break;
			if (seenNames.has(p.name)) continue;
			seenNames.add(p.name);
			out.push(p);
		}

		const slotPieces = part
			.filter((p) => !p.torsoInc && p.slots >= 2 && p.vec[hardest] <= 0 && !seenNames.has(p.name))
			.sort(
				(a, b) =>
					b.slots - a.slots ||
					b.totalPos - b.totalNeg - (a.totalPos - a.totalNeg) ||
					b.defenseMax - a.defenseMax
			);
		for (const p of slotPieces) {
			if (out.length >= cap + SLOT_CAP) break;
			out.push(p);
		}
	} else {
		const met = part
			.filter((p) => !p.torsoInc)
			.sort(
				(a, b) =>
					Number(a.hasNegOnSelected) - Number(b.hasNegOnSelected) || b.defenseMax - a.defenseMax
			);
		for (const p of met) {
			if (out.length >= MET_CAP) break;
			out.push(p);
		}
	}

	for (const p of part) {
		if (p.torsoInc) out.push(p);
	}
	return out;
}

function pruned(ctx: SearchCtx, depth: number, ptsAfter: number[], slotsTotal: number): boolean {
	const remDirect = ctx.maxDirectSuffix[depth];
	const remSlots = ctx.maxSlotsSuffix[depth];
	for (let t = 0; t < ctx.relTrees.length; t++) {
		const upper = ptsAfter[t] + remDirect[t] + ctx.bestPPS[t] * (slotsTotal + remSlots);
		if (upper < ctx.targets[t]) return true;
	}
	return false;
}

export interface SearchParams {
	targets: SkillTarget[];
	charms: Charm[];
	includeNoCharm?: boolean;
	settings: SearchSettings;
	maxResults?: number;
	nodeBudget?: number;
	/** Called immediately whenever a new valid set is found (for live UI). */
	onResult?: (result: SetResult) => void;
}

export async function runSearch(
	params: SearchParams,
	data: SearchData,
	onProgress?: (p: SearchProgress) => void,
	signal?: AbortSignal
): Promise<SetResult[]> {
	if (params.targets.length === 0) return [];

	const relTrees = params.targets.map((t) => t.tree);
	const targets = params.targets.map((t) => t.points);

	const piecesByPart = buildPreparedPieces(data.armors, relTrees, params.settings);
	for (let i = 0; i < piecesByPart.length; i++) {
		piecesByPart[i] = dominancePrune(piecesByPart[i]);
	}

	const hardCount = computeHardCounts(piecesByPart, relTrees);
	const bounds = buildSuffixBounds(piecesByPart, relTrees);
	const { maxDirectSuffix, maxSlotsSuffix, bodyMaxVec } = bounds;
	const decoByTree = buildDecoOptions(data.decorations, relTrees);
	const bestPPS = relTrees.map((tree) => {
		const opts = decoByTree.get(tree) ?? [];
		let best = 0;
		for (const o of opts) {
			const pps = o.points / o.size;
			if (pps > best) best = pps;
		}
		return best;
	});

	const charms: PreparedCharm[] = [];
	for (const c of params.charms) {
		if (!c.included) continue;
		const vec = relTrees.map((t) => {
			let p = 0;
			if (c.skill1.tree === t) p += c.skill1.points;
			if (c.skill2 && c.skill2.tree === t) p += c.skill2.points;
			return p;
		});
		charms.push({
			id: c.id,
			name: c.name || '(unnamed charm)',
			slots: c.slots,
			vec,
			skill1: c.skill1,
			skill2: c.skill2
		});
	}

	const ctx: SearchCtx = {
		armors: data.armors,
		relTrees,
		targets,
		piecesByPart,
		maxDirectSuffix,
		maxSlotsSuffix,
		bodyMaxVec,
		hardCount,
		bestPPS,
		decoByTree,
		baseSlots: params.settings.weaponSlots,
		results: [],
		seen: new Set(),
		nodeBudget: params.nodeBudget ?? 4_000_000,
		maxResults: params.maxResults ?? 400,
		perCharmCap: 1000,
		nodes: 0,
		perCharm: new Map(),
		budgetHit: false,
		onResult: params.onResult
	};

	const progress: SearchProgress = { phase: 'Preparing…', nodes: 0, found: 0, done: false };

	for (const charm of charms) {
		if (ctx.results.length >= ctx.maxResults) break;
		// Skip charms that can't possibly reach every target (tight depth-0 bound).
		if (pruned(ctx, 0, charm.vec, ctx.baseSlots + charm.slots)) {
			continue;
		}
		progress.phase = `Searching ${charm.name}`;
		onProgress?.({ ...progress });
		await searchCharm(ctx, charm, onProgress, signal, progress);
		if (signal?.aborted) {
			progress.done = true;
			progress.phase = 'Aborted';
			onProgress?.({ ...progress });
			return ctx.results;
		}
	}

	if (params.includeNoCharm && ctx.results.length < ctx.maxResults) {
		const noCharm: PreparedCharm = {
			id: '__nocharm',
			name: 'No charm',
			slots: 0,
			vec: relTrees.map(() => 0),
			skill1: { tree: '', points: 0 },
			skill2: null
		};
		if (!pruned(ctx, 0, noCharm.vec, ctx.baseSlots)) {
			progress.phase = 'Searching (no charm)';
			onProgress?.({ ...progress });
			await searchCharm(ctx, noCharm, onProgress, signal, progress);
		}
	}

	ctx.results.sort((a, b) => b.defenseSumMax - a.defenseSumMax);
	progress.done = true;
	progress.phase = ctx.budgetHit ? 'Stopped (combination limit)' : 'Done';
	progress.found = ctx.results.length;
	onProgress?.({ ...progress });
	return ctx.results;
}

async function searchCharm(
	ctx: SearchCtx,
	charm: PreparedCharm,
	onProgress?: (p: SearchProgress) => void,
	signal?: AbortSignal,
	progress?: SearchProgress
): Promise<void> {
	const stack: Frame[] = [];
	stack.push({ depth: 0, pts: charm.vec.slice(), slots: ctx.baseSlots + charm.slots, pieces: [] });
	const charmKey = charm.id;

	while (stack.length > 0) {
		if (
			ctx.results.length >= ctx.maxResults ||
			(ctx.perCharm.get(charmKey) ?? 0) >= ctx.perCharmCap
		) {
			return;
		}
		if (++ctx.nodes > ctx.nodeBudget) {
			ctx.budgetHit = true;
			if (progress) progress.phase = 'Stopped (node limit reached)';
			return;
		}
		if (ctx.nodes % YIELD_EVERY === 0) {
			await tick();
			if (progress) {
				progress.nodes = ctx.nodes;
				progress.found = ctx.results.length;
			}
			onProgress?.({ ...progress! });
			if (signal?.aborted) return;
		}

		const frame = stack.pop()!;
		if (frame.depth === 5) {
			const res = leafResult(ctx, charm, frame.pieces, frame.slots);
			if (res) {
				ctx.results.push(res);
				ctx.perCharm.set(charmKey, (ctx.perCharm.get(charmKey) ?? 0) + 1);
				ctx.onResult?.(res);
			}
			continue;
		}

		const cands = candidatesFor(ctx, frame);
		for (let i = cands.length - 1; i >= 0; i--) {
			const c = cands[i];
			const pts = frame.pts.slice();
			const slots = frame.slots + c.slots;
			for (let t = 0; t < pts.length; t++) pts[t] += c.vec[t];
			if (c.torsoInc) {
				// A torso-up piece also copies the body's points. If the body is
				// already chosen (always true for waist/legs) use its exact vec;
				// otherwise (torso on head) bound with the best possible body.
				const body = frame.pieces.find((p) => p.part === 1);
				const copy = body ? body.vec : ctx.bodyMaxVec;
				for (let t = 0; t < pts.length; t++) pts[t] += copy[t];
			}
			if (pruned(ctx, frame.depth + 1, pts, slots)) continue;
			stack.push({ depth: frame.depth + 1, pts, slots, pieces: [...frame.pieces, c] });
		}
	}
}
