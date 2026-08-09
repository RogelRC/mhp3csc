import { armors, decorations } from './src/lib/gameData';
import { runSearch } from './src/lib/search';
import type { Charm, SearchProgress, SearchSettings } from './src/lib/types';

const settings: SearchSettings = {
	weaponSlots: 3,
	gender: 'Any',
	hunterType: 'Blademaster',
	maxRarity: null,
	maxHr: null
};

function makeCharms(count: number): Charm[] {
	const out: Charm[] = [];
	const trees = ['Attack', 'Expert', 'Evasion', 'Handicraft', 'Sharpness', 'Sharpener'];
	for (let i = 0; i < count; i++) {
		const t = trees[i % trees.length];
		const pts = 3 + ((i * 7) % 10);
		out.push({
			id: `c${i}`,
			name: `charm ${i}`,
			slots: i % 3,
			skill1: { tree: t, points: pts },
			skill2:
				i % 2 === 0 ? { tree: trees[(i + 2) % trees.length], points: 2 + ((i * 5) % 8) } : null,
			included: true
		});
	}
	return out;
}

let lastPhase = '';
let lastProgress: SearchProgress | null = null;

async function bench(
	label: string,
	targets: { tree: string; points: number }[],
	charmCount: number
) {
	const t0 = performance.now();
	const charms = makeCharms(charmCount);
	const res = await runSearch(
		{ targets, charms, includeNoCharm: false, settings, maxResults: 400 },
		{ armors, decorations },
		(p) => {
			lastPhase = p.phase;
			lastProgress = { ...p };
		}
	);
	const dt = (performance.now() - t0) / 1000;
	console.log(
		`${label}: ${res.length} shown, ${lastPhase}, ${dt.toFixed(2)}s, nodes=${lastProgress?.nodes}, found=${lastProgress?.found}`
	);
}

await bench(
	'A: Attack+10, Evasion+10',
	[
		{ tree: 'Attack', points: 10 },
		{ tree: 'Evasion', points: 10 }
	],
	1000
);
await bench(
	'B: Atk10 Exp10 Handi10',
	[
		{ tree: 'Attack', points: 10 },
		{ tree: 'Expert', points: 10 },
		{ tree: 'Handicraft', points: 10 }
	],
	1000
);
await bench(
	'C: Attack+15, Expert+15',
	[
		{ tree: 'Attack', points: 15 },
		{ tree: 'Expert', points: 15 }
	],
	1000
);
await bench(
	'D: 4 skills x10',
	[
		{ tree: 'Attack', points: 10 },
		{ tree: 'Expert', points: 10 },
		{ tree: 'Evasion', points: 10 },
		{ tree: 'Handicraft', points: 10 }
	],
	1000
);
await bench('E: Handicraft+15 only', [{ tree: 'Handicraft', points: 15 }], 1000);
await bench(
	'F: 5 skills x10',
	[
		{ tree: 'Attack', points: 10 },
		{ tree: 'Expert', points: 10 },
		{ tree: 'Evasion', points: 10 },
		{ tree: 'Handicraft', points: 10 },
		{ tree: 'Sharpness', points: 10 }
	],
	1000
);
