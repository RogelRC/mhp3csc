import { Redis } from '@upstash/redis';

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;
if (!url || !token) {
	console.error('Missing KV_REST_API_URL/KV_REST_API_TOKEN (or .env)');
	process.exit(1);
}

const client = new Redis({ url, token });
const RANK_KEY = 'mhp3csc:topsets:rank';
const SET_PREFIX = 'mhp3csc:set:';

// Set keys are 16 hex chars; glob for all of them.
const setKeys = await client.keys(SET_PREFIX + '????????????????');
if (setKeys.length > 0) await client.del(...setKeys);
await client.del(RANK_KEY);

console.log(`Reset top-sets: removed ${setKeys.length} set hashes and the rank key.`);
