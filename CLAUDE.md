# Nextia — notes pour Claude

@AGENTS.md

Plateforme SaaS (lot 1) : back-office `/admin` pour l'équipe, portail `/portal` pour les clients. Langue de l'interface et des messages : français.

## Commandes

- `npm run dev` — serveur de dev (Postgres local requis, voir `.env.example`)
- `npm run typecheck` / `npm run lint` / `npm run build` — à faire passer avant chaque commit
- `npm run db:generate` puis `npm run db:migrate` — après toute modification de `src/db/schema.ts`
- `npm run db:seed` — remet les données de démo (efface tout)

## Conventions

- ORM : Drizzle (`src/db/schema.ts`). Pas de Prisma.
- Rendu dynamique classique (Cache Components désactivé). Next 16 : `params`/`searchParams` sont des Promises, `proxy.ts` remplace `middleware.ts`.
- Sécurité : toute page appelle `requireStaff(permission)` ou `requireClient()` ; toute action serveur appelle `assertPermission(...)` ou relit l'utilisateur via `getCurrentUser()`. Côté client, toujours filtrer les requêtes par `user.companyId`, jamais par un id venant du formulaire.
- Droits : uniquement dans `src/lib/permissions.ts`.
- Formulaires avec retour d'erreur : composant client + `ActionForm` (`src/components/form.tsx`) + action `(state, formData) => ActionState`, validation Zod.
- Montants en centimes HT (`amountCents`, `priceCents`), TVA en % entier. Affichage via `money()` / `ttc()` de `src/lib/format.ts`.
- Chaque action métier écrit une ligne dans `audit_logs` via `audit()`.
- Notes internes de tickets (`internal = true`) : ne jamais les charger côté portail.
