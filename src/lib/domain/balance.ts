export type DerivedPaymentStatus = 'no_quote' | 'unpaid' | 'partial' | 'paid' | 'overpaid';

export interface BalanceInput {
	approvedTotalKurus: number | null;
	paymentsKurus: number[];
}

export interface BalanceResult {
	hasApprovedQuote: boolean;
	approvedTotalKurus: number;
	paidTotalKurus: number;
	remainingKurus: number;
	status: DerivedPaymentStatus;
}

export function calculateBalance(input: BalanceInput): BalanceResult {
	const hasApprovedQuote = input.approvedTotalKurus !== null;
	const approvedTotalKurus = input.approvedTotalKurus ?? 0;

	if (!Number.isInteger(approvedTotalKurus) || approvedTotalKurus < 0) {
		throw new RangeError('Onaylı teklif tutarı negatif olmayan tam kuruş olmalıdır');
	}

	let paidTotalKurus = 0;
	for (const amount of input.paymentsKurus) {
		if (!Number.isInteger(amount) || amount <= 0) {
			throw new RangeError('Ödeme tutarı pozitif tam kuruş olmalıdır');
		}
		paidTotalKurus += amount;
	}

	const remainingKurus = approvedTotalKurus - paidTotalKurus;

	let status: DerivedPaymentStatus;
	if (!hasApprovedQuote && paidTotalKurus === 0) {
		status = 'no_quote';
	} else if (paidTotalKurus === 0) {
		status = 'unpaid';
	} else if (hasApprovedQuote && paidTotalKurus < approvedTotalKurus) {
		status = 'partial';
	} else if (hasApprovedQuote && paidTotalKurus === approvedTotalKurus) {
		status = 'paid';
	} else {
		status = 'overpaid';
	}

	return {
		hasApprovedQuote,
		approvedTotalKurus,
		paidTotalKurus,
		remainingKurus,
		status
	};
}

const PAYMENT_STATUS_LABELS: Record<DerivedPaymentStatus, string> = {
	no_quote: 'Onaylı Teklif Yok',
	unpaid: 'Ödenmedi',
	partial: 'Kısmi Ödendi',
	paid: 'Ödendi',
	overpaid: 'Fazla Ödeme'
};

export function getPaymentStatusLabel(status: DerivedPaymentStatus): string {
	return PAYMENT_STATUS_LABELS[status];
}
