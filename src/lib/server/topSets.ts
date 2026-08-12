import { Redis } from '@upstash/redis';
import { env } from '$env/dynamic/private';
import { createHash } from 'node:crypto';

export interface StoredCharmSkill {
	tree: string;
	points: number;
}

export interface StoredCharm {
	id: string;
	name: string;
	slots: number;
	skill1: StoredCharmSkill;
	skill2: StoredCharmSkill | null;
	included: boolean;
	hypothetical?: boolean;
}

export interface StoredTopSet {
	key: string;
	label: string;
	count: number;
	targets: { name: string; tree: string; points: number }[];
	charms: StoredCharm[];
	includeNoCharm: boolean;
	possibleMode: string;
	settings: Record<string, unknown>;
	showCharms: boolean;
}

export interface RecordSearchInput {
	label: string;
	targets: { name: string; tree: string; points: number }[];
	charms: StoredCharm[];
	includeNoCharm: boolean;
	possibleMode: string;
	settings: Record<string, unknown>;
	showCharms: boolean;
}

const RANK_KEY = 'mhp3csc:topsets:rank';
const SET_PREFIX = 'mhp3csc:set:';
const MAX_TOP = 10;

let kv: Redis | null | undefined;
function getKv(): Redis | null {
	if (kv !== undefined) return kv;
	// $env/dynamic/private reads from .env in dev (via Vite) and process.env in prod.
	const url = env.KV_REST_API_URL;
	const token = env.KV_REST_API_TOKEN;
	if (!url || !token) {
		console.error('Upstash Redis not configured: missing KV_REST_API_URL/KV_REST_API_TOKEN');
		kv = null;
		return kv;
	}
	try {
		kv = new Redis({ url, token });
	} catch (e) {
		console.error('Upstash Redis not configured:', e);
		kv = null;
	}
	return kv;
}

function withoutGender(settings: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(Object.entries(settings).filter(([k]) => k !== 'gender'));
}

function keyFor(input: RecordSearchInput): string {
	// Gender is intentionally excluded so the same set searched with any
	// gender counts as a single entry.
	const serialized = JSON.stringify({
		targets: input.targets,
		charms: input.charms,
		includeNoCharm: input.includeNoCharm,
		possibleMode: input.possibleMode,
		settings: withoutGender(input.settings)
	});
	return createHash('sha256').update(serialized).digest('hex').slice(0, 16);
}

/** Records one successful search and returns the set's updated count. */
export async function recordSearch(input: RecordSearchInput): Promise<number> {
	const client = getKv();
	if (!client) return 0;
	const key = keyFor(input);
	// Atomic increment; count lives in the sorted set so ordering stays correct.
	const count = await client.zincrby(RANK_KEY, 1, key);
	await client.hset(SET_PREFIX + key, {
		label: input.label,
		targets: JSON.stringify(input.targets),
		charms: JSON.stringify(input.charms),
		includeNoCharm: String(input.includeNoCharm),
		possibleMode: input.possibleMode,
		settings: JSON.stringify(withoutGender(input.settings)),
		showCharms: String(input.showCharms)
	});
	return count;
}

function parseEntry(
	key: string,
	score: number,
	data: Record<string, unknown> | null
): StoredTopSet | null {
	if (!data) return null;
	const str = (v: unknown): string => (typeof v === 'string' ? v : '');
	try {
		return {
			key,
			count: score,
			label: str(data.label) || key,
			targets: Array.isArray(data.targets) ? (data.targets as StoredTopSet['targets']) : [],
			charms: Array.isArray(data.charms) ? (data.charms as StoredCharm[]) : [],
			includeNoCharm: data.includeNoCharm === true,
			possibleMode: str(data.possibleMode),
			settings:
				typeof data.settings === 'object' && data.settings !== null
					? (data.settings as Record<string, unknown>)
					: {},
			showCharms: data.showCharms === true
		};
	} catch {
		return null;
	}
}

/** Returns the top sets, sorted by search count descending. */
export async function getTopSets(): Promise<StoredTopSet[]> {
	const client = getKv();
	if (!client) return [];
	// zrange with withScores returns a flat [member, score, member, score, …] array.
	const ranked = await client.zrange<(string | number)[]>(RANK_KEY, 0, MAX_TOP - 1, {
		rev: true,
		withScores: true
	});
	const out: StoredTopSet[] = [];
	for (let i = 0; i + 1 < ranked.length; i += 2) {
		const member = String(ranked[i]);
		const score = Number(ranked[i + 1]);
		const data = await client.hgetall(SET_PREFIX + member);
		const entry = parseEntry(member, score, data);
		if (entry) out.push(entry);
	}
	return out;
}
