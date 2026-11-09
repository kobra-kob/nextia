import type { ZodError } from "zod";

export type ActionState = {
  ok?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export function fromZod(error: ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: "Merci de corriger les champs indiqués.", fieldErrors };
}

/** Convertit un FormData en objet simple (les champs vides deviennent undefined). */
export function formObject(formData: FormData) {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") out[k] = v.trim() === "" ? undefined : v.trim();
  }
  return out;
}
