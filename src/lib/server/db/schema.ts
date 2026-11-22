import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	numeric,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import type { WorkMetadata } from '../../domain/metadata';

export const userRoleEnum = pgEnum('user_role', ['admin', 'staff']);
export const userSpecialtyEnum = pgEnum('user_specialty', ['service', 'agency', 'all']);
export const customerKindEnum = pgEnum('customer_kind', ['lead', 'active']);
export const workTypeEnum = pgEnum('work_type', ['service', 'agency']);
export const workStatusEnum = pgEnum('work_status', [
	'new',
	'quoted',
	'approved',
	'in_progress',
	'waiting',
	'ready',
	'delivered',
	'cancelled'
]);
export const workPriorityEnum = pgEnum('work_priority', ['low', 'normal', 'high']);
export const quoteStatusEnum = pgEnum('quote_status', [
	'draft',
	'sent',
	'approved',
	'rejected',
	'expired'
]);
export const quoteItemKindEnum = pgEnum('quote_item_kind', ['part', 'labor', 'service']);
export const workLogTypeEnum = pgEnum('work_log_type', ['status', 'note', 'quote', 'payment']);
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'card', 'transfer']);

export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	role: userRoleEnum('role').notNull(),
	specialty: userSpecialtyEnum('specialty').notNull().default('all'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const customers = pgTable(
	'customers',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull(),
		company: text('company'),
		phone: text('phone'),
		email: text('email'),
		taxNo: text('tax_no'),
		kind: customerKindEnum('kind').notNull().default('lead'),
		notes: text('notes'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [index('customers_kind_idx').on(table.kind)]
);

export const workItems = pgTable(
	'work_items',
	{
		id: serial('id').primaryKey(),
		customerId: integer('customer_id')
			.notNull()
			.references(() => customers.id, { onDelete: 'restrict' }),
		assignedTo: integer('assigned_to').references(() => users.id, { onDelete: 'set null' }),
		code: text('code').notNull().unique(),
		publicToken: text('public_token').notNull().unique(),
		workType: workTypeEnum('work_type').notNull(),
		title: text('title').notNull(),
		status: workStatusEnum('status').notNull().default('new'),
		priority: workPriorityEnum('priority').notNull().default('normal'),
		metadata: jsonb('metadata').$type<WorkMetadata>().notNull().default({}),
		description: text('description'),
		dueDate: timestamp('due_date', { withTimezone: true }),
		deliveredAt: timestamp('delivered_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		index('work_items_customer_idx').on(table.customerId),
		index('work_items_assigned_to_idx').on(table.assignedTo),
		index('work_items_status_idx').on(table.status),
		index('work_items_type_idx').on(table.workType)
	]
);

export const quotes = pgTable(
	'quotes',
	{
		id: serial('id').primaryKey(),
		workItemId: integer('work_item_id')
			.notNull()
			.references(() => workItems.id, { onDelete: 'cascade' }),
		quoteNo: text('quote_no').notNull().unique(),
		version: integer('version').notNull().default(1),
		status: quoteStatusEnum('status').notNull().default('draft'),
		vatIncluded: boolean('vat_included').notNull().default(false),
		subtotalKurus: integer('subtotal_kurus').notNull().default(0),
		vatTotalKurus: integer('vat_total_kurus').notNull().default(0),
		totalKurus: integer('total_kurus').notNull().default(0),
		notes: text('notes'),
		validUntil: timestamp('valid_until', { withTimezone: true }),
		approvedAt: timestamp('approved_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		index('quotes_work_item_idx').on(table.workItemId),
		uniqueIndex('quotes_work_item_version_uniq').on(table.workItemId, table.version),
		uniqueIndex('quotes_one_approved_per_work_item_idx')
			.on(table.workItemId)
			.where(sql`${table.status} = 'approved'`)
	]
);

export const quoteItems = pgTable(
	'quote_items',
	{
		id: serial('id').primaryKey(),
		quoteId: integer('quote_id')
			.notNull()
			.references(() => quotes.id, { onDelete: 'cascade' }),
		kind: quoteItemKindEnum('kind').notNull().default('service'),
		description: text('description').notNull(),
		qty: numeric('qty', { precision: 10, scale: 2 }).notNull().default('1'),
		unitPriceKurus: integer('unit_price_kurus').notNull(),
		vatRate: integer('vat_rate').notNull().default(20),
		lineSubtotalKurus: integer('line_subtotal_kurus').notNull().default(0),
		lineVatKurus: integer('line_vat_kurus').notNull().default(0),
		lineTotalKurus: integer('line_total_kurus').notNull().default(0),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(table) => [
		index('quote_items_quote_idx').on(table.quoteId),
		check('quote_items_unit_price_nonneg', sql`${table.unitPriceKurus} >= 0`),
		check('quote_items_vat_rate_valid', sql`${table.vatRate} >= 0 AND ${table.vatRate} <= 100`)
	]
);

export const workLogs = pgTable(
	'work_logs',
	{
		id: serial('id').primaryKey(),
		workItemId: integer('work_item_id')
			.notNull()
			.references(() => workItems.id, { onDelete: 'cascade' }),
		actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
		type: workLogTypeEnum('type').notNull(),
		message: text('message').notNull(),
		isPublic: boolean('is_public').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [index('work_logs_work_item_idx').on(table.workItemId)]
);

export const payments = pgTable(
	'payments',
	{
		id: serial('id').primaryKey(),
		workItemId: integer('work_item_id')
			.notNull()
			.references(() => workItems.id, { onDelete: 'cascade' }),
		amountKurus: integer('amount_kurus').notNull(),
		method: paymentMethodEnum('method').notNull(),
		invoiceRef: text('invoice_ref'),
		note: text('note'),
		paidAt: timestamp('paid_at', { withTimezone: true }).defaultNow().notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		index('payments_work_item_idx').on(table.workItemId),
		check('payments_amount_positive', sql`${table.amountKurus} > 0`)
	]
);

export type UserRow = typeof users.$inferSelect;
export type CustomerRow = typeof customers.$inferSelect;
export type WorkItemRow = typeof workItems.$inferSelect;
export type QuoteRow = typeof quotes.$inferSelect;
export type QuoteItemRow = typeof quoteItems.$inferSelect;
export type WorkLogRow = typeof workLogs.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
