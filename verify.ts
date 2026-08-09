import { armors, decorations, PARTS } from './src/lib/gameData';
import { buildPreparedPieces, dominancePrune, runSearch } from './src/lib/search';
import type { PreparedPiece } from './src/lib/search';
import type { ArmorPiece, Charm, SkillTarget } from './src/lib/types';

// --- Small independent instance (top 8 per part, blademaster, not female) ---
const subset: ArmorPiece[] = [];
for (const part of PARTS) {
	const list = armors
		.filter((a) => a.part === part && a.gender !== 'Female' && a.hunterType !== 'Gunner')
		.sort((a, b) => a.name.localeCompare(b.name))
		.slice(0, 8);
	subset.push(...list);
}
console.log(
	'subset per part:',
	PARTS.map((p) => subset.filter((a) => a.part === p).length).join(',')
);

const baseCharms: Charm[] = [
	{
		id: 'c1',
		name: 'atk+5',
		slots: 0,
		skill1: { tree: 'Attack', points: 5 },
		skill2: null,
		included: true
	},
	{
		id: 'c2',
		name: 'atk+10 1s',
		slots: 1,
		skill1: { tree: 'Attack', points: 10 },
		skill2: null,
		included: true
	},
	{
		id: 'c3',
		name: 'exp+10',
		slots: 2,
		skill1: { tree: 'Expert', points: 10 },
		skill2: null,
		included: true
	},
	{
		id: 'c4',
		name: 'atk+5 exp+5',
		slots: 0,
		skill1: { tree: 'Attack', points: 5 },
		skill2: { tree: 'Expert', points: 5 },
		included: true
	},
	{
		id: 'c5',
		name: 'junk',
		slots: 0,
		skill1: { tree: 'Handicraft', points: 5 },
		skill2: null,
		included: true
	}
];

// --- Independent validity: direct points + per-tree min slots to cover deficits ---
function minSlotsFor(tree: string): number[] {
	const maxSlots = 24;
	const dp = new Int32Array(maxSlots + 1).fill(-1);
	dp[0] = 0;
	for (const d of decorations) {
		const s = d.skills.find((x) => x.skillTree === tree && x.points > 0);
		if (!s) continue;
		for (let sl = 0; sl <= maxSlots - d.slots; sl++) {
			if (dp[sl] < 0) continue;
			const np = dp[sl] + s.points;
			if (np > dp[sl + d.slots]) dp[sl + d.slots] = np;
		}
	}
	const minSlots: number[] = [];
	let best = 0;
	for (let need = 0; need <= 30; need++) {
		while (best < maxSlots && dp[best] < need) best++;
		minSlots.push(dp[best] >= need ? best : Infinity);
	}
	return minSlots;
}

function charmVec(c: Charm, relTrees: string[]): number[] {
	return relTrees.map((t) => {
		let p = 0;
		if (c.skill1.tree === t) p += c.skill1.points;
		if (c.skill2 && c.skill2.tree === t) p += c.skill2.points;
		return p;
	});
}
// Replicate the search's charm pruning: dominated charms are dropped.
function pruneCharmsList(charms: Charm[], relTrees: string[]): { kept: Charm[]; removed: Charm[] } {
	const seen = new Set<string>();
	const uniq: Charm[] = [];
	for (const c of charms) {
		const sig = `${c.slots}|${charmVec(c, relTrees).join(',')}`;
		if (seen.has(sig)) continue;
		seen.add(sig);
		uniq.push(c);
	}
	const kept: Charm[] = [];
	const removed: Charm[] = [];
	for (const a of uniq) {
		let dom = false;
		for (const b of uniq) {
			if (b === a) continue;
			if (b.slots < a.slots) continue;
			let ge = true;
			let strict = false;
			const bv = charmVec(b, relTrees);
			const av = charmVec(a, relTrees);
			for (let t = 0; t < av.length; t++) {
				if (bv[t] < av[t]) {
					ge = false;
					break;
				}
				if (bv[t] > av[t]) strict = true;
			}
			if (!ge) continue;
			if (b.slots > a.slots) strict = true;
			if (strict) {
				dom = true;
				break;
			}
		}
		if (dom) removed.push(a);
		else kept.push(a);
	}
	return { kept, removed };
}
function dominatedByKept(c: Charm, kept: Charm[], relTrees: string[]): boolean {
	for (const b of kept) {
		if (b.slots < c.slots) continue;
		let ge = true;
		let strict = false;
		const bv = charmVec(b, relTrees);
		const cv = charmVec(c, relTrees);
		for (let t = 0; t < cv.length; t++) {
			if (bv[t] < cv[t]) {
				ge = false;
				break;
			}
			if (bv[t] > cv[t]) strict = true;
		}
		if (!ge) continue;
		if (b.slots > c.slots) strict = true;
		if (strict) return true;
	}
	return false;
}
function dominatedBySurvivors(p: PreparedPiece, list: PreparedPiece[]): boolean {
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
		if (allGe && (q.slots > p.slots || q.defenseMax > p.defenseMax || q.totalPos > p.totalPos))
			return true;
	}
	return false;
}

function pointsFor(combo: PreparedPiece[], relTrees: string[], tree: string): number {
	const body = combo[1];
	const bodySkill = body && !body.torsoInc ? body.vec[relTrees.indexOf(tree)] : 0;
	let total = 0;
	for (const p of combo) {
		if (p.torsoInc) total += bodySkill;
		else total += p.vec[relTrees.indexOf(tree)];
	}
	return total;
}

async function runScenario(
	name: string,
	targets: SkillTarget[],
	weaponSlots: number,
	charms: Charm[]
) {
	const relTrees = targets.map((t) => t.tree);
	const atkMin = minSlotsFor('Attack');
	const expMin = minSlotsFor('Expert');
	const minOf = (tree: string): number[] =>
		tree === 'Attack' ? atkMin : tree === 'Expert' ? expMin : [];

	const { kept: keptCharms, removed: removedCharms } = pruneCharmsList(charms, relTrees);
	console.log(
		`\n[${name}] charm pruning: ${removedCharms.map((c) => c.name).join(', ') || 'none'}`
	);
	console.log(`[${name}] kept charms: ${keptCharms.map((c) => c.name).join(', ')}`);
	if (!removedCharms.every((r) => dominatedByKept(r, keptCharms, relTrees))) {
		console.log(`[${name}] charm dominance: BUG!`);
		process.exit(1);
	}

	const preparedByPart = buildPreparedPieces(subset, relTrees, {
		weaponSlots,
		gender: 'Any',
		hunterType: 'Blademaster',
		maxRarity: null,
		maxHr: null
	});
	const prunedByPart = preparedByPart.map((list) => dominancePrune(list));
	console.log(`[${name}] pruned per part: ${prunedByPart.map((l) => l.length).join(',')}`);
	for (let d = 0; d < preparedByPart.length; d++) {
		for (const p of preparedByPart[d]) {
			if (!prunedByPart[d].includes(p) && !dominatedBySurvivors(p, prunedByPart[d])) {
				console.log(`[${name}] NOT DOMINATED: part ${p.part} ${p.name} — dominance BUG!`);
				process.exit(1);
			}
		}
	}

	let bruteCount = 0;
	for (const a0 of prunedByPart[0])
		for (const a1 of prunedByPart[1])
			for (const a2 of prunedByPart[2])
				for (const a3 of prunedByPart[3])
					for (const a4 of prunedByPart[4]) {
						const combo = [a0, a1, a2, a3, a4];
						const armorSlots = combo.reduce((s, p) => s + p.slots, 0);
						for (const c of keptCharms) {
							const slots = weaponSlots + c.slots + armorSlots;
							let need = 0;
							for (const t of targets) {
								let pts = pointsFor(combo, relTrees, t.tree);
								if (c.skill1.tree === t.tree) pts += c.skill1.points;
								if (c.skill2?.tree === t.tree) pts += c.skill2.points;
								const d = Math.max(0, t.points - pts);
								need += minOf(t.tree)[d] ?? Infinity;
							}
							if (need <= slots) bruteCount++;
						}
					}

	let found = 0;
	let nodes = 0;
	await runSearch(
		{
			targets,
			charms,
			includeNoCharm: false,
			settings: {
				weaponSlots,
				gender: 'Any',
				hunterType: 'Blademaster',
				maxRarity: null,
				maxHr: null
			},
			maxResults: 100000
		},
		{ armors: subset, decorations },
		(p) => {
			found = p.found;
			nodes = p.nodes;
		}
	);

	console.log(`[${name}] brute force valid (charm,combo) pairs: ${bruteCount}`);
	console.log(`[${name}] search found: ${found} (${nodes} nodes)`);
	console.log(
		bruteCount === found
			? `[${name}] PASS: completeness matches brute force`
			: `[${name}] FAIL: mismatch!`
	);
}

await runScenario(
	'atk10 exp10 (weapon3)',
	[
		{ name: 'Attack Up', tree: 'Attack', points: 10 },
		{ name: 'Expert', tree: 'Expert', points: 10 }
	],
	3,
	baseCharms
);

// Tighten targets so the branch-and-bound pruning actually bites.
await runScenario(
	'atk13 exp13 (weapon1)',
	[
		{ name: 'Attack Up', tree: 'Attack', points: 13 },
		{ name: 'Expert', tree: 'Expert', points: 13 }
	],
	1,
	baseCharms
);

// Even tighter: one very hard target that the pruning bound must navigate.
await runScenario(
	'atk15 (weapon0)',
	[{ name: 'Attack Up', tree: 'Attack', points: 15 }],
	0,
	baseCharms
);
