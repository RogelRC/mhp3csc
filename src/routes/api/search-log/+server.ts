import { json } from '@sveltejs/kit';
import { recordSearch } from '$lib/server/topSets';
import type { RecordSearchInput } from '$lib/server/topSets';

export async function POST({ request }) {
	try {
		const body: RecordSearchInput = await request.json();
		if (!Array.isArray(body?.targets)) {
			return new Response('invalid payload', { status: 400 });
		}
		const count = await recordSearch(body);
		return json({ count });
	} catch (e) {
		console.error(e);
		return new Response('error', { status: 500 });
	}
}
