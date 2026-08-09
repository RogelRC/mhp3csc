export type ArmorPart = 'Head' | 'Body' | 'Arms' | 'Waist' | 'Legs';

export interface SkillEntry {
	name: string;
	skillTree: string;
	points: number | null;
	hunterType?: string;
	tag?: string;
	order?: number;
}

export interface SkillTreeSkill {
	name: string;
	points: number;
}

export interface SkillTree {
	name: string;
	skills: SkillTreeSkill[];
}

export interface ArmorPiece {
	name: string;
	part: ArmorPart;
	gender: 'Both' | 'Male' | 'Female';
	hunterType: 'Both' | 'Blademaster' | 'Gunner';
	rarity: number;
	slots: number;
	hrRequired: number;
	villageStarsRequired: number;
	defenseBase: number;
	defenseMax: number;
	resistances: { fire: number; water: number; ice: number; thunder: number; dragon: number };
	skills: { skillTree: string; points: number }[];
	materials: { name: string; quantity: number }[];
}

export interface Decoration {
	name: string;
	rarity: number;
	slots: number;
	hrRequired: number;
	villageStarsRequired: number;
	skills: { skillTree: string; points: number }[];
	recipes: { name: string; quantity: number }[][];
}

export interface CharmSkill {
	tree: string;
	points: number;
}

export interface Charm {
	id: string;
	name: string;
	slots: number;
	skill1: CharmSkill;
	skill2: CharmSkill | null;
	included: boolean;
}

export interface SkillTarget {
	name: string;
	tree: string;
	points: number;
}

export interface SearchSettings {
	weaponSlots: number;
	gender: 'Any' | 'Male' | 'Female';
	hunterType: 'Blademaster' | 'Gunner';
	maxRarity: number | null;
	maxHr: number | null;
}

export interface DecorUse {
	name: string;
	count: number;
}

export interface SetPiece {
	name: string;
	part: ArmorPart;
	slots: number;
	defenseBase: number;
	defenseMax: number;
	rarity: number;
	hrRequired: number;
	isTorsoInc: boolean;
}

export interface ActivatedSkill {
	name: string;
	tree: string;
	points: number;
}

export interface SetResult {
	pieces: SetPiece[];
	charm: {
		id: string;
		name: string;
		slots: number;
		skill1: CharmSkill;
		skill2: CharmSkill | null;
	} | null;
	weaponSlots: number;
	decorations: DecorUse[];
	usedSlots: number;
	totalSlots: number;
	treePoints: { tree: string; points: number }[];
	activated: ActivatedSkill[];
	negativeActivated: ActivatedSkill[];
	defenseSumMax: number;
	allTargetsMet: boolean;
}

export interface SearchProgress {
	phase: string;
	nodes: number;
	found: number;
	done: boolean;
	aborted?: boolean;
}
