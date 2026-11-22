import { z } from 'zod';

export const serviceMetadataSchema = z.object({
	device: z.string().trim().max(120).optional(),
	brand: z.string().trim().max(80).optional(),
	model: z.string().trim().max(80).optional(),
	serialNo: z.string().trim().max(100).optional(),
	accessories: z.string().trim().max(240).optional(),
	diagnosis: z.string().trim().max(1000).optional()
});

export const agencyMetadataSchema = z.object({
	channel: z.string().trim().max(100).optional(),
	deliverableUrl: z
		.string()
		.trim()
		.max(500)
		.refine(
			(val) => val === '' || val.startsWith('https://') || val.startsWith('http://'),
			'Teslim bağlantısı http:// veya https:// ile başlamalıdır'
		)
		.optional(),
	brief: z.string().trim().max(1000).optional()
});

export type ServiceMetadata = z.infer<typeof serviceMetadataSchema>;
export type AgencyMetadata = z.infer<typeof agencyMetadataSchema>;
export type WorkMetadata = ServiceMetadata | AgencyMetadata;

export type WorkType = 'service' | 'agency';

export function parseWorkMetadata(workType: WorkType, input: unknown): WorkMetadata {
	const raw = input ?? {};
	if (workType === 'service') {
		return serviceMetadataSchema.parse(raw);
	}
	return agencyMetadataSchema.parse(raw);
}
