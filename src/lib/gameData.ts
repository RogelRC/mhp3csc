import armorsJson from '../mhp3_json/armors.json';
import skillsJson from '../mhp3_json/skills.json';
import skillTreesJson from '../mhp3_json/skill_trees.json';
import decorationsJson from '../mhp3_json/decorations.json';
import tagsJson from '../mhp3_json/tags.json';
import type { ArmorPiece, ArmorPart, Decoration, SkillEntry, SkillTree } from './types';

export const PARTS: ArmorPart[] = ['Head', 'Body', 'Arms', 'Waist', 'Legs'];

export const armors = armorsJson as ArmorPiece[];
export const skills = skillsJson as SkillEntry[];
export const skillTrees = skillTreesJson as SkillTree[];
export const decorations = decorationsJson as Decoration[];
export const tags = tagsJson as string[];

export const TORSO_INC_TREE = 'Torso Up';

/** Formats skill points with an explicit sign, e.g. "+10" or "-9". */
export function formatSkillPoints(points: number): string {
	return points >= 0 ? `+${points}` : `${points}`;
}

/** Map from tree name to the positive thresholds available on that tree (e.g. [10, 15, 20]). */
const thresholdsCache = new Map<string, number[]>();
export function treePositiveThresholds(tree: string): number[] {
	let cached = thresholdsCache.get(tree);
	if (cached) return cached;
	const t = skillTrees.find((s) => s.name === tree);
	if (!t) {
		cached = [];
	} else {
		cached = t.skills
			.filter((s) => s.points > 0)
			.map((s) => s.points)
			.sort((a, b) => a - b);
	}
	thresholdsCache.set(tree, cached);
	return cached;
}

const negativeThresholdsCache = new Map<string, number[]>();
export function treeNegativeThresholds(tree: string): number[] {
	let cached = negativeThresholdsCache.get(tree);
	if (cached) return cached;
	const t = skillTrees.find((s) => s.name === tree);
	if (!t) {
		cached = [];
	} else {
		cached = t.skills
			.filter((s) => s.points < 0)
			.map((s) => s.points)
			.sort((a, b) => a - b);
	}
	negativeThresholdsCache.set(tree, cached);
	return cached;
}

/** Activated (positive) skills indexed by tree. */
export const skillByTreeAndPoints = new Map<string, Map<number, string>>();
for (const s of skills) {
	if (s.points === null) continue;
	let byPts = skillByTreeAndPoints.get(s.skillTree);
	if (!byPts) {
		byPts = new Map();
		skillByTreeAndPoints.set(s.skillTree, byPts);
	}
	byPts.set(s.points, s.name);
}

/** Index armor pieces by part. */
export const armorsByPart = new Map<ArmorPart, ArmorPiece[]>();
for (const part of PARTS) armorsByPart.set(part, []);
for (const a of armors) {
	armorsByPart.get(a.part)!.push(a);
}

export const SKILL_TREE_NAMES = skillTrees.map((t) => t.name).sort((a, b) => a.localeCompare(b));

/** All selectable positive skills (name, tree, points), grouped by tree. */
export const positiveSkillsByTree = skillTrees.map((t) => ({
	tree: t.name,
	skills: t.skills.filter((s) => s.points > 0).sort((a, b) => a.points - b.points)
}));

/** All skills flat, for the picker. */
export const allPositiveSkills = positiveSkillsByTree
	.flatMap((g) => g.skills.map((s) => ({ name: s.name, tree: g.tree, points: s.points })))
	.sort((a, b) => a.tree.localeCompare(b.tree) || a.points - b.points);

/** Athena-style skill categories used to filter the skill picker. */
export const SKILL_CATEGORIES = [
	'Misc',
	'Offensive',
	'Defensive',
	'Blademaster',
	'Bow/Gunner',
	'Farming',
	'Resistance'
] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

const treeCategoryCache = new Map<string, string>();
/**
 * Category of a skill tree, derived from the tag on its positive skills
 * (from the source data). Trees without a tag fall back to "Misc".
 */
export function treeCategory(tree: string): string {
	let cached = treeCategoryCache.get(tree);
	if (cached) return cached;
	const tagged = skills.find((s) => s.skillTree === tree && (s.points ?? 0) > 0 && s.tag);
	cached = tagged?.tag ?? 'Misc';
	treeCategoryCache.set(tree, cached);
	return cached;
}

export interface DecorationSummary {
	name: string;
	size: number;
	points: number;
	negOnSelected: boolean;
}

/**
 * For a tree, the best decoration by (size, points). Used by the solver.
 */
export function buildDecoIndex(selectedTrees: Set<string>): Map<string, DecorationSummary[]> {
	const out = new Map<string, DecorationSummary[]>();
	for (const d of decorations) {
		for (const s of d.skills) {
			if (s.points <= 0) continue;
			const list = out.get(s.skillTree) ?? [];
			const negOnSelected = d.skills.some((x) => x.points < 0 && selectedTrees.has(x.skillTree));
			list.push({ name: d.name, size: d.slots, points: s.points, negOnSelected });
			out.set(s.skillTree, list);
		}
	}
	// Prefer cleaner (no negative on selected trees) decorations first, then higher points-per-slot.
	for (const list of out.values()) {
		list.sort((a, b) => {
			if (a.negOnSelected !== b.negOnSelected) return a.negOnSelected ? 1 : -1;
			const effA = a.points / a.size;
			const effB = b.points / b.size;
			if (effA !== effB) return effB - effA;
			return b.points - a.points;
		});
	}
	return out;
}

export const TORSO_INC_PIECE = (piece: ArmorPiece): boolean =>
	piece.skills.some((s) => s.skillTree === TORSO_INC_TREE);
