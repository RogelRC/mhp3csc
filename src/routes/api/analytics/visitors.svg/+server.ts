import { getAnalytics, formatCount } from '$lib/server/analytics';
import { badgeResponse, renderBadge } from '$lib/server/badge';

export async function GET() {
	const analytics = await getAnalytics();
	const value = formatCount(analytics.visitors);
	const color = analytics.configured && analytics.visitors !== null ? '#1d4ed8' : '#9ca3af';
	return badgeResponse(renderBadge('visitors', value, color));
}
