// Must match gameData.ts TORSO_INC_TREE so imported Torso Inc charms resolve correctly.
const TORSO_INC_TREE = 'Torso Inc';

export interface CharmSkillDef {
	/** The charm skill code as stored in the save (1-100). */
	code: number;
	/** Japanese skill name as shown in-game. */
	jp: string;
	/** The app skill-tree name it maps to, or null when no tree exists (e.g. Observation). */
	tree: string | null;
}

/**
 * Charm skill code -> skill tree mapping for MHP3rd.
 *
 * Codes 1-67 are the canonical list from Japanese wiki sources; codes 68-100 were
 * reconstructed by cross-mapping every code against the 99 named skill trees in the
 * app data and validating the result is a perfect 1:1 fit (every tree except Awaken
 * maps to exactly one charm code). Code 0 means "no skill" and is handled by the
 * parser.
 */
export const CHARM_SKILL_TABLE: readonly CharmSkillDef[] = [
	{ code: 1, jp: '胴系统倍加', tree: TORSO_INC_TREE },
	{ code: 2, jp: '毒', tree: 'Poison' },
	{ code: 3, jp: '麻痹', tree: 'Paralysis' },
	{ code: 4, jp: '睡眠', tree: 'Sleep' },
	{ code: 5, jp: '气绝', tree: 'Stun' },
	{ code: 6, jp: '耐泥耐雪', tree: 'Mud/Snow' },
	{ code: 7, jp: '气配', tree: 'Sense' },
	{ code: 8, jp: '体力', tree: 'Health' },
	{ code: 9, jp: '回复速度', tree: 'Rec Speed' },
	{ code: 10, jp: '锋利度', tree: 'Sharpness' },
	{ code: 11, jp: '匠', tree: 'Artisan' },
	{ code: 12, jp: '剑术', tree: 'Fencing' },
	{ code: 13, jp: '达人', tree: 'Expert' },
	{ code: 14, jp: '研磨师', tree: 'Sharpener' },
	{ code: 15, jp: '防御性能', tree: 'Guard' },
	{ code: 16, jp: '防御强化', tree: 'Guard Up' },
	{ code: 17, jp: '自动防御', tree: 'Auto-Guard' },
	{ code: 18, jp: '装填速度', tree: 'Reload Spd' },
	{ code: 19, jp: '反动', tree: 'Recoil' },
	{ code: 20, jp: '通常弹强化', tree: 'NormalS Up' },
	{ code: 21, jp: '贯通弹强化', tree: 'PierceS Up' },
	{ code: 22, jp: '散弹强化', tree: 'PelletS Up' },
	{ code: 23, jp: '通常弹追加', tree: 'NormalSAdd' },
	{ code: 24, jp: '贯通弹追加', tree: 'PierceSAdd' },
	{ code: 25, jp: '散弹追加', tree: 'PelletSAdd' },
	{ code: 26, jp: '榴弹追加', tree: 'Crag S Add' },
	{ code: 27, jp: '扩散弹追加', tree: 'ClustS Add' },
	{ code: 28, jp: '特殊攻击', tree: 'Status' },
	{ code: 29, jp: '属性攻击', tree: 'Elemental' },
	{ code: 30, jp: '爆弹强化', tree: 'BombStrUp' },
	{ code: 31, jp: '饥饿', tree: 'Hunger' },
	{ code: 32, jp: '贪食鬼', tree: 'Gluttony' },
	{ code: 33, jp: '攻击', tree: 'Attack' },
	{ code: 34, jp: '防御', tree: 'Defense' },
	{ code: 35, jp: '加护', tree: 'Protection' },
	{ code: 36, jp: '听觉保护', tree: 'HearProtct' },
	{ code: 37, jp: '偷盗无效', tree: 'Anti-Theft' },
	{ code: 38, jp: '广域', tree: 'Wide Area' },
	{ code: 39, jp: '搬运', tree: 'Backpackng' },
	{ code: 40, jp: '火耐性', tree: 'Fire Res' },
	{ code: 41, jp: '水耐性', tree: 'Water Res' },
	{ code: 42, jp: '雷耐性', tree: 'ThunderRes' },
	{ code: 43, jp: '冰耐性', tree: 'Ice Res' },
	{ code: 44, jp: '龙耐性', tree: 'Dragon Res' },
	{ code: 45, jp: '耐暑', tree: 'Heat Res' },
	{ code: 46, jp: '耐寒', tree: 'Cold Res' },
	{ code: 47, jp: '风压', tree: 'WindPress' },
	{ code: 48, jp: '采取', tree: 'Gathering' },
	{ code: 49, jp: '高速收集', tree: 'HiSpdGathr' },
	{ code: 50, jp: '反复无常', tree: 'Whim' },
	{ code: 51, jp: '运气', tree: 'Fate' },
	{ code: 52, jp: '千里眼', tree: 'Psychic' },
	{ code: 53, jp: '回复量', tree: 'Rec Level' },
	{ code: 54, jp: '调和成功率', tree: 'Combo Rate' },
	{ code: 55, jp: '调和数', tree: 'Shot Mix' },
	{ code: 56, jp: '回避性能', tree: 'Evasion' },
	{ code: 57, jp: '底力', tree: 'Potential' },
	{ code: 58, jp: '效果持续', tree: 'LastingPwr' },
	{ code: 59, jp: '耐力', tree: 'Constitutn' },
	{ code: 60, jp: '装填数', tree: 'Loading' },
	{ code: 61, jp: '精密射击', tree: 'Precision' },
	{ code: 62, jp: '食事', tree: 'Eating' },
	{ code: 63, jp: '剥取', tree: 'Carving' },
	{ code: 64, jp: '耐震', tree: 'Quake Res' },
	{ code: 65, jp: '回避距离', tree: 'Evade Dist' },
	{ code: 66, jp: '拔刀会心', tree: 'Crit Draw' },
	{ code: 67, jp: '高速设置', tree: 'SpeedSetup' },
	{ code: 68, jp: '体术', tree: 'Stamina' },
	{ code: 69, jp: '捕获', tree: 'Perception' },
	{ code: 70, jp: '观察眼', tree: null },
	{ code: 71, jp: '蓄力缩短', tree: 'FastCharge' },
	{ code: 72, jp: '拔刀减气', tree: 'PunishDraw' },
	{ code: 73, jp: '属性耐性', tree: 'Blight Res' },
	{ code: 74, jp: '逆境', tree: 'Adversity' },
	{ code: 75, jp: '速射', tree: 'Rapid Fire' },
	{ code: 76, jp: '大粪', tree: 'DungMaster' },
	{ code: 77, jp: '抗菌', tree: 'Antiseptic' },
	{ code: 78, jp: '毒瓶追加', tree: 'PoisonCAdd' },
	{ code: 79, jp: '麻痹瓶追加', tree: 'ParalyCAdd' },
	{ code: 80, jp: '睡眠瓶追加', tree: 'SleepCAdd' },
	{ code: 81, jp: '强击瓶追加', tree: 'PowerCAdd' },
	{ code: 82, jp: '接击瓶追加', tree: 'RazorCAdd' },
	{ code: 83, jp: '笛', tree: 'Horn' },
	{ code: 84, jp: '炮术', tree: 'Gunnery' },
	{ code: 85, jp: '本气', tree: 'Rewards' },
	{ code: 86, jp: '狩人', tree: 'Huntsman' },
	{ code: 87, jp: '对防御DOWN', tree: 'Fortitude' },
	{ code: 88, jp: '火属性攻击', tree: 'Fire Atk' },
	{ code: 89, jp: '水属性攻击', tree: 'Water Atk' },
	{ code: 90, jp: '雷属性攻击', tree: 'Thundr Atk' },
	{ code: 91, jp: '冰属性攻击', tree: 'Ice Attack' },
	{ code: 92, jp: '龙属性攻击', tree: 'Dragon Atk' },
	{ code: 93, jp: '斩裂弹追加', tree: 'CutterSAdd' },
	{ code: 94, jp: '减气瓶追加', tree: 'FatigeCAdd' },
	{ code: 95, jp: '痛击', tree: 'Debilitate' },
	{ code: 96, jp: '重击', tree: 'Slam' },
	{ code: 97, jp: 'KO', tree: 'KO' },
	{ code: 98, jp: '减气攻击', tree: 'FatigueAtk' },
	{ code: 99, jp: '纳刀', tree: 'Sheathe' },
	{ code: 100, jp: '气力回复', tree: 'Will Recov' }
];

const charmSkillByCode = new Map<number, CharmSkillDef>();
for (const def of CHARM_SKILL_TABLE) charmSkillByCode.set(def.code, def);

/** Look up the app skill-tree name for a charm skill code, or null if unknown/unmapped. */
export function charmSkillTree(code: number): string | null {
	const def = charmSkillByCode.get(code);
	return def ? def.tree : null;
}
