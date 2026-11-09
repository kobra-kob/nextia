import "server-only";
import Stripe from "stripe";

let client: Stripe | null | undefined;

/** Client Stripe, ou null si STRIPE_SECRET_KEY n'est pas configurée (mode facturation manuelle). */
export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  client = key ? new Stripe(key) : null;
  return client;
}

export const stripeEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);
export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
