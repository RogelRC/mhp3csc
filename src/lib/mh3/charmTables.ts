// Lookup of which official MHP3rd charm tables contain a given talisman.
// Data comes from the generated charmTableMembers.ts (mhp3db dump).

import { CHARM_TREE_NAMES } from './charmTable';
import { CHARM_PROFILE_TABLES } from './charmTableMembers';

export const CHARM_TABLE_COUNT = 12;

/**
 * Tables (1-12) where this exact talisman profile (skills, points and slots)
 * can be obtained, or null when the profile is not in the charm database
 * or its skill trees are unknown.
 */
export function charmProfileTables(charm: {
	skill1: { tree: string; points: number };
	skill2: { tree: string; points: number } | null;
	slots: number;
}): number[] | null {
	const treeIndex = (tree: string): number => CHARM_TREE_NAMES.indexOf(tree);
	const s1 = charm.skill1;
	const s2Tree = charm.skill2?.tree ?? '';
	const s2Points = s2Tree ? (charm.skill2?.points ?? 0) : 0;
	const t1 = s1.tree ? treeIndex(s1.tree) : -1;
	const t2 = s2Tree ? treeIndex(s2Tree) : -1;
	if ((s1.tree && t1 < 0) || (s2Tree && t2 < 0)) return null;
	const key = `${t1}|${t1 < 0 ? 0 : s1.points}|${t2}|${t2 < 0 ? 0 : s2Points}|${charm.slots}`;
	const mask = CHARM_PROFILE_TABLES[key];
	if (mask == null) return null;
	const tables: number[] = [];
	for (let i = 0; i < CHARM_TABLE_COUNT; i++) {
		if (mask & (1 << i)) tables.push(i + 1);
	}
	return tables;
}
