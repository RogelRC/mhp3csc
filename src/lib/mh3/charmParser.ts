// Parses MHP3rd save data for charms stored in the equipment boxes.
//
// Layout (verified against the real save and mhp3_offsets.py):
//   - the game-layer plain save is 0x121008 bytes, one 0x60000 block per character
//   - each character's equipment chest starts at 0x968 + n * 0x60000
//   - each chest has 1000 slots (10 pages x 100) of 12 bytes, contiguous
//   - a valid charm slot starts with the type bytes 0x01 0x65 (Talisman);
//     weapons/armor use other type bytes (0x0100-0x0111) and are skipped

export const CHARM_REGION_BASE = 0x968;
export const CHAR_STRIDE = 0x60000;
export const SLOTS_PER_CHAR = 1000;
export const CHARM_ENTRY_SIZE = 12;

export const CHARM_MAGIC0 = 0x01;
export const CHARM_MAGIC1 = 0x65;

export interface ParsedCharm {
	/** Absolute offset in the plain save data. */
	offset: number;
	/** Charm rank, 1-7. */
	rarity: number;
	/** Decoration slots, 0-3. */
	slots: number;
	skill1Code: number;
	skill1Points: number;
	skill2Code: number;
	skill2Points: number;
}

/**
 * Decode a single 12-byte charm entry. Returns null when the entry is empty or
 * the magic bytes do not match.
 */
export function parseCharmEntry(bytes: Uint8Array, offset: number): ParsedCharm | null {
	if (bytes.length < CHARM_ENTRY_SIZE) return null;
	if (bytes[0] !== CHARM_MAGIC0 || bytes[1] !== CHARM_MAGIC1) return null;
	return {
		offset,
		rarity: (bytes[2] & 0x0f) + 1,
		slots: bytes[5] >> 6,
		skill1Code: bytes[4] & 0x7f,
		skill1Points: (((bytes[3] & 0x03) << 4) | (bytes[2] >> 4)) - 30,
		skill2Code: ((bytes[5] & 0x3f) << 1) | (bytes[4] >> 7),
		skill2Points: ((bytes[3] >> 2) & 0x3f) - 30
	};
}

/** Scan every equipment chest of every character for charms. */
export function parseCharmEntries(decryptedSave: Uint8Array): ParsedCharm[] {
	const charms: ParsedCharm[] = [];
	for (let ch = 0; ch < 3; ch++) {
		const charBase = CHARM_REGION_BASE + ch * CHAR_STRIDE;
		for (let slot = 0; slot < SLOTS_PER_CHAR; slot++) {
			const offset = charBase + slot * CHARM_ENTRY_SIZE;
			if (offset + CHARM_ENTRY_SIZE > decryptedSave.length) return charms;
			const entry = parseCharmEntry(
				decryptedSave.subarray(offset, offset + CHARM_ENTRY_SIZE),
				offset
			);
			if (entry) charms.push(entry);
		}
	}
	return charms;
}
