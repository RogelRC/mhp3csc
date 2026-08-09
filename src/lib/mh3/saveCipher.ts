// Pure TypeScript port of the MHP3rd save-file encryption (mhef psp.py,
// MHP3_JP). Runs in the browser with no dependencies.
//
// Save.BIN (16448 bytes) decrypts in two stages:
//   1. PSPSavedataCipher.decrypt  ->  game-layer data (16432 bytes)
//   2. SavedataCipher.decrypt     ->  plain save data  (16408 bytes)
//
// Only AES-128 and SHA-1 are needed, both implemented here.

import { savedataEncodeTable, savedataDecodeTable } from './tables.ts';

// ---------------------------------------------------------------------------
// AES-128
// ---------------------------------------------------------------------------

const SBOX = new Uint8Array([
	0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
	0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
	0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
	0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
	0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
	0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
	0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
	0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
	0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
	0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
	0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
	0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
	0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
	0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
	0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
	0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
]);

const INV_SBOX = new Uint8Array(256);
for (let i = 0; i < 256; i++) INV_SBOX[SBOX[i]] = i;

const RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

function gmul(a: number, b: number): number {
	let p = 0;
	while (b) {
		if (b & 1) p ^= a;
		const hi = a & 0x80;
		a = (a << 1) & 0xff;
		if (hi) a ^= 0x1b;
		b >>>= 1;
	}
	return p;
}

function expandKey(key: Uint8Array): Uint8Array {
	const w = new Uint8Array(176);
	w.set(key.subarray(0, 16));
	for (let i = 4; i < 44; i++) {
		let t0 = w[(i - 1) * 4];
		let t1 = w[(i - 1) * 4 + 1];
		let t2 = w[(i - 1) * 4 + 2];
		let t3 = w[(i - 1) * 4 + 3];
		if (i % 4 === 0) {
			const r = RCON[(i >>> 2) - 1];
			const b0 = t0;
			t0 = SBOX[t1] ^ r;
			t1 = SBOX[t2];
			t2 = SBOX[t3];
			t3 = SBOX[b0];
		}
		const base = (i - 4) * 4;
		w[i * 4] = w[base] ^ t0;
		w[i * 4 + 1] = w[base + 1] ^ t1;
		w[i * 4 + 2] = w[base + 2] ^ t2;
		w[i * 4 + 3] = w[base + 3] ^ t3;
	}
	return w;
}

function addRoundKey(s: Uint8Array, w: Uint8Array, round: number): void {
	for (let c = 0; c < 4; c++) {
		for (let r = 0; r < 4; r++) {
			s[4 * c + r] ^= w[16 * round + 4 * c + r];
		}
	}
}

function shiftRowsLeft(s: Uint8Array): void {
	const t = s.slice();
	for (let r = 0; r < 4; r++) {
		for (let c = 0; c < 4; c++) {
			s[4 * c + r] = t[4 * ((c + r) % 4) + r];
		}
	}
}

function shiftRowsRight(s: Uint8Array): void {
	const t = s.slice();
	for (let r = 0; r < 4; r++) {
		for (let c = 0; c < 4; c++) {
			s[4 * c + r] = t[4 * ((c - r + 4) % 4) + r];
		}
	}
}

function mixColumns(s: Uint8Array): void {
	for (let c = 0; c < 4; c++) {
		const i = 4 * c;
		const a0 = s[i];
		const a1 = s[i + 1];
		const a2 = s[i + 2];
		const a3 = s[i + 3];
		s[i] = gmul(a0, 2) ^ gmul(a1, 3) ^ a2 ^ a3;
		s[i + 1] = a0 ^ gmul(a1, 2) ^ gmul(a2, 3) ^ a3;
		s[i + 2] = a0 ^ a1 ^ gmul(a2, 2) ^ gmul(a3, 3);
		s[i + 3] = gmul(a0, 3) ^ a1 ^ a2 ^ gmul(a3, 2);
	}
}

function invMixColumns(s: Uint8Array): void {
	for (let c = 0; c < 4; c++) {
		const i = 4 * c;
		const a0 = s[i];
		const a1 = s[i + 1];
		const a2 = s[i + 2];
		const a3 = s[i + 3];
		s[i] = gmul(a0, 14) ^ gmul(a1, 11) ^ gmul(a2, 13) ^ gmul(a3, 9);
		s[i + 1] = gmul(a0, 9) ^ gmul(a1, 14) ^ gmul(a2, 11) ^ gmul(a3, 13);
		s[i + 2] = gmul(a0, 13) ^ gmul(a1, 9) ^ gmul(a2, 14) ^ gmul(a3, 11);
		s[i + 3] = gmul(a0, 11) ^ gmul(a1, 13) ^ gmul(a2, 9) ^ gmul(a3, 14);
	}
}

function aesEncryptBlock(block: Uint8Array, w: Uint8Array): Uint8Array {
	const s = block.slice();
	addRoundKey(s, w, 0);
	for (let round = 1; round < 10; round++) {
		for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];
		shiftRowsLeft(s);
		mixColumns(s);
		addRoundKey(s, w, round);
	}
	for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];
	shiftRowsLeft(s);
	addRoundKey(s, w, 10);
	return s;
}

function aesDecryptBlock(block: Uint8Array, w: Uint8Array): Uint8Array {
	const s = block.slice();
	addRoundKey(s, w, 10);
	for (let round = 9; round >= 1; round--) {
		for (let i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]];
		shiftRowsRight(s);
		addRoundKey(s, w, round);
		invMixColumns(s);
	}
	for (let i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]];
	shiftRowsRight(s);
	addRoundKey(s, w, 0);
	return s;
}

function aesCbcDecrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
	if (data.length % 16 !== 0) throw new Error('AES-CBC input length must be a multiple of 16.');
	const w = expandKey(key);
	const out = new Uint8Array(data.length);
	let prev = iv;
	for (let off = 0; off < data.length; off += 16) {
		const block = data.subarray(off, off + 16);
		const dec = aesDecryptBlock(block, w);
		for (let i = 0; i < 16; i++) out[off + i] = dec[i] ^ prev[i];
		prev = block;
	}
	return out;
}

// ---------------------------------------------------------------------------
// SHA-1
// ---------------------------------------------------------------------------

function sha1(data: Uint8Array): Uint8Array {
	const bitLen = data.length * 8;
	const paddedLen = Math.ceil((data.length + 9) / 64) * 64;
	const msg = new Uint8Array(paddedLen);
	msg.set(data);
	msg[data.length] = 0x80;
	const dv = new DataView(msg.buffer);
	dv.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
	dv.setUint32(paddedLen - 4, bitLen >>> 0, false);

	let h0 = 0x67452301;
	let h1 = 0xefcdab89;
	let h2 = 0x98badcfe;
	let h3 = 0x10325476;
	let h4 = 0xc3d2e1f0;
	const w = new Uint32Array(80);

	for (let off = 0; off < paddedLen; off += 64) {
		for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
		for (let i = 16; i < 80; i++) {
			const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
			w[i] = ((x << 1) | (x >>> 31)) >>> 0;
		}
		let a = h0;
		let b = h1;
		let c = h2;
		let d = h3;
		let e = h4;
		for (let i = 0; i < 80; i++) {
			let f: number;
			let k: number;
			if (i < 20) {
				f = (b & c) | (~b & d);
				k = 0x5a827999;
			} else if (i < 40) {
				f = b ^ c ^ d;
				k = 0x6ed9eba1;
			} else if (i < 60) {
				f = (b & c) | (b & d) | (c & d);
				k = 0x8f1bbcdc;
			} else {
				f = b ^ c ^ d;
				k = 0xca62c1d6;
			}
			const temp = ((((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0) >>> 0;
			e = d;
			d = c;
			c = ((b << 30) | (b >>> 2)) >>> 0;
			b = a;
			a = temp;
		}
		h0 = (h0 + a) >>> 0;
		h1 = (h1 + b) >>> 0;
		h2 = (h2 + c) >>> 0;
		h3 = (h3 + d) >>> 0;
		h4 = (h4 + e) >>> 0;
	}

	const out = new Uint8Array(20);
	const od = new DataView(out.buffer);
	od.setUint32(0, h0, false);
	od.setUint32(4, h1, false);
	od.setUint32(8, h2, false);
	od.setUint32(12, h3, false);
	od.setUint32(16, h4, false);
	return out;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function asciiBytes(s: string): Uint8Array {
	const out = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
	return out;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
	const len = parts.reduce((n, p) => n + p.length, 0);
	const out = new Uint8Array(len);
	let o = 0;
	for (const p of parts) {
		out.set(p, o);
		o += p.length;
	}
	return out;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
	return true;
}

function fromHex(s: string): Uint8Array {
	const out = new Uint8Array(s.length / 2);
	for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
	return out;
}

function translate(buff: Uint8Array, table: Uint8Array): Uint8Array {
	const out = new Uint8Array(buff.length);
	for (let i = 0; i < buff.length; i++) out[i] = table[buff[i]];
	return out;
}

// ---------------------------------------------------------------------------
// Game layer (mhef SavedataCipher, MHP3_JP)
// ---------------------------------------------------------------------------

const HASH_SALT = 'VQ(DOdIO9?X3!2GmW#XF';
const SAVEDATA_KEY_DEFAULT: readonly [number, number] = [0xdfa3, 0x215f];
const SAVEDATA_KEY_MODIFIER: readonly [number, number] = [0xffef, 0xff8f];

function dataCipherXor(
	buff: Uint8Array,
	seed: number,
	keyDefault: readonly [number, number],
	keyModifier: readonly [number, number]
): Uint8Array {
	if (buff.length % 4 !== 0) throw new Error('XOR cipher input length must be a multiple of 4.');
	let k0 = (seed >>> 16) & 0xffff;
	let k1 = seed & 0xffff;
	if (k0 === 0) k0 = keyDefault[0];
	if (k1 === 0) k1 = keyDefault[1];
	const out = buff.slice();
	const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
	for (let i = 0; i < out.length; i += 4) {
		k0 = (k0 * keyDefault[0]) % keyModifier[0];
		k1 = (k1 * keyDefault[1]) % keyModifier[1];
		const mask = k0 * 0x10000 + k1;
		dv.setUint32(i, (dv.getUint32(i, true) ^ mask) >>> 0, true);
	}
	return out;
}

export function encryptGameLayer(plain: Uint8Array, seed: number): Uint8Array {
	if (plain.length < 12) throw new Error('Save data too short.');
	const salt = asciiBytes(HASH_SALT);
	const mac = sha1(concatBytes(plain.subarray(0, plain.length - 12), salt));
	let body = concatBytes(plain, mac);
	body = translate(body, savedataEncodeTable);
	body = dataCipherXor(body, seed, SAVEDATA_KEY_DEFAULT, SAVEDATA_KEY_MODIFIER);
	body = translate(body, savedataEncodeTable);
	const seedBytes = new Uint8Array(4);
	new DataView(seedBytes.buffer).setUint32(0, seed & 0xffff, true);
	const seedEnc = translate(translate(seedBytes, savedataEncodeTable), savedataEncodeTable);
	return concatBytes(body, seedEnc);
}

export function decryptGameLayer(enc: Uint8Array): Uint8Array {
	if (enc.length < 24) throw new Error('Encrypted save data too short.');
	const seedBytes = translate(
		translate(enc.subarray(enc.length - 4), savedataDecodeTable),
		savedataDecodeTable
	);
	const seed =
		(seedBytes[0] | (seedBytes[1] << 8) | (seedBytes[2] << 16) | (seedBytes[3] << 24)) >>> 0;
	let buff = dataCipherXor(
		translate(enc.subarray(0, enc.length - 4), savedataDecodeTable),
		seed,
		SAVEDATA_KEY_DEFAULT,
		SAVEDATA_KEY_MODIFIER
	);
	buff = translate(buff, savedataDecodeTable);
	const md = buff.subarray(buff.length - 20);
	const body = buff.subarray(0, buff.length - 20);
	const salt = asciiBytes(HASH_SALT);
	const calc = sha1(concatBytes(body.subarray(0, body.length - 12), salt));
	if (!bytesEqual(md, calc)) throw new Error('Invalid SHA1 hash in save header.');
	return body;
}

// ---------------------------------------------------------------------------
// PSP layer (mhef PSPSavedataCipher, MHP3_JP)
// ---------------------------------------------------------------------------

const PSP_KEY = fromHex('e305cefaeb46b031859a275bdf32d863');
const PSP_CIPHER1 = fromHex('7044a3aeef5da5f2857ff2d694f5363b');
const PSP_CIPHER2 = fromHex('ec6d29592635a57f972a0dbca3263300');
const PSP_CIPHER3 = fromHex('5dc71139d01938bc027fdddcb0837d9d');
const PSP_CIPHER4 = fromHex('03b302e85ff381b13b8daa2a90ff5e61');
const ZERO_IV = new Uint8Array(16);

export function decryptPspLayer(enc: Uint8Array): Uint8Array {
	if (enc.length < 32 || enc.length % 16 !== 0) {
		throw new Error('PSP save file has an invalid length.');
	}
	const blockCount = enc.length / 16 - 1;
	const xorKey = new Uint8Array(16);
	for (let i = 0; i < 16; i++) xorKey[i] = enc[i] ^ PSP_CIPHER2[i] ^ PSP_KEY[i];
	const dec = aesDecryptBlock(xorKey, expandKey(PSP_CIPHER3));
	for (let i = 0; i < 12; i++) xorKey[i] = dec[i] ^ PSP_CIPHER1[i];
	const ksIn = new Uint8Array(blockCount * 16);
	const dv = new DataView(ksIn.buffer);
	for (let i = 0; i < blockCount; i++) {
		ksIn.set(xorKey.subarray(0, 12), i * 16);
		dv.setUint32(i * 16 + 12, i + 1, true);
	}
	const ks = aesCbcDecrypt(ksIn, PSP_CIPHER4, ZERO_IV);
	const payload = enc.subarray(16);
	const out = new Uint8Array(payload.length);
	for (let i = 0; i < payload.length; i++) out[i] = payload[i] ^ ks[i];
	return out;
}

export function encryptPspLayer(plain: Uint8Array, keyPrefix: Uint8Array): Uint8Array {
	if (plain.length % 16 !== 0)
		throw new Error('PSP save plaintext length must be a multiple of 16.');
	if (keyPrefix.length !== 16) throw new Error('PSP key prefix must be 16 bytes.');
	const blockCount = plain.length / 16;
	const ksIn = new Uint8Array(blockCount * 16);
	const dv = new DataView(ksIn.buffer);
	for (let i = 0; i < blockCount; i++) {
		ksIn.set(keyPrefix.subarray(0, 12), i * 16);
		dv.setUint32(i * 16 + 12, i + 1, true);
	}
	const ks = aesCbcDecrypt(ksIn, PSP_CIPHER4, ZERO_IV);
	const body = new Uint8Array(plain.length);
	for (let i = 0; i < plain.length; i++) body[i] = plain[i] ^ ks[i];
	const xk = keyPrefix.slice();
	for (let i = 0; i < 12; i++) xk[i] ^= PSP_CIPHER1[i];
	const xkEnc = aesEncryptBlock(xk, expandKey(PSP_CIPHER3));
	for (let i = 0; i < 16; i++) xkEnc[i] ^= PSP_CIPHER2[i] ^ PSP_KEY[i];
	return concatBytes(xkEnc, body);
}

// ---------------------------------------------------------------------------
// Top level
// ---------------------------------------------------------------------------

/** Decrypt a MHP3rd PSP save.BIN into the plain save data (0x4018 bytes). */
export function decryptSaveFile(file: Uint8Array): Uint8Array {
	return decryptGameLayer(decryptPspLayer(file));
}

/** Encrypt plain save data back into a PSP save.BIN (mainly for round-trip tests). */
export function encryptSaveFile(
	plain: Uint8Array,
	gameSeed: number,
	pspKeyPrefix: Uint8Array
): Uint8Array {
	return encryptPspLayer(encryptGameLayer(plain, gameSeed), pspKeyPrefix);
}
