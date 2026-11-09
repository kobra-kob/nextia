import { date, INVOICE_STATUS, money, ttc } from "@/lib/format";
import { StatusBadge } from "./ui";
import { PrintButton } from "./print-button";

type Invoice = {
  number: string;
  label: string;
  amountCents: number;
  vatRate: number;
  status: "DRAFT" | "OPEN" | "PAID" | "VOID";
  issuedAt: Date;
  dueAt: Date;
  paidAt: Date | null;
  company: { name: string; address: string | null; siret: string | null; email: string };
};

/** Facture imprimable (Ctrl+P → PDF). Les mentions vendeur viennent des variables d'environnement. */
export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const vat = ttc(invoice.amountCents, invoice.vatRate) - invoice.amountCents;
  const seller = {
    name: process.env.COMPANY_NAME ?? "Nextia",
    address: process.env.COMPANY_ADDRESS ?? "Adresse à compléter (COMPANY_ADDRESS)",
    siret: process.env.COMPANY_SIRET ?? "SIRET à compléter (COMPANY_SIRET)",
    vat: process.env.COMPANY_VAT ?? "",
  };

  return (
    <div>
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <article className="card mx-auto max-w-3xl p-10 print:border-0 print:p-0">
        <header className="flex justify-between gap-6">
          <div>
            <p className="text-xl font-semibold">{seller.name}</p>
            <p className="mt-1 text-sm whitespace-pre-line text-slate-600">{seller.address}</p>
            <p className="text-sm text-slate-600">SIRET : {seller.siret}</p>
            {seller.vat && <p className="text-sm text-slate-600">TVA : {seller.vat}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold">Facture</p>
            <p className="font-mono text-sm">{invoice.number}</p>
            <div className="mt-2"><StatusBadge map={INVOICE_STATUS} value={invoice.status} /></div>
          </div>
        </header>

        <section className="mt-10 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Facturé à</p>
            <p className="mt-1 font-medium">{invoice.company.name}</p>
            {invoice.company.address && <p className="text-slate-600">{invoice.company.address}</p>}
            {invoice.company.siret && <p className="text-slate-600">SIRET : {invoice.company.siret}</p>}
            <p className="text-slate-600">{invoice.company.email}</p>
          </div>
          <div className="text-right">
            <p><span className="text-slate-500">Date d&apos;émission :</span> {date(invoice.issuedAt)}</p>
            <p><span className="text-slate-500">Échéance :</span> {date(invoice.dueAt)}</p>
            {invoice.paidAt && <p><span className="text-slate-500">Payée le :</span> {date(invoice.paidAt)}</p>}
          </div>
        </section>

        <table className="mt-10 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-slate-500">
              <th className="py-2 font-medium">Désignation</th>
              <th className="py-2 text-right font-medium">Montant HT</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-3">{invoice.label}</td>
              <td className="py-3 text-right tabular-nums">{money(invoice.amountCents)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-6 ml-auto w-64 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Total HT</span><span className="tabular-nums">{money(invoice.amountCents)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">TVA {invoice.vatRate} %</span><span className="tabular-nums">{money(vat)}</span></div>
          <div className="flex justify-between border-t border-slate-300 pt-2 text-base font-semibold"><span>Total TTC</span><span className="tabular-nums">{money(invoice.amountCents + vat)}</span></div>
        </div>

        <footer className="mt-12 border-t border-slate-200 pt-4 text-xs text-slate-500">
          En cas de retard de paiement, une pénalité égale à trois fois le taux d&apos;intérêt légal sera exigible, ainsi qu&apos;une
          indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce).
        </footer>
      </article>
    </div>
  );
}
