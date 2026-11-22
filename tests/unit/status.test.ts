import { describe, expect, it } from 'vitest';
import {
	ALL_WORK_STATUSES,
	InvalidStatusTransitionError,
	assertTransition,
	canTransition,
	getAllowedNextStatuses,
	getStatusLabel
} from '$lib/domain/status';

describe('status transition domain', () => {
	it('tam olarak onaylı 8 iş durumunu tanımlar', () => {
		expect(ALL_WORK_STATUSES).toEqual([
			'new',
			'quoted',
			'approved',
			'in_progress',
			'waiting',
			'ready',
			'delivered',
			'cancelled'
		]);
	});

	it('normal iş akışı geçişlerine izin verir', () => {
		expect(canTransition('new', 'quoted')).toBe(true);
		expect(canTransition('quoted', 'approved')).toBe(true);
		expect(canTransition('approved', 'in_progress')).toBe(true);
		expect(canTransition('in_progress', 'waiting')).toBe(true);
		expect(canTransition('waiting', 'in_progress')).toBe(true);
		expect(canTransition('in_progress', 'ready')).toBe(true);
		expect(canTransition('ready', 'delivered')).toBe(true);
	});

	it('geçersiz veya terminal durum geçişlerini reddeder', () => {
		expect(canTransition('new', 'delivered')).toBe(false);
		expect(canTransition('new', 'ready')).toBe(false);
		expect(canTransition('quoted', 'delivered')).toBe(false);
		expect(canTransition('delivered', 'in_progress')).toBe(false);
		expect(canTransition('delivered', 'cancelled')).toBe(false);
		expect(canTransition('cancelled', 'approved')).toBe(false);
		expect(canTransition('in_progress', 'in_progress')).toBe(false);

		expect(() => assertTransition('new', 'delivered')).toThrow(InvalidStatusTransitionError);
		expect(() => assertTransition('delivered', 'ready')).toThrow(InvalidStatusTransitionError);
	});

	it('terminal durumlar için boş sonraki durum listesi döner', () => {
		expect(getAllowedNextStatuses('delivered')).toEqual([]);
		expect(getAllowedNextStatuses('cancelled')).toEqual([]);
	});

	it('sektöre göre Türkçe durum etiketi verir', () => {
		expect(getStatusLabel('new', 'service')).toBe('Kabul Alındı');
		expect(getStatusLabel('new', 'agency')).toBe('Talep / Lead');
		expect(getStatusLabel('ready', 'service')).toBe('Teslime Hazır');
	});
});
