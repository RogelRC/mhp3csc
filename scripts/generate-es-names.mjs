// Generates src/mhp3_json/es-names.json: English -> Spanish name mappings for
// every game entity shown by the UI.
//
// Sources:
//  - Armor/component/decoration names come from Athena's ASS language packs
//    (Run/Data base files aligned positionally with "Español (Team Hunters 404)").
//  - Skill/tree/tag translations follow the same community glossary, authored
//    below (their skills.txt grouping can't be joined reliably by position).
//
// Usage: node scripts/generate-es-names.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'src/lib/i18n/es-names.json');
const cacheDir = process.env.MHP3_ATHENA_CACHE ?? 'C:/Users/Rogel/AppData/Local/Temp/opencode';
const BASE = 'https://raw.githubusercontent.com/AthenaADP/MHP3-ASS/master/Run/Data';
const PART_FILES = ['head', 'arms', 'body', 'waist', 'legs'];

async function ensureCached(kind, file) {
	const dir = path.join(cacheDir, kind === 'es' ? 'athena-es' : 'athena-en');
	const dest = path.join(dir, file);
	if (existsSync(dest)) return dest;
	if (!existsSync(dir)) await import('node:fs').then((m) => m.mkdirSync(dir, { recursive: true }));
	const url =
		kind === 'es'
			? `${BASE}/Languages/Espa%C3%B1ol%20(Team%20Hunters%20404)/${file}`
			: `${BASE}/${file}`;
	console.log(`downloading ${url}`);
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${res.status} for ${url}`);
	writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
	return dest;
}

function readLines(kind, file, { skipHeader = false } = {}) {
	const raw = readFileSync(path.join(cacheDir, kind === 'es' ? 'athena-es' : 'athena-en', file));
	let text = raw.toString('utf8').replace(/^\uFEFF/, '');
	return text
		.split(/\r?\n/)
		.filter((l) => l.trim() && !l.startsWith('#'))
		.slice(skipHeader ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Authored glossary (community Spanish, Team Hunters 404 vocabulary)
// ---------------------------------------------------------------------------

const TREES_ES = {
	Attack: 'Ataque',
	Expert: 'Experto',
	Sharpness: 'Afilado',
	Sharpener: 'Afilador',
	Handicraft: 'Artesano',
	PunishDraw: 'Desenvaine',
	'Crit Draw': 'Desenv. crít.',
	FastCharge: 'Concentración',
	Fencing: 'Esgrima',
	Tenderizer: 'Objetivo',
	Destroyer: 'GolpePes.',
	KO: 'KO',
	'Stam Drain': 'Atq.Fatiga',
	Maestro: 'Cuerno',
	Artillery: 'Artillería',
	'Gloves Off': 'Determin.',
	Potential: 'Potencial',
	Survivor: 'Sobreviv.',
	Loading: 'Carga',
	'Rapid Fire': 'Fue.Rapido',
	'Reload Speed': 'Vel.recarg',
	Recoil: 'Retroceso',
	Precision: 'Precisión',
	'Normal Up': 'SubirDNorm',
	'Pierce Up': 'SubirDPerf',
	'Pellet Up': 'SubirDPerd',
	'Normal S+': 'AñDNormal',
	'Pierce S+': 'AñDPerf',
	'Pellet S+': 'AñDPerd',
	'Crag S+': 'AñDispBomb',
	'Clust S+': 'AñDispGr',
	'Slice S+': 'Atq espec.',
	'Poison C+': 'Bot.Veneno',
	'Para C+': 'Bot.pará.',
	'Sleep C+': 'Bot.sueño',
	'Power C+': 'Bot.Poder',
	'C. Range C+': 'Bot.Cont.',
	'Exhaust C+': 'Aña.Fatiga',
	Status: 'Estado',
	ElementAtk: 'Atq. Elem.',
	'Fire Atk': 'Fuego Inc',
	'Water Atk': 'Agua Inc',
	'Thundr Atk': 'Trueno Inc',
	'Ice Atk': 'Hielo Inc',
	'Dragon Atk': 'Dragon Inc',
	Constitutn: 'Constituc.',
	Stamina: 'Resist.',
	'Stam Recov': 'Rec.Resist',
	Hunger: 'Hambre',
	Evasion: 'Evadir',
	'Evade Dist': 'Dis.Evadir',
	Sheathing: 'Envaine',
	Sense: 'Sentido',
	'Rec Speed': 'Vel. recup',
	Guard: 'Guardia',
	'Guard Up': 'Vel.Guarda',
	'Auto-Guard': 'Autoprot.',
	Protection: 'Subir prot',
	Poison: 'Veneno',
	Paralysis: 'Paralisis',
	Sleep: 'Sueño',
	Stun: 'Aturdir',
	'Mud/Snow': 'Barr/Nieve',
	'Tremor Res': 'Temb.anul.',
	'Wind Res': 'PresViento',
	Antiseptic: 'Antisept.',
	'Anti-Theft': 'Anti-robo',
	'Blight Res': 'Res. Plaga',
	'Def Lock': 'NieDefBaja',
	Hearing: 'Prot. oido',
	Health: 'Salud',
	Defense: 'Defensa',
	'Fire Res': 'R. fuego',
	'Water Res': 'R. agua',
	ThunderRes: 'R. trueno',
	'Ice Res': 'R. hielo',
	'Dragon Res': 'R. dragón',
	'Wide-Range': 'Área ampl.',
	'Bomb Boost': 'Bombardero',
	SpeedSetup: 'TrampaRap.',
	Perception: 'Observar',
	Psychic: 'VisPsíquic',
	Dungmaster: 'Estiercol',
	'Rec Level': 'Niv. recup',
	LastingPwr: 'Duración',
	Gluttony: 'Glotoneria',
	Eating: 'Comer',
	Ranger: 'Excursion.',
	Transportr: 'Mochilero',
	'Heat Res': 'Res. Calor',
	'Cold Res': 'Res. Frio',
	Gathering: 'Recogida',
	'Spd Gather': 'Vel. recog',
	Whim: 'Capricho',
	Fate: 'Destino',
	Carving: 'Cortar',
	Tranquilzr: 'Captura',
	'Combo Rate': 'Combinar',
	'Combo Plus': 'Combinador'
};

/** Every selectable skill name in skills.json, keyed exactly as stored. */
const SKILLS_ES = {
	'Attack Up (S)': 'Subir Ataque[pq]',
	'Attack Up (M)': 'Subir Ataque[md]',
	'Attack Up (L)': 'Subir Ataque[gr]',
	'Attack Down (S)': 'Bajar Ataque[pq]',
	'Attack Down (M)': 'Bajar Ataque[md]',
	'Attack Down (L)': 'Bajar Ataque[gr]',
	'Critical Eye +1': 'Ab. Temerario +1',
	'Critical Eye +2': 'Ab. Temerario +2',
	'Critical Eye +3': 'Ab. Temerario +3',
	'Critical Eye -1': 'Ab. Temerario -1',
	'Critical Eye -2': 'Ab. Temerario -2',
	'Critical Eye -3': 'Ab. Temerario -3',
	'Razor Sharp': 'Espada afilada',
	'Blunt Edge': 'Espada sin filo',
	'Speed Sharpening': 'Afilado rapido',
	'Slow Sharpening': 'Afilado lento',
	'Sharpness +1': 'Afilado Aument.',
	'Punishing Draw': 'Desenv. KO',
	'Critical Draw': 'Desenvaine crit.',
	Focus: 'Concentración',
	Distraction: 'Distracción',
	"Mind's Eye": 'Esgrima',
	'Weakness Exploit': 'Exp. Debilidad',
	Partbreaker: 'GolpePes.',
	'Knockout King': 'Aturdidor',
	'Stamina Thief': 'Drenar Resist.',
	'Horn Maestro': 'Flautista',
	'Artillery Novice': 'Artillería Novato',
	'Artillery King': 'Rey Artillero',
	'Latent Power +1': 'Fuer. desatada +1',
	'Latent Power +2': 'Fuer. desatada +2',
	'Adrenaline +1': 'Adrenalina +1',
	'Adrenaline +2': 'Adrenalina +2',
	Worrywort: 'Preocupado',
	Fortify: 'Fortalecer',
	'Load Up': 'Recarga ampliada',
	'Bonus Shot': 'Disparo adic.',
	'Reload Speed +1': 'Vel.Recarga +1',
	'Reload Speed +2': 'Vel.Recarga +2',
	'Reload Speed +3': 'Vel.Recarga +3',
	'Reload Speed -1': 'Vel.Recarga -1',
	'Reload Speed -2': 'Vel.Recarga -2',
	'Reload Speed -3': 'Vel.Recarga -3',
	'Recoil Down +1': 'Retroc. red. +1',
	'Recoil Down +2': 'Retroc. red. +2',
	'Recoil Down +3': 'Retroc. red. +3',
	'Recoil Down -1': 'Retroc. red. -1',
	'Recoil Down -2': 'Retroc. red. -2',
	'Recoil Down -3': 'Retroc. red. -3',
	'Steadiness +1': 'Precisión +1',
	'Steadiness +2': 'Precisión +2',
	'Steadiness -1': 'Precisión -1',
	'Steadiness -2': 'Precisión -2',
	'Normal/Rapid Up': 'Subir normal/Ráp',
	'Pierce/Pierce Up': 'Subir perf/Perf',
	'Pellet/Spread Up': 'Subir perd/Dspr',
	'Use Any Normal': 'Aña. norm. TODO',
	'Use Lv1 Pierce S': 'Añadir perf nv1',
	'Use Any Pierce S': 'Aña. perf. TODO',
	'Use Lv1 Pellet S': 'Añad. perdig.nv1',
	'Use Any Pellet S': 'D.perd.todos NV',
	'Use Lv1 Crag S': 'Añadir exp nv1',
	'Use Any Crag S': 'D.expl todos NV',
	'Use Lv1 Clust S': 'Aña. grupo nv1',
	'Use Any Clust S': 'D.grupo todos NV',
	'Use Slicing S': 'Uso corte espec.',
	'Use Poison Coat': 'Revest. Veneno',
	'Use Para Coat': 'Reves. Parálisis',
	'Use Sleep Coat': 'Revest. Sueño',
	'Use Power Coat': 'Revest. Poder',
	'Use C. Range Coat': 'Revest. Contacto',
	'Use Exhaust Coat': 'Revest. Fatiga',
	'Status Atk +1': 'Atrib. Estado +1',
	'Status Atk +2': 'Atrib. Estado +2',
	'Status Atk Down': 'Bajar Atrib. Estado',
	'Element Atk +1': 'Subir Ataq Elem.',
	'Element Atk Down': 'Bajar Ataq Elem.',
	'Fire Atk +1': 'Atrib. Fuego +1',
	'Fire Atk +2': 'Atrib. Fuego +2',
	'Fire Atk Down': 'Atrib. Fuego -1',
	'Water Atk +1': 'Atrib. Agua +1',
	'Water Atk +2': 'Atrib. Agua +2',
	'Water Atk Down': 'Atrib. Agua -1',
	'Thunder Atk +1': 'Atrib. Trueno +1',
	'Thunder Atk +2': 'Atrib. Trueno +2',
	'Thunder Atk Down': 'Atrib. Trueno -1',
	'Ice Atk +1': 'Atrib. Hielo +1',
	'Ice Atk +2': 'Atrib. Hielo +2',
	'Ice Atk Down': 'Atrib. Hielo -1',
	'Dragon Atk +1': 'Atrib. Dragón +1',
	'Dragon Atk +2': 'Atrib. Dragón +2',
	'Dragon Atk Down': 'Atrib. Dragón -1',
	'Constitution +1': 'Constituc. +1',
	'Constitution +2': 'Constituc. +2',
	'Constitution -1': 'Constituc. -1',
	'Constitution -2': 'Constituc. -2',
	'Marathon Runner': 'Corredor',
	'Short Sprinter': 'Pies planos',
	'Stam Recov Up': 'Rec. Resist. Aum',
	'Stam Recov Down': 'Rec. Resist. Dis',
	'Halve Hunger': 'Hambre a mitad',
	'Negate Hunger': 'Hambre negada',
	'Raise Hunger': 'Hambre aumentada',
	'Double Hunger': 'Hambriento',
	'Evasion +1': 'Evadir +1',
	'Evasion +2': 'Evadir +2',
	'Evade Down': 'Evasión dismin.',
	'Evade Extender': 'Evasion Ampliada',
	'Quick Sheathe': 'Envaine veloz',
	Sneak: 'Sigilo',
	Taunt: 'Provocación',
	'Recovery Spd +1': 'Vel. recup. +1',
	'Recovery Spd +2': 'Vel. recup. +2',
	'Recovery Spd -1': 'Vel. recup. -1',
	'Recovery Spd -2': 'Vel. recup. -2',
	'Guard +1': 'Guardia +1',
	'Guard +2': 'Guardia +2',
	'Guard -1': 'Guardia -1',
	'Guard Boost': 'Guardia superior',
	'Auto-Guard': 'AutoProteccion',
	'Divine Blessing': 'Protec. divina',
	'Demonic Blessing': 'Prot. demoniaca',
	'Negate Poison': 'Veneno anulado',
	'Double Poison': 'Doble Veneno',
	'Negate Paralysis': 'Parálisis anul.',
	'Double Paralysis': 'Doble Parálisis',
	'Negate Sleep': 'Sueño anulado',
	'Double Sleep': 'Doble Sueño',
	'Halve Stun': 'Aturdim. a mitad',
	'Negate Stun': 'Niega Aturdim.',
	'Double Stun': 'Doble aturdim.',
	'Negate Mud/Snow': 'Niega Barr/Nieve',
	'Tremor Resistance': 'Temblor anulado',
	'Windproof (Lo)': 'Res. viento baja',
	'Windproof (Hi)': 'Res. viento alta',
	Antiseptic: 'Antiséptico',
	'Anti-Theft': 'Anti-robo',
	'Blights Negated': 'Anti-plagas',
	'Iron Skin': 'Piel de hierro',
	Earplugs: 'Tapón de oido',
	'HG Earplugs': 'Tapones grandes',
	'Health +20': 'Salud +20',
	'Health +50': 'Salud +50',
	'Health -10': 'Salud -10',
	'Health -30': 'Salud -30',
	'Defense Up (S)': 'Subir Def.[pq]',
	'Defense Up (M)': 'Subir Def.[md]',
	'Defense Up (L)': 'Subir Def.[gr]',
	'Defense Down (S)': 'Bajar Def.[pq]',
	'Defense Down (M)': 'Bajar Def.[md]',
	'Defense Down (L)': 'Bajar Def.[gr]',
	'Fire Res +5': 'Res. Fuego[pq]',
	'Fire Res +10': 'Res. Fuego[gr]',
	'Fire Res -10': 'Bajar Res. Fuego',
	'Water Res +5': 'Res. Agua[pq]',
	'Water Res +10': 'Res. Agua[gr]',
	'Water Res -10': 'Bajar Res. Agua',
	'Thunder Res +5': 'Res. Trueno[pq]',
	'Thunder Res +10': 'Res. Trueno[gr]',
	'Thunder Res -10': 'Bajar Res.Trueno',
	'Ice Res +5': 'Res. Hielo[pq]',
	'Ice Res +10': 'Res. Hielo[gr]',
	'Ice Res -10': 'Bajar Res. Hielo',
	'Dragon Res +5': 'Res. Dragón[pq]',
	'Dragon Res +10': 'Res. Dragón[gr]',
	'Dragon Res -10': 'Bajar Res. Drag.',
	'Wide-Range +1': 'Area Amplia +1',
	'Wide-Range +2': 'Area Amplia +2',
	Bombardier: 'Bombardero',
	'Trap Master': 'Experto trampas',
	'Capture Guru': 'Ojo de captura',
	Detect: 'Detectar',
	Autotracker: 'Autorastreo',
	'Dung Bomb Expert': 'Exp. Estiercol',
	'Recovery Up': 'Recup. Vida Aum.',
	'Recovery Down': 'Recup. Vida Dec.',
	'Item Use Up': 'Uso de obj. aum.',
	'Item Use Down': 'Uso de obj. red.',
	Scavenger: 'Carroñero',
	Gourmand: 'Glotón',
	'Speed Eating +1': 'Comer rápido+1',
	'Speed Eating +2': 'Comer rápido+2',
	'Slow Eater': 'Comer lento',
	Outdoorsman: 'Excursionista',
	'Pro Transporter': 'Experto mochilero',
	'Heat Cancel': 'Cancelar calor',
	'Heat Surge': 'Calor al doble',
	'Cold Cancel': 'Cancelar frio',
	'Cold Surge': 'Frio al doble',
	'Gathering +1': 'Recogida +1',
	'Gathering +2': 'Recogida +2',
	'Gathering -1': 'Recogida -1',
	'Speed Gatherer': 'Recogedor veloz',
	"Spirit's Whim": 'Capri. espiritu',
	'Divine Whim': 'Capri. divino',
	"Spectre's Whim": 'Capri. malvado',
	"Devil's Whim": 'Capri. demoniaco',
	'Good Luck': 'Buena suerte',
	'Great Luck': 'Grán suerte',
	'Bad Luck': 'Mala suerte',
	'Carving Pro': 'Calamidad',
	'Carving Master': 'Maestro Cortador',
	'Capture Expert': 'Experto captura',
	'Capture Master': 'Gurú de captura',
	'Combination +20%': 'Combinación+20%',
	'Combination +45%': 'Combinación+45%',
	'Combination -10%': 'Combinación-10%',
	'Combination -20%': 'Combinación-20%',
	'Combination Pro': 'Producción Max.',
	'Torso Up': 'Aum. torso'
};

const TAGS_ES = {
	Misc: 'Misc',
	Offensive: 'Ofensivo',
	Defensive: 'Defensivo',
	Blademaster: 'M. Espada',
	'Bow/Gunner': 'Artillero',
	Farming: 'Farming',
	Resistance: 'Resistencia'
};

const CHARM_NAMES_ES = {
	'(unnamed)': '(sin nombre)',
	'Common Talisman': 'Talismán Común',
	'Queen Talisman': 'Talismán de la Reina',
	'King Talisman': 'Talismán del Rey',
	'Dragon Talisman': 'Talismán Dragón'
};

// ---------------------------------------------------------------------------
// Positional joins against Athena's data files
// ---------------------------------------------------------------------------

const PART_TO_FILE = { Head: 'head', Body: 'body', Arms: 'arms', Waist: 'waist', Legs: 'legs' };

await Promise.all(
	PART_FILES.flatMap((f) => [
		ensureCached('en', `${f}.txt`),
		ensureCached('es', `${f}.txt`),
		ensureCached('en', 'components.txt'),
		ensureCached('es', 'components.txt'),
		ensureCached('en', 'decorations.txt'),
		ensureCached('es', 'decorations.txt')
	])
);

const appArmors = JSON.parse(readFileSync(path.join(root, 'src/mhp3_json/armors.json'), 'utf8'));
const appComponents = JSON.parse(
	readFileSync(path.join(root, 'src/mhp3_json/components.json'), 'utf8')
);
const appDecorations = JSON.parse(
	readFileSync(path.join(root, 'src/mhp3_json/decorations.json'), 'utf8')
);
const appSkills = JSON.parse(readFileSync(path.join(root, 'src/mhp3_json/skills.json'), 'utf8'));
const appTrees = JSON.parse(
	readFileSync(path.join(root, 'src/mhp3_json/skill_trees.json'), 'utf8')
);

// Armors: app arrays keep Athena file order per part, so line i of the EN data
// file and line i of the ES name list both correspond to appArmors[i]. The app
// localized some monster names (Aoashira -> Arzuros), hence keying by app names.
const key4 = (s) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '')
		.slice(0, 4);
const armorsES = {};
for (const part of Object.keys(PART_TO_FILE)) {
	const enNames = readLines('en', `${PART_TO_FILE[part]}.txt`).map((l) => l.split(',')[0]);
	const esNames = readLines('es', `${PART_TO_FILE[part]}.txt`);
	const appList = appArmors.filter((a) => a.part === part);
	if (enNames.length !== esNames.length || enNames.length !== appList.length) {
		throw new Error(
			`${part}: app=${appList.length} en=${enNames.length} es=${esNames.length} entries`
		);
	}
	let fuzzyHits = 0;
	for (let i = 0; i < enNames.length; i++) {
		const en = key4(enNames[i]);
		const app = key4(appList[i].name);
		if (en === app || en.startsWith(app) || app.startsWith(en)) fuzzyHits++;
		armorsES[appList[i].name] = esNames[i];
	}
	console.log(`${part} positional sanity: ${((fuzzyHits / enNames.length) * 100).toFixed(1)}%`);
	if (fuzzyHits / enNames.length < 0.6) {
		throw new Error(`${part}: order drift, fuzzy match ratio below 60%`);
	}
}

// Components & decorations: app arrays preserve Athena file order.
const componentsES = {};
{
	const enLines = readLines('en', 'components.txt');
	const esLines = readLines('es', 'components.txt');
	if (enLines.length !== esLines.length || enLines.length !== appComponents.length) {
		throw new Error(
			`components mismatch: app=${appComponents.length} en=${enLines.length} es=${esLines.length}`
		);
	}
	// Athena's base files abbreviate some names ("Poison Thrw Knf") while the
	// app dataset spells them out, so we can't compare strings exactly — verify
	// positional alignment fuzzily instead.
	const key = (s) =>
		s
			.toLowerCase()
			.replace(/[^a-z0-9]/g, '')
			.slice(0, 4);
	let fuzzyHits = 0;
	for (let i = 0; i < enLines.length; i++) {
		const en = key(enLines[i]);
		const app = key(appComponents[i]);
		if (en === app || en.startsWith(app) || app.startsWith(en)) fuzzyHits++;
	}
	const ratio = fuzzyHits / enLines.length;
	console.log(`components positional sanity: ${(ratio * 100).toFixed(1)}% fuzzy matches`);
	if (ratio < 0.6) throw new Error('components order drift: fuzzy match ratio below 60%');
	for (let i = 0; i < esLines.length; i++) {
		componentsES[appComponents[i]] = esLines[i];
	}
}
const decorationsES = {};
{
	const esLines = readLines('es', 'decorations.txt');
	if (esLines.length !== appDecorations.length) {
		throw new Error(`decorations mismatch: app=${appDecorations.length} es=${esLines.length}`);
	}
	for (let i = 0; i < esLines.length; i++) {
		decorationsES[appDecorations[i].name] = esLines[i];
	}
}

// Skills: make sure our authored table covers every skill in the dataset.
const skillMisses = appSkills.map((s) => s.name).filter((n) => !(n in SKILLS_ES));
const treeMisses = appTrees.map((t) => t.name).filter((n) => !(n in TREES_ES));

if (skillMisses.length || treeMisses.length) {
	console.error('UNMAPPED skill names:', [...new Set(skillMisses)]);
	console.error('UNMAPPED tree names:', [...new Set(treeMisses)]);
	process.exit(1);
}

const out = {
	meta: {
		game: 'Monster Hunter Portable 3rd',
		source: "Athena's ASS language pack (Español, Team Hunters 404)",
		note: 'Auto-generated by scripts/generate-es-names.mjs — do not edit.'
	},
	armors: armorsES,
	components: componentsES,
	decorations: decorationsES,
	trees: TREES_ES,
	skills: SKILLS_ES,
	tags: TAGS_ES,
	charms: CHARM_NAMES_ES
};

writeFileSync(outPath, JSON.stringify(out, null, '\t') + '\n');
console.log(`armors mapped: ${Object.keys(armorsES).length}`);
console.log(`components mapped: ${Object.keys(componentsES).length}`);
console.log(`decorations mapped: ${Object.keys(decorationsES).length}`);
console.log(`skills mapped: ${appSkills.length}, trees mapped: ${appTrees.length}`);
console.log(`wrote ${outPath}`);
