import { armors } from './src/lib/gameData';
import { buildPreparedPieces, dominancePrune } from './src/lib/search';
import type { SearchSettings } from './src/lib/types';

const settings: SearchSettings = {
	weaponSlots: 3,
	gender: 'Any',
	hunterType: 'Blademaster',
	maxRarity: null,
	maxHr: null
};

const scenarios = {
	'Attack+10 Evasion+10': ['Attack', 'Evasion'],
	'Atk10 Exp10 Handi10': ['Attack', 'Expert', 'Handicraft'],
	'5 skills x10': ['Attack', 'Expert', 'Evasion', 'Handicraft', 'Sharpness'],
	'Handicraft+15': ['Handicraft']
};

for (const [label, trees] of Object.entries(scenarios)) {
	const pieces = buildPreparedPieces(armors, trees, settings);
	const pruned = pieces.map(dominancePrune);
	const raw = pieces.map((p) => p.length);
	const pr = pruned.map((p) => p.length);
	const rawProd = raw.reduce((a, b) => a * b, 1);
	const prProd = pr.reduce((a, b) => a * b, 1);
	console.log(`${label}`);
	console.log('  raw counts:', raw.join(', '), ' product:', rawProd.toLocaleString());
	console.log('  pruned counts:', pr.join(', '), ' product:', prProd.toLocaleString());
}
