import { json } from '@sveltejs/kit';
import { getTopSets } from '$lib/server/topSets';

export async function GET() {
	return json(await getTopSets(), {
		headers: { 'cache-control': 'no-store' }
	});
}
