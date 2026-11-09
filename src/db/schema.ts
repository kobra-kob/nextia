import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()::text`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------- Enums ----------

export const roleEnum = pgEnum("role", ["ADMIN", "SALES", "SUPPORT", "CLIENT"]);
export const companyStatusEnum = pgEnum("company_status", [
  "ONBOARDING",
  "ACTIVE",
  "SUSPENDED",
  "CHURNED",
]);
export const billingIntervalEnum = pgEnum("billing_interval", ["MONTH", "YEAR"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["DRAFT", "OPEN", "PAID", "VOID"]);
export const ticketStatusEnum = pgEnum("ticket_status", [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_CLIENT",
  "RESOLVED",
  "CLOSED",
]);
export const ticketPriorityEnum = pgEnum("ticket_priority", ["LOW", "NORMAL", "HIGH", "URGENT"]);

export type Role = (typeof roleEnum.enumValues)[number];
export type CompanyStatus = (typeof companyStatusEnum.enumValues)[number];
export type SubscriptionStatus = (typeof subscriptionStatusEnum.enumValues)[number];
export type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number];
export type TicketStatus = (typeof ticketStatusEnum.enumValues)[number];
export type TicketPriority = (typeof ticketPriorityEnum.enumValues)[number];

// ---------- Tables ----------

/** Entreprises clientes. */
export const companies = pgTable("companies", {
  id: id(),
  name: text("name").notNull(),
  siret: text("siret"),
  email: text("email").notNull(),
  phone: text("phone"),
  address: text("address"),
  sector: text("sector"),
  status: companyStatusEnum("status").notNull().default("ONBOARDING"),
  notes: text("notes"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  accountManagerId: text("account_manager_id").references((): AnyPgColumn => users.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Équipe interne (ADMIN, SALES, SUPPORT) et utilisateurs des clients (CLIENT). */
export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    active: boolean("active").notNull().default(true),
    companyId: text("company_id").references(() => companies.id, { onDelete: "cascade" }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(sql`lower(${t.email})`), index("users_company_idx").on(t.companyId)],
);

/** Offres commerciales (catalogue). */
export const plans = pgTable("plans", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(), // HT
  interval: billingIntervalEnum("interval").notNull().default("MONTH"),
  features: text("features").array().notNull().default(sql`ARRAY[]::text[]`),
  stripePriceId: text("stripe_price_id"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id),
    status: subscriptionStatusEnum("status").notNull().default("ACTIVE"),
    startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("subscriptions_company_idx").on(t.companyId)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    number: text("number").notNull().unique(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    amountCents: integer("amount_cents").notNull(), // HT
    vatRate: integer("vat_rate").notNull().default(20), // %
    status: invoiceStatusEnum("status").notNull().default("OPEN"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    stripeInvoiceId: text("stripe_invoice_id").unique(),
    createdAt: createdAt(),
  },
  (t) => [index("invoices_company_idx").on(t.companyId)],
);

export const tickets = pgTable(
  "tickets",
  {
    id: id(),
    number: serial("number").notNull().unique(),
    subject: text("subject").notNull(),
    status: ticketStatusEnum("status").notNull().default("OPEN"),
    priority: ticketPriorityEnum("priority").notNull().default("NORMAL"),
    category: text("category"),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("tickets_company_idx").on(t.companyId), index("tickets_status_idx").on(t.status)],
);

export const ticketMessages = pgTable(
  "ticket_messages",
  {
    id: id(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    internal: boolean("internal").notNull().default(false), // note interne, jamais visible du client
    createdAt: createdAt(),
  },
  (t) => [index("ticket_messages_ticket_idx").on(t.ticketId)],
);

/** Journal des actions : qui a fait quoi, sur quoi. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    details: text("details"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId)],
);

// ---------- Relations ----------

export const companiesRelations = relations(companies, ({ one, many }) => ({
  accountManager: one(users, { fields: [companies.accountManagerId], references: [users.id] }),
  users: many(users, { relationName: "companyUsers" }),
  subscriptions: many(subscriptions),
  invoices: many(invoices),
  tickets: many(tickets),
}));

export const usersRelations = relations(users, ({ one }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
    relationName: "companyUsers",
  }),
}));

export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  company: one(companies, { fields: [subscriptions.companyId], references: [companies.id] }),
  plan: one(plans, { fields: [subscriptions.planId], references: [plans.id] }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  company: one(companies, { fields: [invoices.companyId], references: [companies.id] }),
  subscription: one(subscriptions, {
    fields: [invoices.subscriptionId],
    references: [subscriptions.id],
  }),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  company: one(companies, { fields: [tickets.companyId], references: [companies.id] }),
  createdBy: one(users, { fields: [tickets.createdById], references: [users.id], relationName: "creator" }),
  assignee: one(users, { fields: [tickets.assigneeId], references: [users.id], relationName: "assignee" }),
  messages: many(ticketMessages),
}));

export const ticketMessagesRelations = relations(ticketMessages, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketMessages.ticketId], references: [tickets.id] }),
  author: one(users, { fields: [ticketMessages.authorId], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, { fields: [auditLogs.actorId], references: [users.id] }),
}));
