import crypto from 'node:crypto';
import type { WorkType } from './metadata';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomFromAlphabet(length: number): string {
	const bytes = crypto.randomBytes(length);
	let result = '';
	for (let i = 0; i < length; i++) {
		result += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
	}
	return result;
}

export function generateWorkCode(workType: WorkType): string {
	const prefix = workType === 'agency' ? 'AJ' : 'TS';
	return `${prefix}-${randomFromAlphabet(6)}`;
}

export function generatePublicToken(): string {
	return crypto.randomBytes(18).toString('base64url');
}

export function generateQuoteNo(workCode: string, version: number): string {
	return `TKL-${workCode}-V${version}`;
}
