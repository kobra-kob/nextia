import type {
  CompanyStatus,
  InvoiceStatus,
  Role,
  SubscriptionStatus,
  TicketPriority,
  TicketStatus,
} from "@/db/schema";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
export const money = (cents: number) => eur.format(cents / 100);
export const ttc = (cents: number, vatRate: number) => Math.round(cents * (1 + vatRate / 100));

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
export const date = (d: Date | null | undefined) => (d ? dateFmt.format(d) : "—");
export const dateTime = (d: Date | null | undefined) => (d ? dateTimeFmt.format(d) : "—");
export const toInputDate = (d: Date) => d.toISOString().slice(0, 10);

type Tone = "gray" | "green" | "amber" | "red" | "blue" | "violet";
type Label = { label: string; tone: Tone };

export const ROLE_LABELS: Record<Role, Label> = {
  ADMIN: { label: "Gérant", tone: "violet" },
  SALES: { label: "Commercial", tone: "blue" },
  SUPPORT: { label: "Support", tone: "green" },
  CLIENT: { label: "Client", tone: "gray" },
};

export const COMPANY_STATUS: Record<CompanyStatus, Label> = {
  ONBOARDING: { label: "Mise en place", tone: "blue" },
  ACTIVE: { label: "Actif", tone: "green" },
  SUSPENDED: { label: "Suspendu", tone: "amber" },
  CHURNED: { label: "Parti", tone: "gray" },
};

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, Label> = {
  TRIALING: { label: "Essai", tone: "blue" },
  ACTIVE: { label: "Actif", tone: "green" },
  PAST_DUE: { label: "Impayé", tone: "red" },
  CANCELED: { label: "Résilié", tone: "gray" },
};

export const INVOICE_STATUS: Record<InvoiceStatus, Label> = {
  DRAFT: { label: "Brouillon", tone: "gray" },
  OPEN: { label: "À payer", tone: "amber" },
  PAID: { label: "Payée", tone: "green" },
  VOID: { label: "Annulée", tone: "gray" },
};

export const TICKET_STATUS: Record<TicketStatus, Label> = {
  OPEN: { label: "Nouveau", tone: "blue" },
  IN_PROGRESS: { label: "En cours", tone: "violet" },
  WAITING_CLIENT: { label: "Attente client", tone: "amber" },
  RESOLVED: { label: "Résolu", tone: "green" },
  CLOSED: { label: "Fermé", tone: "gray" },
};

export const TICKET_PRIORITY: Record<TicketPriority, Label> = {
  LOW: { label: "Basse", tone: "gray" },
  NORMAL: { label: "Normale", tone: "blue" },
  HIGH: { label: "Haute", tone: "amber" },
  URGENT: { label: "Urgente", tone: "red" },
};

export const isOverdue = (status: InvoiceStatus, dueAt: Date) => status === "OPEN" && dueAt < new Date();
