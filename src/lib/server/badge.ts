/** Renders a shields.io-style badge as an SVG string. */
export function renderBadge(label: string, value: string, color: string): string {
	const FONT = 'Verdana,DejaVu Sans,sans-serif';
	const fontSize = 11;
	const padding = 10;
	// Rough text width estimate for an 11px sans-serif font.
	const textWidth = (t: string): number => t.length * 6.2;

	const leftWidth = Math.ceil(textWidth(label) + padding * 2);
	const rightWidth = Math.ceil(textWidth(value) + padding * 2);
	const totalWidth = leftWidth + rightWidth;

	const escapeXml = (t: string): string =>
		t
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${escapeXml(label)}: ${escapeXml(value)}">`,
		`  <title>${escapeXml(label)}: ${escapeXml(value)}</title>`,
		`  <rect width="${totalWidth}" height="20" rx="3" fill="#333"/>`,
		`  <rect width="${leftWidth}" height="20" fill="#555"/>`,
		`  <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${color}"/>`,
		`  <g fill="#fff" text-anchor="middle" font-family="${FONT}" font-size="${fontSize}">`,
		`    <text x="${leftWidth / 2}" y="14">${escapeXml(label)}</text>`,
		`    <text x="${leftWidth + rightWidth / 2}" y="14">${escapeXml(value)}</text>`,
		'  </g>',
		'</svg>'
	].join('\n');
}

const SVG_HEADERS: Record<string, string> = {
	'content-type': 'image/svg+xml; charset=utf-8',
	'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600'
};

export function badgeResponse(svg: string): Response {
	return new Response(svg, { headers: SVG_HEADERS });
}
