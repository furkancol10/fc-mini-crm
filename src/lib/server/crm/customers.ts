import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { normalizeTrPhone } from '$lib/domain/phone';
import { requireAdmin, requireUser } from '$lib/server/auth/guard';
import type { AuthUser } from '$lib/server/auth/types';
import type { Database } from '$lib/server/db/client';
import { customers, workItems, type CustomerRow } from '$lib/server/db/schema';
import { ConflictError, NotFoundError, isPgForeignKeyViolation } from './errors';

const optionalTrimmed = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.optional()
		.nullable()
		.transform((v) => (v && v.length > 0 ? v : null));

export const createCustomerSchema = z.object({
	name: z.string().trim().min(2, 'Müşteri adı en az 2 karakter olmalıdır').max(120),
	company: optionalTrimmed(120),
	phone: optionalTrimmed(40),
	email: z
		.string()
		.trim()
		.max(160)
		.optional()
		.nullable()
		.transform((v) => (v && v.length > 0 ? v : null))
		.refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Geçersiz e-posta adresi'),
	taxNo: optionalTrimmed(32),
	kind: z.enum(['lead', 'active']).default('lead'),
	notes: optionalTrimmed(2000)
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.input<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.input<typeof updateCustomerSchema>;

function normalizePhoneField(phone: string | null | undefined): string | null | undefined {
	if (phone === undefined) return undefined;
	if (phone === null) return null;
	return normalizeTrPhone(phone) ?? phone;
}

export async function listCustomers(db: Database, user: AuthUser | null): Promise<CustomerRow[]> {
	requireUser(user);
	return db.select().from(customers).orderBy(desc(customers.createdAt), desc(customers.id));
}

export async function getCustomerById(
	db: Database,
	user: AuthUser | null,
	customerId: number
): Promise<CustomerRow> {
	requireUser(user);
	const [row] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
	if (!row) {
		throw new NotFoundError('Müşteri bulunamadı');
	}
	return row;
}

export async function getCustomerWithWorkItems(
	db: Database,
	user: AuthUser | null,
	customerId: number
) {
	const authed = requireUser(user);
	const customer = await getCustomerById(db, authed, customerId);

	const whereClause =
		authed.role === 'admin'
			? eq(workItems.customerId, customerId)
			: and(eq(workItems.customerId, customerId), eq(workItems.assignedTo, authed.id));

	const items = await db
		.select()
		.from(workItems)
		.where(whereClause)
		.orderBy(desc(workItems.createdAt), desc(workItems.id));

	return { customer, workItems: items };
}

export async function createCustomer(
	db: Database,
	user: AuthUser | null,
	input: CreateCustomerInput
): Promise<CustomerRow> {
	requireUser(user);
	const data = createCustomerSchema.parse(input);
	const phone = normalizePhoneField(data.phone) ?? null;

	const [created] = await db
		.insert(customers)
		.values({
			name: data.name,
			company: data.company ?? null,
			phone,
			email: data.email ?? null,
			taxNo: data.taxNo ?? null,
			kind: data.kind,
			notes: data.notes ?? null
		})
		.returning();

	return created;
}

export async function updateCustomer(
	db: Database,
	user: AuthUser | null,
	customerId: number,
	input: UpdateCustomerInput
): Promise<CustomerRow> {
	requireUser(user);
	const data = updateCustomerSchema.parse(input);
	const patch: Partial<typeof customers.$inferInsert> = {
		updatedAt: new Date()
	};

	if (data.name !== undefined) patch.name = data.name;
	if (data.company !== undefined) patch.company = data.company;
	if (data.phone !== undefined) patch.phone = normalizePhoneField(data.phone) ?? null;
	if (data.email !== undefined) patch.email = data.email;
	if (data.taxNo !== undefined) patch.taxNo = data.taxNo;
	if (data.kind !== undefined) patch.kind = data.kind;
	if (data.notes !== undefined) patch.notes = data.notes;

	const [updated] = await db
		.update(customers)
		.set(patch)
		.where(eq(customers.id, customerId))
		.returning();

	if (!updated) {
		throw new NotFoundError('Müşteri bulunamadı');
	}
	return updated;
}

export async function deleteCustomer(
	db: Database,
	user: AuthUser | null,
	customerId: number
): Promise<void> {
	requireAdmin(user);
	try {
		const deleted = await db
			.delete(customers)
			.where(eq(customers.id, customerId))
			.returning({ id: customers.id });

		if (deleted.length === 0) {
			throw new NotFoundError('Müşteri bulunamadı');
		}
	} catch (err) {
		if (isPgForeignKeyViolation(err)) {
			throw new ConflictError('Bu müşteriye bağlı iş kayıtları olduğu için silinemez');
		}
		throw err;
	}
}
