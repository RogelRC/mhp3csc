import esNames from './es-names.json';

export type Locale = 'en' | 'es';

const LS_KEY = 'mhp3csc:lang';

function initialLocale(): Locale {
	if (typeof window === 'undefined') return 'en';
	try {
		const saved = window.localStorage.getItem(LS_KEY);
		return saved === 'es' ? 'es' : 'en';
	} catch {
		return 'en';
	}
}

let locale = $state<Locale>(initialLocale());
if (typeof document !== 'undefined') {
	document.documentElement.lang = locale;
}

export function getLocale(): Locale {
	return locale;
}

export function setLocale(l: Locale) {
	locale = l;
	try {
		localStorage.setItem(LS_KEY, l);
	} catch {
		/* storage unavailable */
	}
	document.documentElement.lang = l;
}

// ---------------------------------------------------------------------------
// Game data name translations (English canonical -> display)
// ---------------------------------------------------------------------------

const MISC_ES: Record<string, string> = {
	Head: 'Cabeza',
	Body: 'Torso',
	Arms: 'Brazos',
	Waist: 'Cintura',
	Legs: 'Piernas',
	Any: 'Todos',
	Male: 'Hombre',
	Female: 'Mujer',
	Blademaster: 'Espadachín',
	Gunner: 'Artillero'
};

const GAME_ES: Record<string, string> = Object.assign(
	{},
	...(['armors', 'components', 'decorations', 'trees', 'skills', 'tags'] as const).map(
		(section) => esNames[section]
	),
	esNames.charms,
	MISC_ES
);

/** Translate a game-data name (armor, skill, tree, deco, material, tag...). */
export function tr(name: string): string {
	return locale === 'es' ? (GAME_ES[name] ?? name) : name;
}

// ---------------------------------------------------------------------------
// UI strings
// ---------------------------------------------------------------------------

const en = {
	appName: 'MHP3 Armor Set Search',
	tagline:
		"A set searcher for Monster Hunter Portable 3rd (Athena's-style), driven by data from Athena's ASS.",
	metaDescription:
		'Armor set search for Monster Hunter Portable 3rd — find sets that activate your chosen skills.',
	targetSkills: 'Target skills',
	noSkillsSelected: 'No skills selected. Pick the skills you want your set to activate.',
	addSkills: 'Add skills…',
	closeSkillList: 'Close skill list',
	searchSkills: 'Search skills…',
	skillCategory: 'Skill category',
	all: 'All',
	remove: 'Remove',
	charms: 'Charms',
	hideList: 'Hide list',
	showList: 'Show list',
	addCharm: '+ Add charm',
	removeAll: 'Remove all',
	charmsHint: 'Enter the charms you own. The search will build sets using one of them.',
	importCharms: 'Import charms from a MHP3rd Save.BIN',
	charmsHidden: '{n} charm(s) hidden. Use "Show list" above to review them.',
	includeNoCharm: 'Also search sets without a charm',
	possibleCharms: 'Possible charms',
	off: 'Off',
	oneSkill: '1 skill',
	twoSkills: '2 skills',
	slotted: 'Slotted',
	possibleHint:
		"Adds real charms from MHP3rd's official charm tables, so results tell you which charm each set needs — even ones you don't own yet.",
	options: 'Options',
	weaponSlots: 'Weapon slots',
	gender: 'Gender',
	hunterType: 'Hunter type',
	maxRarity: 'Max rarity',
	maxHr: 'Max HR req',
	villageProgress: 'Village quest progress',
	villageHint:
		'Armors obtainable via this village quest rank are always included; guild-exclusive sets still require their HR.',
	usePiercings: 'Use piercings (Sword Saint, Barrage)',
	history: 'History',
	clear: 'Clear',
	historyEmpty: 'Your last searches will show up here.',
	searchSets: 'Search sets',
	searching: 'Searching…',
	stop: 'Stop',
	found: '{n} found',
	results: 'Results',
	setsCount: '{n} set(s)',
	ofTotal: '(of {total})',
	searchingShort: '· searching…',
	noNegative: 'No negative skills',
	sortDefMax: 'Def max',
	sortDefBase: 'Def base',
	sortFire: 'Fire',
	sortWater: 'Water',
	sortIce: 'Ice',
	sortThunder: 'Thunder',
	sortDragon: 'Dragon',
	sortDifficulty: 'Difficulty',
	sortRarity: 'Rarity',
	sortSlotsLeft: 'Empty slots',
	descTitle: 'Descending (high to low)',
	ascTitle: 'Ascending (low to high)',
	desc: 'Desc',
	asc: 'Asc',
	filterByCharm: 'Filter by charm',
	allCharms: 'All charms',
	noCharmOption: 'No charm',
	advancedSearch: 'Advanced search',
	advancedHint: "Uncheck a piece to see only sets that don't need it",
	selectAll: 'Select all',
	unselectAll: 'Unselect all',
	noneUsed: 'None used.',
	decorationsGems: 'Decorations (gems)',
	emptyState: 'Configure your skills and charms, then run a search.',
	noSetsFilters: 'No sets match the current filters.',
	noSetsFound:
		'No sets found. Try loosening your requirements (fewer skills, more charm points, or allow higher rarity armor).',
	backToTop: 'Back to top',
	negativeOn: 'Negative skill mode activated ⚔',
	negativeOff: 'Negative skill mode deactivated',
	selectAtLeastOne: 'Select at least one target skill.',
	needCharm: 'Add at least one charm, or enable "no charm" or "possible charm" sets.',
	tooManyCombos:
		'Too many combinations to check exhaustively. Showing best found so far — try loosening your skills or adding a stronger charm.',
	importNone: 'No charms found in that save.',
	importFail: 'Could not read that file. It may not be a valid MHP3rd Save.BIN.',
	imported: 'Imported {n} charm(s) from {file}.',
	searchFailed: 'Search failed.',
	progressStarting: 'Starting…',
	combinationLimit: 'combination limit',
	noSkills: 'No skills',
	possibleSuffix: 'possible ({mode})',
	nCharms: '{n} charm(s)',
	noCharms: 'no charms',
	extraNoCharm: ' · +no charm',
	noWeaponSlots: 'no slots',
	nWeaponSlots: '{n} slot(s)',
	mostSearched: 'Most searched',
	topSetsEmpty: 'The most-searched skill sets from all visitors will show up here.',
	searchedNTimes: 'searched {n}×',
	foundBug: 'Found a bug?',
	reportOnDiscord: 'Report it on Discord',
	enjoyProject: 'Enjoying the project?',
	starOnGitHub: 'Star it on GitHub',
	downloadLatest: 'Download the latest version:',
	goToReleases: 'Go to Releases',
	youMayAlsoLike: 'You may also like',
	mhfuLink: 'MHFU Armor Set Search',
	footer:
		"Data extracted from Athena's ASS for Monster Hunter Portable 3rd. Not affiliated with Capcom.",
	// ResultCard
	part: 'Part',
	piece: 'Piece',
	slots: 'Slots',
	def: 'Def',
	rarity: 'Rarity',
	stats: 'Stats:',
	defBase: 'Def base',
	defMax: 'Def max',
	difficulty: 'Difficulty',
	charmLabel: 'Charm:',
	weaponSlotsLabel: 'Weapon slots:',
	used: 'Used:',
	decorationsLabel: 'Decorations:',
	skillPoints: 'Skill points:',
	materials: 'Materials:',
	copySet: 'Copy set',
	exportImage: 'Export image',
	exportImageTitle: 'Export as image',
	copyTextHeader: 'MHP3 Armor Set #{n} — Defense {def}',
	copyTextCharm: 'Charm: {v}',
	copyTextNone: 'None',
	copyTextWeaponSlots: 'Weapon slots: {n}',
	copyTextDecorations: 'Decorations: {v}',
	copyTextSkills: 'Skills: {v}',
	copyTextNegative: 'Negative skills: {v}',
	copyTextMaterials: 'Materials: {v}',
	possibleBadge: 'possible',
	notOwnedPossible: 'not owned — possible charm',
	torsoUp: 'Torso Up',
	unnamed: '(unnamed)',
	charmFallback: 'Charm',
	// CharmCard
	useInSearch: 'Use in search',
	charmNamePlaceholder: 'Charm name (optional)',
	removeCharm: 'Remove',
	slotsLabel: 'Slots',
	skill1: 'Skill 1…',
	skill2: 'Skill 2…',
	secondSkill: '+ second skill',
	removeCharmAria: 'Remove charm',
	removeSecondSkillAria: 'Remove second skill',
	// CharmTableInfo
	tablesAria: 'Which charm tables have this talisman?',
	charmTables: 'Charm tables',
	notInTables: "This talisman isn't in MHP3rd's official charm tables.",
	anyTable: "Obtainable in any of the game's {n} charm tables.",
	onlyTables: 'Only obtainable in charm table(s):',
	randomTableNote: 'The game picks your active charm table at random every time you boot MHP3rd.',
	phasePreparing: 'Preparing…',
	phasePruned: 'Pruned {n} charm(s)',
	phaseAborted: 'Aborted',
	phaseSearchingNoCharm: 'Searching (no charm)',
	phaseSearching: 'Searching {name}',
	phaseStoppedCombos: 'Stopped (combination limit)',
	phaseDone: 'Done',
	phaseStoppedNodes: 'Stopped (node limit reached)'
};

const es: typeof en = {
	appName: 'MHP3 Armor Set Search',
	tagline:
		"Buscador de sets para Monster Hunter Portable 3rd (estilo Athena's), con datos de Athena's ASS.",
	metaDescription:
		'Buscador de sets para Monster Hunter Portable 3rd: encuentra sets que activen tus habilidades.',
	targetSkills: 'Habilidades objetivo',
	noSkillsSelected: 'No hay habilidades seleccionadas. Elige las que quieres activar en tu set.',
	addSkills: 'Añadir habilidades…',
	closeSkillList: 'Cerrar lista de habilidades',
	searchSkills: 'Buscar habilidades…',
	skillCategory: 'Categoría de habilidad',
	all: 'Todas',
	remove: 'Quitar',
	charms: 'Talismanes',
	hideList: 'Ocultar lista',
	showList: 'Mostrar lista',
	addCharm: '+ Añadir talismán',
	removeAll: 'Quitar todos',
	charmsHint: 'Introduce los talismanes que tienes. La búsqueda creará sets usando uno de ellos.',
	importCharms: 'Importar talismanes desde un Save.BIN de MHP3rd',
	charmsHidden: '{n} talismán(es) ocultos. Usa «Mostrar lista» arriba para revisarlos.',
	includeNoCharm: 'Buscar también sets sin talismán',
	possibleCharms: 'Posibles talismanes',
	off: 'No',
	oneSkill: '1 habilidad',
	twoSkills: '2 habilidades',
	slotted: 'Con huecos',
	possibleHint:
		'Añade talismanes reales de las tablas oficiales de MHP3rd, así los resultados te dicen qué talismán necesita cada set, aunque aún no lo tengas.',
	options: 'Opciones',
	weaponSlots: 'Huecos del arma',
	gender: 'Sexo',
	hunterType: 'Tipo de cazador',
	maxRarity: 'Rareza máx.',
	maxHr: 'Rango HR máx.',
	villageProgress: 'Progreso de aldea',
	villageHint:
		'Siempre se incluyen las armaduras obtenibles en ese rango de aldea; los sets exclusivos de la guild siguen requiriendo su HR.',
	usePiercings: 'Usar piercings (Sword Saint, Barrage)',
	history: 'Historial',
	clear: 'Borrar',
	historyEmpty: 'Tus últimas búsquedas aparecerán aquí.',
	searchSets: 'Buscar sets',
	searching: 'Buscando…',
	stop: 'Parar',
	found: '{n} encontrados',
	results: 'Resultados',
	setsCount: '{n} set(s)',
	ofTotal: '(de {total})',
	searchingShort: '· buscando…',
	noNegative: 'Sin habilidades negativas',
	sortDefMax: 'Def máx',
	sortDefBase: 'Def base',
	sortFire: 'Fuego',
	sortWater: 'Agua',
	sortIce: 'Hielo',
	sortThunder: 'Trueno',
	sortDragon: 'Dragón',
	sortDifficulty: 'Dificultad',
	sortRarity: 'Rareza',
	sortSlotsLeft: 'Huecos libres',
	descTitle: 'Descendente (mayor a menor)',
	ascTitle: 'Ascendente (menor a mayor)',
	desc: 'Desc',
	asc: 'Asc',
	filterByCharm: 'Filtrar por talismán',
	allCharms: 'Todos los talismanes',
	noCharmOption: 'Sin talismán',
	advancedSearch: 'Búsqueda avanzada',
	advancedHint: 'Desmarca una pieza para ver solo los sets que no la necesitan',
	selectAll: 'Marcar todo',
	unselectAll: 'Desmarcar todo',
	noneUsed: 'Ninguna usada.',
	decorationsGems: 'Decoraciones (joyas)',
	emptyState: 'Configura tus habilidades y talismanes y ejecuta una búsqueda.',
	noSetsFilters: 'Ningún set coincide con los filtros actuales.',
	noSetsFound:
		'No se encontraron sets. Prueba a relajar los requisitos (menos habilidades, más puntos de talismán o permitir rarezas más altas).',
	backToTop: 'Volver arriba',
	negativeOn: 'Modo de habilidades negativas activado ⚔',
	negativeOff: 'Modo de habilidades negativas desactivado',
	selectAtLeastOne: 'Selecciona al menos una habilidad objetivo.',
	needCharm: 'Añade al menos un talismán, o activa los sets «sin talismán» o «talismán posible».',
	tooManyCombos:
		'Demasiadas combinaciones para comprobarlas todas. Se muestra lo mejor encontrado hasta ahora: prueba a relajar tus habilidades o añade un talismán más potente.',
	importNone: 'Ese archivo no contiene talismanes.',
	importFail: 'No se pudo leer el archivo. Puede que no sea un Save.BIN válido de MHP3rd.',
	imported: 'Importado(s) {n} talismán(es) desde {file}.',
	searchFailed: 'La búsqueda falló.',
	progressStarting: 'Empezando…',
	combinationLimit: 'límite de combinaciones',
	noSkills: 'Sin habilidades',
	possibleSuffix: 'posible ({mode})',
	nCharms: '{n} talismán(es)',
	noCharms: 'sin talismanes',
	extraNoCharm: ' · +sin talismán',
	noWeaponSlots: 'sin huecos',
	nWeaponSlots: '{n} hueco(s)',
	mostSearched: 'Más buscados',
	topSetsEmpty:
		'Los conjuntos de habilidades más buscados por todos los visitantes aparecerán aquí.',
	searchedNTimes: 'buscado {n}×',
	foundBug: '¿Encontraste un error?',
	reportOnDiscord: 'Repórtalo en Discord',
	enjoyProject: '¿Te gusta el proyecto?',
	starOnGitHub: 'Dale una estrella en GitHub',
	downloadLatest: 'Descarga la última versión:',
	goToReleases: 'Ir a Releases',
	youMayAlsoLike: 'También te puede gustar',
	mhfuLink: 'Buscador de sets de MHFU',
	footer:
		"Datos extraídos de Athena's ASS para Monster Hunter Portable 3rd. Sin afiliación con Capcom.",
	part: 'Pieza',
	piece: 'Parte',
	slots: 'Huecos',
	def: 'Def',
	rarity: 'Rareza',
	stats: 'Stats:',
	defBase: 'Def base',
	defMax: 'Def máx',
	difficulty: 'Dificultad',
	charmLabel: 'Talismán:',
	weaponSlotsLabel: 'Huecos del arma:',
	used: 'Usados:',
	decorationsLabel: 'Decoraciones:',
	skillPoints: 'Puntos de hab.:',
	materials: 'Materiales:',
	copySet: 'Copiar set',
	exportImage: 'Exportar imagen',
	exportImageTitle: 'Exportar como imagen',
	copyTextHeader: 'MHP3 Set de armadura #{n} — Defensa {def}',
	copyTextCharm: 'Talismán: {v}',
	copyTextNone: 'Ninguno',
	copyTextWeaponSlots: 'Huecos del arma: {n}',
	copyTextDecorations: 'Decoraciones: {v}',
	copyTextSkills: 'Habilidades: {v}',
	copyTextNegative: 'Habilidades negativas: {v}',
	copyTextMaterials: 'Materiales: {v}',
	possibleBadge: 'posible',
	notOwnedPossible: 'no es tuyo: talismán posible',
	torsoUp: 'Aum. torso',
	unnamed: '(sin nombre)',
	charmFallback: 'Talismán',
	useInSearch: 'Usar en la búsqueda',
	charmNamePlaceholder: 'Nombre del talismán (opcional)',
	removeCharm: 'Quitar',
	slotsLabel: 'Huecos',
	skill1: 'Habilidad 1…',
	skill2: 'Habilidad 2…',
	secondSkill: '+ segunda habilidad',
	removeCharmAria: 'Quitar talismán',
	removeSecondSkillAria: 'Quitar segunda habilidad',
	tablesAria: '¿En qué tablas de talismán está este talismán?',
	charmTables: 'Tablas de talismán',
	notInTables: 'Este talismán no está en las tablas oficiales de MHP3rd.',
	anyTable: 'Se puede obtener en cualquiera de las {n} tablas de talismán del juego.',
	onlyTables: 'Solo se puede obtener en la(s) tabla(s) de talismán:',
	randomTableNote: 'El juego elige tu tabla de talismanes al azar cada vez que inicias MHP3rd.',
	phasePreparing: 'Preparando…',
	phasePruned: 'Descartados {n} talismán(es)',
	phaseAborted: 'Cancelado',
	phaseSearchingNoCharm: 'Buscando (sin talismán)',
	phaseSearching: 'Buscando {name}',
	phaseStoppedCombos: 'Detenido (límite de combinaciones)',
	phaseDone: 'Hecho',
	phaseStoppedNodes: 'Detenido (límite de nodos alcanzado)'
};

const dicts: Record<Locale, Record<string, string>> = { en, es };

/** Translate a UI string, with optional {var} interpolation. */
export function t(key: string, vars?: Record<string, string | number>): string {
	let out: string = dicts[locale][key] ?? en[key as keyof typeof en] ?? key;
	if (vars) {
		for (const [k, v] of Object.entries(vars)) {
			out = out.split(`{${k}}`).join(String(v));
		}
	}
	return out;
}

const PHASE_PRUNED = /^Pruned (\d+) charms?$/;
const PHASE_SEARCHING = /^Searching (.+)$/;

/** Translate a search progress phase emitted by the search worker. */
export function trPhase(phase: string): string {
	if (!phase) return phase;
	if (phase === 'Preparing.') return t('phasePreparing');
	const pruned = phase.match(PHASE_PRUNED);
	if (pruned) return t('phasePruned', { n: pruned[1] });
	if (phase === 'Aborted') return t('phaseAborted');
	if (phase === 'Searching (no charm)') return t('phaseSearchingNoCharm');
	const searching = phase.match(PHASE_SEARCHING);
	if (searching) return t('phaseSearching', { name: tr(searching[1]) });
	if (phase.startsWith('Stopped (combination limit)')) return t('phaseStoppedCombos');
	if (phase === 'Done') return t('phaseDone');
	if (phase.startsWith('Stopped (node limit')) return t('phaseStoppedNodes');
	return phase;
}
