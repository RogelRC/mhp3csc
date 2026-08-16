import { getAnalytics, formatCount } from '$lib/server/analytics';
import { badgeResponse, renderBadge } from '$lib/server/badge';

export async function GET() {
	const analytics = await getAnalytics();
	const value = formatCount(analytics.pageviews);
	const color = analytics.configured && analytics.pageviews !== null ? '#0d9488' : '#9ca3af';
	return badgeResponse(renderBadge('page views', value, color));
}
