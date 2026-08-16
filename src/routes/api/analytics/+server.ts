import { json } from '@sveltejs/kit';
import { getAnalytics } from '$lib/server/analytics';

export async function GET() {
	const analytics = await getAnalytics();
	return json(analytics, {
		headers: {
			'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600'
		}
	});
}
