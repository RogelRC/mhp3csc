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
import { CHARM_TABLE, CHARM_TREE_NAMES, CHARM_NAMES } from './mh3/charmTable';

export interface SearchData {
	armors: ArmorPiece[];
	decorations: Decoration[];
}

export interface PreparedPiece {
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
	total: number;
	skill1: { tree: string; points: number };
	skill2: { tree: string; points: number } | null;
	hypothetical?: boolean;
}

interface DecoOption {
	tree: string;
	name: string;
	size: number;
	points: number;
	negs: { tree: string; points: number }[];
	clean: boolean;
}

/** Precomputed "minimum slots to reach each point need" table for a decoration pool. */
interface DecoTable {
	minSlots: number[];
	picks: { index: number; count: number }[][];
	options: DecoOption[];
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
	/** Max points per slot a decoration can give, per tree. */
	bestPPS: number[];
	/** Max over all trees of bestPPS (joint slot bound). */
	maxPPS: number;
	decoByTree: Map<string, DecoOption[]>;
	decoByName: Map<string, DecoOption>;
	/** Per-tree min-slot tables: clean (no negative on a target) and all options. */
	decoTables: Map<string, { clean: DecoTable; all: DecoTable }>;
	baseSlots: number;
	/** Best `maxResults` sets found so far, sorted best-first. */
	results: SetResult[];
	/** Total number of valid sets discovered (may exceed results.length). */
	found: number;
	nodeBudget: number;
	maxResults: number;
	nodes: number;
	budgetHit: boolean;
	onResult?: (result: SetResult) => void;
}

interface Frame {
	depth: number;
	pts: number[];
	slots: number;
	pieces: PreparedPiece[];
}

const MAX_NEED = 30;
const YIELD_EVERY = 50000;
const SLOT_TABLE_CAP = 24;

export type PossibleCharmMode = 'slotted' | 'oneSkill' | 'twoSkills';

/**
 * Real charms from MHP3rd's official charm tables (mhp3db) that touch any of the
 * target skill trees, so a search can report which real charm each set requires.
 *
 * - `slotted`: charms with at least one decoration slot (1-2 skills).
 * - `oneSkill`: single-skill charms (any slots).
 * - `twoSkills`: exactly two-skill charms (any slots).
 */
export function buildPossibleCharms(targets: SkillTarget[], mode: PossibleCharmMode): Charm[] {
	const treeIndex = new Map<string, number>();
	for (let i = 0; i < CHARM_TREE_NAMES.length; i++) treeIndex.set(CHARM_TREE_NAMES[i], i);
	const targetIdx = new Set<number>();
	for (const t of targets) {
		const i = treeIndex.get(t.tree);
		if (i !== undefined) targetIdx.add(i);
	}
	if (targetIdx.size === 0) return [];

	const out: Charm[] = [];
	let counter = 0;
	for (const row of CHARM_TABLE) {
		const [t1, p1, t2, p2, slots, nameIdx] = row;
		if (mode === 'slotted' && slots < 1) continue;
		if (mode === 'oneSkill' && t2 >= 0) continue;
		if (mode === 'twoSkills' && t2 < 0) continue;
		const hitsTarget = (t1 >= 0 && targetIdx.has(t1)) || (t2 >= 0 && targetIdx.has(t2));
		if (!hitsTarget) continue;
		out.push({
			id: `possible-${counter++}`,
			name: CHARM_NAMES[nameIdx] ?? 'Talisman',
			slots,
			skill1: {
				tree: t1 >= 0 ? CHARM_TREE_NAMES[t1] : '',
				points: t1 >= 0 ? p1 : 0
			},
			skill2: t2 >= 0 ? { tree: CHARM_TREE_NAMES[t2], points: p2 } : null,
			included: true,
			hypothetical: true
		});
	}
	return out;
}

function tick(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

export function buildPreparedPieces(
	armors: ArmorPiece[],
	relTrees: string[],
	settings: SearchSettings
): PreparedPiece[][] {
	const { gender, hunterType, maxRarity, maxHr, maxVillageStars, allowPiercings } = settings;
	const piecesByPart: PreparedPiece[][] = PARTS.map(() => []);
	const seenSig = new Map<string, { totalPos: number; defense: number }>();
	for (let id = 0; id < armors.length; id++) {
		const a = armors[id];
		if (maxRarity != null && a.rarity > maxRarity) continue;
		if (!allowPiercings && /Piercing$/.test(a.name)) continue;
		const guildOnly = a.villageStarsRequired === 99;
		const villageOk =
			!guildOnly && (maxVillageStars == null || a.villageStarsRequired <= maxVillageStars);
		const hrOk = maxHr == null || a.hrRequired <= maxHr;
		if (!villageOk && !hrOk) continue;
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
export function dominancePrune(list: PreparedPiece[]): PreparedPiece[] {
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

/**
 * Minimum-slots table for a decoration pool. minSlots[d] = fewest slots needed
 * to reach at least d points with these decorations (ignoring their negatives);
 * picks[d] is one such optimal decoration multiset.
 */
function buildDecoTable(options: DecoOption[]): DecoTable {
	const maxSlots = SLOT_TABLE_CAP;
	const maxPoints = new Int32Array(maxSlots + 1).fill(-1);
	const pick = new Int32Array(maxSlots + 1).fill(-1);
	maxPoints[0] = 0;
	for (let s = 0; s <= maxSlots; s++) {
		if (maxPoints[s] < 0) continue;
		for (let o = 0; o < options.length; o++) {
			const ns = s + options[o].size;
			if (ns > maxSlots) continue;
			const np = maxPoints[s] + options[o].points;
			if (np > maxPoints[ns]) {
				maxPoints[ns] = np;
				pick[ns] = o;
			}
		}
	}
	let best = 0;
	const minSlots: number[] = [];
	const picks: { index: number; count: number }[][] = [];
	for (let d = 0; d <= MAX_NEED; d++) {
		while (best < maxSlots && maxPoints[best] < d) best++;
		if (maxPoints[best] >= d) {
			minSlots.push(best);
			const counts = new Map<number, number>();
			let s = best;
			while (s > 0) {
				const o = pick[s];
				if (o < 0) break;
				counts.set(o, (counts.get(o) ?? 0) + 1);
				s -= options[o].size;
			}
			picks.push([...counts.entries()].map(([index, count]) => ({ index, count })));
		} else {
			minSlots.push(Infinity);
			picks.push([]);
		}
	}
	return { minSlots, picks, options };
}

function getDecoTables(ctx: SearchCtx, tree: string): { clean: DecoTable; all: DecoTable } {
	let cached = ctx.decoTables.get(tree);
	if (cached) return cached;
	const options = ctx.decoByTree.get(tree) ?? [];
	const cleanOpts = options.filter((o) => o.clean);
	const clean = buildDecoTable(cleanOpts.length > 0 ? cleanOpts : options);
	const all = buildDecoTable(options);
	cached = { clean, all };
	ctx.decoTables.set(tree, cached);
	return cached;
}

/**
 * Can a multiset of decoration sizes (1-3) be physically placed into the given
 * slot capacities (1-3)? A [2] gem needs a hole of at least 2, a [3] a hole of 3.
 * Largest-first greedy filling each slot is exact for sizes <= 3 (smaller gems
 * fit anywhere a larger one fits), so it never reports an impossible set as OK.
 */
function canPackSlots(caps: number[], sizes: number[]): boolean {
	const slots = caps.filter((c) => c > 0).sort((a, b) => b - a);
	const jewels = sizes.filter((s) => s > 0).sort((a, b) => b - a);
	if (jewels.length === 0) return true;
	if (slots.length === 0) return false;
	for (const slot of slots) {
		let remaining = slot;
		for (let j = 0; j < jewels.length; j++) {
			if (jewels[j] === 0 || jewels[j] > remaining) continue;
			remaining -= jewels[j];
			jewels[j] = 0;
		}
	}
	return jewels.every((j) => j === 0);
}

/**
 * Greedy decoration covering with repair loop for negative side effects.
 * Uses precomputed min-slot tables, so it is fast enough to run per leaf.
 */
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
	const MAXITER = 200;

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

		if (maxNeed > MAX_NEED) return null;
		const { clean, all } = getDecoTables(ctx, t);
		const table = clean.minSlots[maxNeed] <= slotsAvail - usedSlots ? clean : all;
		const minS = table.minSlots[maxNeed];
		if (minS === Infinity || minS > slotsAvail - usedSlots) return null;
		usedSlots += minS;

		let covered = 0;
		for (const { index, count } of table.picks[maxNeed]) {
			const option = table.options[index];
			picks.set(option.name, (picks.get(option.name) ?? 0) + count);
			covered += option.points * count;
			for (const neg of option.negs) {
				if (needs.has(neg.tree)) {
					needs.set(neg.tree, (needs.get(neg.tree) ?? 0) + neg.points * count);
				}
			}
		}
		needs.set(t, Math.max(0, needs.get(t)! - covered));
	}

	const delta = new Map<string, number>();
	for (const [name, count] of picks) {
		const opt = ctx.decoByName.get(name);
		if (opt) {
			delta.set(opt.tree, (delta.get(opt.tree) ?? 0) + opt.points * count);
			for (const neg of opt.negs) {
				delta.set(neg.tree, (delta.get(neg.tree) ?? 0) + neg.points * count);
			}
		}
	}

	return {
		uses: [...picks.entries()].map(([name, count]) => ({ name, count })),
		usedSlots,
		delta
	};
}

/**
 * Physical decoration solver: places gems one by one into the actual slot
 * capacities (weapon + charm + armor pieces). Used when the fast min-slot plan
 * cannot be packed into the real hole sizes.
 */
function solveDeficitsPhysical(
	ctx: SearchCtx,
	deficits: { tree: string; need: number }[],
	caps: number[]
): { uses: DecorUse[]; usedSlots: number; delta: Map<string, number> } | null {
	const needs = new Map<string, number>();
	for (const d of deficits) needs.set(d.tree, d.need);
	const picks = new Map<string, number>();
	const slots = caps.filter((c) => c > 0).sort((a, b) => b - a);
	let usedSlots = 0;
	let iter = 0;
	const MAXITER = 200;

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
		if (maxNeed > MAX_NEED) return null;

		const options = ctx.decoByTree.get(t) ?? [];
		let covered = 0;
		for (const opt of options) {
			while (covered < maxNeed) {
				// Smallest remaining hole big enough for this gem.
				let idx = -1;
				let cap = Infinity;
				for (let s = 0; s < slots.length; s++) {
					if (slots[s] >= opt.size && slots[s] < cap) {
						cap = slots[s];
						idx = s;
					}
				}
				if (idx < 0) break;
				slots[idx] -= opt.size;
				usedSlots += opt.size;
				covered += opt.points;
				picks.set(opt.name, (picks.get(opt.name) ?? 0) + 1);
				for (const neg of opt.negs) {
					if (needs.has(neg.tree)) {
						needs.set(neg.tree, (needs.get(neg.tree) ?? 0) + neg.points);
					}
				}
			}
		}
		if (covered < maxNeed) return null;
		needs.set(t, Math.max(0, needs.get(t)! - covered));
	}

	const delta = new Map<string, number>();
	for (const [name, count] of picks) {
		const opt = ctx.decoByName.get(name);
		if (opt) {
			delta.set(opt.tree, (delta.get(opt.tree) ?? 0) + opt.points * count);
			for (const neg of opt.negs) {
				delta.set(neg.tree, (delta.get(neg.tree) ?? 0) + neg.points * count);
			}
		}
	}

	return {
		uses: [...picks.entries()].map(([name, count]) => ({ name, count })),
		usedSlots,
		delta
	};
} /** Validate a leaf (charms + pieces + decoration coverage) and return cheap facts. */
function leafCore(
	ctx: SearchCtx,
	charm: PreparedCharm | null,
	pieces: PreparedPiece[],
	slots: number
): {
	full: Map<string, number>;
	defense: number;
	usedSlots: number;
	decorations: DecorUse[];
	torsoIncUsed: boolean;
} | null {
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
		// The fast solver only checks total slot count; the gem sizes must also
		// physically fit into the real hole sizes (e.g. a [2] gem needs a 2+ hole).
		const caps = [ctx.baseSlots, charm?.slots ?? 0, ...pieces.map((p) => p.slots)];
		const sizes = [
			...solved.uses.flatMap((u) => {
				const opt = ctx.decoByName.get(u.name);
				return opt ? Array(u.count).fill(opt.size) : [];
			})
		];
		if (!canPackSlots(caps, sizes)) {
			const physical = solveDeficitsPhysical(ctx, deficits, caps);
			if (!physical) return null;
			decorations = physical.uses;
			usedSlots = physical.usedSlots;
			for (const [tree, pts] of physical.delta) addPoints(tree, pts);
		} else {
			decorations = solved.uses;
			usedSlots = solved.usedSlots;
			for (const [tree, pts] of solved.delta) addPoints(tree, pts);
		}
	}

	// Verify all targets met after decorations.
	for (let i = 0; i < ctx.relTrees.length; i++) {
		if ((full.get(ctx.relTrees[i]) ?? 0) < ctx.targets[i]) return null;
	}

	let defense = 0;
	for (const p of pieces) defense += p.defenseMax;

	return { full, defense, usedSlots, decorations, torsoIncUsed };
}

function buildResult(
	ctx: SearchCtx,
	charm: PreparedCharm | null,
	pieces: PreparedPiece[],
	slots: number,
	core: {
		full: Map<string, number>;
		defense: number;
		usedSlots: number;
		decorations: DecorUse[];
		torsoIncUsed: boolean;
	}
): SetResult {
	const armors = ctx.armors;
	const { full, defense, usedSlots, decorations, torsoIncUsed } = core;

	const activated: ActivatedSkill[] = [];
	const negativeActivated: ActivatedSkill[] = [];
	if (torsoIncUsed) activated.push({ name: 'Torso Up', tree: TORSO_INC_TREE, points: 1 });
	for (const [tree, pts] of full) {
		const posThresholds = treePositiveThresholds(tree);
		for (let i = posThresholds.length - 1; i >= 0; i--) {
			if (pts >= posThresholds[i]) {
				const name = skillByTreeAndPoints.get(tree)?.get(posThresholds[i]);
				if (name) activated.push({ name, tree, points: pts });
				break;
			}
		}
		const negThresholds = treeNegativeThresholds(tree);
		for (let i = 0; i < negThresholds.length; i++) {
			if (pts <= negThresholds[i]) {
				const name = skillByTreeAndPoints.get(tree)?.get(negThresholds[i]);
				if (name) negativeActivated.push({ name, tree, points: pts });
				break;
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

	const charmOut =
		charm && charm.id !== '__nocharm'
			? {
					id: charm.id,
					name: charm.name,
					slots: charm.slots,
					skill1: charm.skill1,
					skill2: charm.skill2,
					hypothetical: charm.hypothetical
				}
			: null;

	const treePoints = [...full.entries()]
		.map(([tree, points]) => ({ tree, points }))
		.sort((a, b) => b.points - a.points);

	let defenseBase = 0;
	let raritySum = 0;
	let hrSum = 0;
	const res = { fire: 0, water: 0, ice: 0, thunder: 0, dragon: 0 };
	for (const p of pieces) {
		const orig = armors[p.id];
		defenseBase += orig.defenseBase;
		raritySum += orig.rarity;
		hrSum += orig.hrRequired;
		res.fire += orig.resistances.fire;
		res.water += orig.resistances.water;
		res.ice += orig.resistances.ice;
		res.thunder += orig.resistances.thunder;
		res.dragon += orig.resistances.dragon;
	}

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
		defenseSumMax: defense,
		defenseSumBase: defenseBase,
		resistanceSum: res,
		raritySum,
		hrSum,
		slotsLeft: slots - usedSlots,
		allTargetsMet: true
	};
}

/** True when `a` ranks at least as good as `b` for the displayed top list. */
function better(a: SetResult, b: SetResult): boolean {
	if (a.defenseSumMax !== b.defenseSumMax) return a.defenseSumMax > b.defenseSumMax;
	if (a.totalSlots !== b.totalSlots) return a.totalSlots > b.totalSlots;
	if (a.usedSlots !== b.usedSlots) return a.usedSlots < b.usedSlots;
	return a.activated.length > b.activated.length;
}

/** Insert into a fixed-cap sorted list (best first). Returns true if it made the cut. */
function pushTop(results: SetResult[], res: SetResult, cap: number): boolean {
	if (results.length >= cap && !better(res, results[results.length - 1])) return false;
	let lo = 0;
	let hi = results.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (better(results[mid], res)) lo = mid + 1;
		else hi = mid;
	}
	results.splice(lo, 0, res);
	if (results.length > cap) results.pop();
	return true;
}

/**
 * Remove charms that are strictly dominated: another charm has at least as many
 * points on every relevant tree and at least as many slots. Such a charm can
 * never enable a set the dominator cannot, so it is safe to skip (and it is
 * strictly worse for the player). When a real charm and a hypothetical one share
 * an identical profile, the real charm wins so results show what the player owns.
 * The survivors are sorted best-first.
 */
function pruneCharms(charms: PreparedCharm[]): PreparedCharm[] {
	const seen = new Map<string, PreparedCharm>();
	const uniq: PreparedCharm[] = [];
	for (const c of charms) {
		const sig = `${c.slots}|${c.vec.join(',')}`;
		const prev = seen.get(sig);
		if (prev) {
			if (prev.hypothetical && !c.hypothetical) {
				const idx = uniq.indexOf(prev);
				uniq[idx] = c;
				seen.set(sig, c);
			}
			continue;
		}
		seen.set(sig, c);
		uniq.push(c);
	}
	const out: PreparedCharm[] = [];
	for (const a of uniq) {
		let dominated = false;
		for (const b of uniq) {
			if (b === a) continue;
			if (b.slots < a.slots) continue;
			let ge = true;
			let strict = false;
			for (let t = 0; t < a.vec.length; t++) {
				if (b.vec[t] < a.vec[t]) {
					ge = false;
					break;
				}
				if (b.vec[t] > a.vec[t]) strict = true;
			}
			if (!ge) continue;
			if (b.slots > a.slots) strict = true;
			if (strict) {
				dominated = true;
				break;
			}
		}
		if (!dominated) out.push(a);
	}
	out.sort((a, b) => b.total - a.total || b.slots - a.slots);
	return out;
}

function candidatesFor(ctx: SearchCtx, frame: Frame): PreparedPiece[] {
	const depth = frame.depth;
	const part = ctx.piecesByPart[depth];
	const hardest = selectHardest(frame.pts, ctx.targets, ctx.hardCount);
	const out: PreparedPiece[] = [];

	if (hardest >= 0) {
		const primary = part
			.filter((p) => !p.torsoInc && p.vec[hardest] > 0)
			.sort(
				(a, b) =>
					b.vec[hardest] - a.vec[hardest] ||
					b.totalPos - a.totalPos ||
					b.slots - a.slots ||
					Number(a.hasNegOnSelected) - Number(b.hasNegOnSelected)
			);
		for (const p of primary) out.push(p);

		const slotPieces = part
			.filter((p) => !p.torsoInc && p.slots >= 2 && p.vec[hardest] <= 0)
			.sort(
				(a, b) =>
					b.slots - a.slots ||
					b.totalPos - b.totalNeg - (a.totalPos - a.totalNeg) ||
					b.defenseMax - a.defenseMax
			);
		for (const p of slotPieces) out.push(p);

		const rest = part
			.filter((p) => !p.torsoInc && p.slots < 2 && p.vec[hardest] <= 0)
			.sort(
				(a, b) =>
					Number(a.hasNegOnSelected) - Number(b.hasNegOnSelected) || b.defenseMax - a.defenseMax
			);
		for (const p of rest) out.push(p);
	} else {
		const met = part
			.filter((p) => !p.torsoInc)
			.sort(
				(a, b) =>
					Number(a.hasNegOnSelected) - Number(b.hasNegOnSelected) || b.defenseMax - a.defenseMax
			);
		for (const p of met) out.push(p);
	}

	for (const p of part) {
		if (p.torsoInc) out.push(p);
	}
	return out;
}

/** Prune when even the most optimistic remaining contribution can't meet a target. */
function pruned(ctx: SearchCtx, depth: number, ptsAfter: number[], slotsTotal: number): boolean {
	const remDirect = ctx.maxDirectSuffix[depth];
	const remSlots = ctx.maxSlotsSuffix[depth];
	const allSlots = slotsTotal + remSlots;
	for (let t = 0; t < ctx.relTrees.length; t++) {
		const upper = ptsAfter[t] + remDirect[t] + ctx.bestPPS[t] * allSlots;
		if (upper < ctx.targets[t]) return true;
	}
	// Joint bound: the total shortfall across trees must be coverable by slots
	// at the single best points-per-slot rate.
	let shortfall = 0;
	for (let t = 0; t < ctx.relTrees.length; t++) {
		const sf = ctx.targets[t] - ptsAfter[t] - remDirect[t];
		if (sf > 0) shortfall += sf;
	}
	if (shortfall > 0 && ctx.maxPPS * allSlots < shortfall) return true;
	return false;
}

export interface SearchParams {
	targets: SkillTarget[];
	charms: Charm[];
	includeNoCharm?: boolean;
	/** When set, adds auto-generated "possible" charms to the pool so results can
	 * report which charm each set requires. */
	possibleCharms?: PossibleCharmMode;
	settings: SearchSettings;
	maxResults?: number;
	nodeBudget?: number;
	/** Called whenever a new set enters the current best list (for live UI). */
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
	const decoByName = new Map<string, DecoOption>();
	for (const list of decoByTree.values()) {
		for (const o of list) decoByName.set(o.name, o);
	}
	const bestPPS = relTrees.map((tree) => {
		const opts = decoByTree.get(tree) ?? [];
		let best = 0;
		for (const o of opts) {
			const pps = o.points / o.size;
			if (pps > best) best = pps;
		}
		return best;
	});
	const maxPPS = bestPPS.reduce((a, b) => Math.max(a, b), 0);

	const prepared: PreparedCharm[] = [];
	for (const c of params.charms) {
		if (!c.included) continue;
		const vec = relTrees.map((t) => {
			let p = 0;
			if (c.skill1.tree === t) p += c.skill1.points;
			if (c.skill2 && c.skill2.tree === t) p += c.skill2.points;
			return p;
		});
		let total = 0;
		for (const v of vec) if (v > 0) total += v;
		prepared.push({
			id: c.id,
			name: c.name || '(unnamed charm)',
			slots: c.slots,
			vec,
			total,
			skill1: c.skill1,
			skill2: c.skill2,
			hypothetical: c.hypothetical
		});
	}

	if (params.possibleCharms) {
		for (const c of buildPossibleCharms(params.targets, params.possibleCharms)) {
			const vec = relTrees.map((t) => {
				let p = 0;
				if (c.skill1.tree === t) p += c.skill1.points;
				if (c.skill2 && c.skill2.tree === t) p += c.skill2.points;
				return p;
			});
			let total = 0;
			for (const v of vec) if (v > 0) total += v;
			prepared.push({
				id: c.id,
				name: c.name || '(possible charm)',
				slots: c.slots,
				vec,
				total,
				skill1: c.skill1,
				skill2: c.skill2,
				hypothetical: true
			});
		}
	}

	const charms = pruneCharms(prepared);

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
		maxPPS,
		decoByTree,
		decoByName,
		decoTables: new Map(),
		baseSlots: params.settings.weaponSlots,
		results: [],
		found: 0,
		nodeBudget: params.nodeBudget ?? 60_000_000,
		maxResults: params.maxResults ?? 400,
		nodes: 0,
		budgetHit: false,
		onResult: params.onResult
	};

	const progress: SearchProgress = { phase: 'Preparing…', nodes: 0, found: 0, done: false };
	onProgress?.({ ...progress });

	const charmList: PreparedCharm[] = [];
	for (const charm of charms) {
		if (pruned(ctx, 0, charm.vec, ctx.baseSlots + charm.slots)) continue;
		charmList.push(charm);
	}
	if (params.includeNoCharm) {
		charmList.push({
			id: '__nocharm',
			name: 'No charm',
			slots: 0,
			vec: relTrees.map(() => 0),
			total: 0,
			skill1: { tree: '', points: 0 },
			skill2: null
		});
	}

	if (charms.length > 0) {
		progress.phase = `Pruned ${charms.length} charm${charms.length === 1 ? '' : 's'}`;
		onProgress?.({ ...progress });
	}

	for (const charm of charmList) {
		if (signal?.aborted) {
			progress.done = true;
			progress.phase = 'Aborted';
			onProgress?.({ ...progress });
			return ctx.results;
		}
		progress.phase = charm.id === '__nocharm' ? 'Searching (no charm)' : `Searching ${charm.name}`;
		onProgress?.({ ...progress });
		await searchCharm(ctx, charm, onProgress, signal, progress);
	}

	progress.done = true;
	progress.phase = ctx.budgetHit ? 'Stopped (combination limit)' : 'Done';
	progress.nodes = ctx.nodes;
	progress.found = ctx.found;
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

	while (stack.length > 0) {
		if (++ctx.nodes > ctx.nodeBudget) {
			ctx.budgetHit = true;
			if (progress) progress.phase = 'Stopped (node limit reached)';
			return;
		}
		if (ctx.nodes % YIELD_EVERY === 0) {
			await tick();
			if (progress) {
				progress.nodes = ctx.nodes;
				progress.found = ctx.found;
			}
			onProgress?.({ ...progress! });
			if (signal?.aborted) return;
		}

		const frame = stack.pop()!;
		if (frame.depth === 5) {
			const core = leafCore(ctx, charm, frame.pieces, frame.slots);
			if (core) {
				ctx.found++;
				// Only build the full result when it can still make the top list.
				// While the list isn't full every valid set is kept; once full,
				// only sets that can displace the current worst are built.
				if (
					ctx.results.length < ctx.maxResults ||
					core.defense >= ctx.results[ctx.results.length - 1].defenseSumMax
				) {
					const res = buildResult(ctx, charm, frame.pieces, frame.slots, core);
					if (pushTop(ctx.results, res, ctx.maxResults)) {
						ctx.onResult?.(res);
					}
				}
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
