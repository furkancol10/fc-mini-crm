import { describe, expect, it } from 'vitest';
import { calculateBalance, getPaymentStatusLabel } from '$lib/domain/balance';

describe('balance domain (türetilmiş bakiye)', () => {
	it('onaylı teklif ve ödeme yoksa no_quote döner', () => {
		const res = calculateBalance({ approvedTotalKurus: null, paymentsKurus: [] });
		expect(res).toEqual({
			hasApprovedQuote: false,
			approvedTotalKurus: 0,
			paidTotalKurus: 0,
			remainingKurus: 0,
			status: 'no_quote'
		});
	});

	it('onaylı teklif var ama ödeme yoksa unpaid ve tam bakiye döner', () => {
		const res = calculateBalance({ approvedTotalKurus: 1200_00, paymentsKurus: [] });
		expect(res.status).toBe('unpaid');
		expect(res.paidTotalKurus).toBe(0);
		expect(res.remainingKurus).toBe(1200_00);
		expect(getPaymentStatusLabel(res.status)).toBe('Ödenmedi');
	});

	it('kısmi ödeme sonrası partial ve doğru kalan bakiye döner', () => {
		const res = calculateBalance({
			approvedTotalKurus: 1200_00,
			paymentsKurus: [400_00, 300_00]
		});
		expect(res.status).toBe('partial');
		expect(res.paidTotalKurus).toBe(700_00);
		expect(res.remainingKurus).toBe(500_00);
		expect(getPaymentStatusLabel(res.status)).toBe('Kısmi Ödendi');
	});

	it('tam ödeme sonrası paid ve 0 bakiye döner', () => {
		const res = calculateBalance({
			approvedTotalKurus: 1200_00,
			paymentsKurus: [500_00, 700_00]
		});
		expect(res.status).toBe('paid');
		expect(res.paidTotalKurus).toBe(1200_00);
		expect(res.remainingKurus).toBe(0);
		expect(getPaymentStatusLabel(res.status)).toBe('Ödendi');
	});

	it('fazla ödemede overpaid ve negatif kalan bakiye döner', () => {
		const res = calculateBalance({
			approvedTotalKurus: 1000_00,
			paymentsKurus: [1250_00]
		});
		expect(res.status).toBe('overpaid');
		expect(res.remainingKurus).toBe(-250_00);
	});

	it('sıfır veya negatif ödeme tutarında hata fırlatır', () => {
		expect(() => calculateBalance({ approvedTotalKurus: 1000_00, paymentsKurus: [0] })).toThrow();
		expect(() =>
			calculateBalance({ approvedTotalKurus: 1000_00, paymentsKurus: [-100] })
		).toThrow();
	});
});
