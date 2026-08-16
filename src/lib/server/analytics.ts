import { Redis } from '@upstash/redis';
import { env } from '$env/dynamic/private';

export interface AnalyticsResult {
	visitors: number | null;
	pageviews: number | null;
	fetchedAt: string | null;
	configured: boolean;
	error?: string;
}

const CACHE_KEY = 'mhp3csc:analytics';
const CACHE_TTL = 300; // seconds

let kv: Redis | null | undefined;
function getKv(): Redis | null {
	if (kv !== undefined) return kv;
	const url = env.KV_REST_API_URL;
	const token = env.KV_REST_API_TOKEN;
	if (!url || !token) {
		kv = null;
		return kv;
	}
	try {
		kv = new Redis({ url, token });
	} catch {
		kv = null;
	}
	return kv;
}

/** Hobby plans only expose the latest 31 days of analytics data. */
const WINDOW_DAYS = 31;

/**
 * Fetches visitors and page views from the Vercel Web Analytics API over the
 * last 31 days (the maximum window available on the hobby plan).
 * Results are cached in Upstash Redis to stay within API rate limits.
 */
export async function getAnalytics(): Promise<AnalyticsResult> {
	const client = getKv();

	if (client) {
		try {
			const cached = await client.hgetall<{
				visitors: string;
				pageviews: string;
				fetchedAt: string;
			}>(CACHE_KEY);
			if (cached?.visitors && cached?.pageviews) {
				return {
					visitors: Number(cached.visitors),
					pageviews: Number(cached.pageviews),
					fetchedAt: cached.fetchedAt,
					configured: true
				};
			}
		} catch (e) {
			console.error('Failed to read analytics cache:', e);
		}
	}

	const token = env.VERCEL_TOKEN;
	const projectId = env.VERCEL_PROJECT_ID;
	if (!token || !projectId) {
		return {
			visitors: null,
			pageviews: null,
			fetchedAt: null,
			configured: false,
			error: 'VERCEL_TOKEN and VERCEL_PROJECT_ID are not configured'
		};
	}

	const teamId = env.VERCEL_TEAM_ID;
	const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
	const until = new Date().toISOString();
	const params = new URLSearchParams({ projectId, since, until });
	if (teamId) params.set('teamId', teamId);

	try {
		const res = await fetch(
			`https://api.vercel.com/v1/query/web-analytics/visits/count?${params}`,
			{
				headers: { Authorization: `Bearer ${token}` }
			}
		);
		if (!res.ok) {
			const body = await res.text().catch(() => '');
			return {
				visitors: null,
				pageviews: null,
				fetchedAt: null,
				configured: true,
				error: `Vercel API responded with ${res.status}: ${body.slice(0, 200)}`
			};
		}
		const json: { data?: { visitors?: number; pageviews?: number } } = await res.json();
		const visitors = json.data?.visitors ?? null;
		const pageviews = json.data?.pageviews ?? null;
		const fetchedAt = new Date().toISOString();

		if (client) {
			try {
				await client.hset(CACHE_KEY, {
					visitors: String(visitors ?? ''),
					pageviews: String(pageviews ?? ''),
					fetchedAt
				});
				await client.expire(CACHE_KEY, CACHE_TTL);
			} catch (e) {
				console.error('Failed to cache analytics:', e);
			}
		}

		return { visitors, pageviews, fetchedAt, configured: true };
	} catch (e) {
		return {
			visitors: null,
			pageviews: null,
			fetchedAt: null,
			configured: true,
			error: e instanceof Error ? e.message : String(e)
		};
	}
}

/** Formats a number with thousands separators (en-US style). */
export function formatCount(value: number | null): string {
	if (value === null || !Number.isFinite(value)) return '—';
	return value.toLocaleString('en-US');
}
