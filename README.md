# Nextia — plateforme de gestion (lot 1)

Back-office pour l'équipe et portail pour les clients, dans une seule application Next.js.
Les agents IA arriveront au lot 2 et se brancheront sur ce socle.

## Ce que fait le lot 1

| Module | Équipe (back-office `/admin`) | Client (portail `/portal`) |
| --- | --- | --- |
| Clients | Fiches entreprises, statut, responsable de compte, notes internes, accès portail | Profil de son entreprise |
| Abonnements | Offres, démarrage (avec ou sans essai), changement d'offre, impayé, résiliation, facturation de période | Voir son offre, souscrire en ligne (Stripe, optionnel) |
| Factures | Numérotation `F-AAAA-0001`, factures ponctuelles, TVA, payée/annulée, vue imprimable PDF | Liste et téléchargement de ses factures |
| Support | File de tickets, assignation, priorité, notes internes invisibles du client | Créer une demande, répondre, clore |
| Équipe | Comptes employés, rôles, réinitialisation de mot de passe | — |
| Traçabilité | Journal de toutes les actions | — |

### Rôles

| Rôle | Accès |
| --- | --- |
| Gérant (`ADMIN`) | Tout |
| Commercial (`SALES`) | Clients, abonnements, factures, lecture des tickets |
| Support (`SUPPORT`) | Tickets, lecture des clients |
| Client (`CLIENT`) | Portail de sa seule entreprise |

Les droits sont définis dans `src/lib/permissions.ts` et vérifiés côté serveur dans chaque page et chaque action.

## Stack

Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · PostgreSQL 16 · Drizzle ORM · sessions JWT (jose) en cookie httpOnly · bcrypt · Zod · Stripe (optionnel).

## Démarrer en local

Prérequis : Node 22, PostgreSQL 16 (ou `docker run -p 5432:5432 -e POSTGRES_PASSWORD=app postgres:16`).

```bash
npm install
cp .env.example .env            # puis ajuster DATABASE_URL et AUTH_SECRET
npm run db:migrate              # crée les tables
npm run db:seed                 # données de démo (efface les données existantes)
npm run dev                     # http://localhost:3000
```

Comptes de démonstration créés par le seed :

| Email | Mot de passe | Rôle |
| --- | --- | --- |
| admin@nextia.local | Admin123! | Gérant |
| commercial@nextia.local | Sales123! | Commercial |
| support@nextia.local | Support123! | Support |
| client@garage-durand.fr | Client123! | Client |

## Déployer sur un serveur (Docker)

Prérequis : un serveur Linux avec Docker et Docker Compose, un nom de domaine dont l'enregistrement DNS pointe vers l'IP du serveur, ports 80 et 443 ouverts.

```bash
git clone https://github.com/kobra-kob/nextia.git && cd nextia
cp .env.production.example .env.production
# Remplir DOMAIN, POSTGRES_PASSWORD, AUTH_SECRET :
#   openssl rand -base64 24   → POSTGRES_PASSWORD
#   openssl rand -base64 48   → AUTH_SECRET
docker compose --env-file .env.production up -d --build

# Créer le premier compte gérant (affiche un mot de passe temporaire)
docker compose --env-file .env.production run --rm migrate \
  npx tsx src/db/create-admin.ts vous@domaine.fr "Prénom Nom"
```

L'application est alors en ligne sur `https://DOMAIN` (certificat Let's Encrypt automatique via Caddy).

Services lancés : `db` (Postgres, volume persistant), `migrate` (applique les migrations puis s'arrête), `app` (Next.js), `caddy` (HTTPS).

| Besoin | Commande |
| --- | --- |
| Mettre à jour | `git pull && docker compose --env-file .env.production up -d --build` |
| Logs | `docker compose logs -f app` |
| Sauvegarde | `docker compose exec db pg_dump -U nextia nextia > backup-$(date +%F).sql` |
| Restauration | `cat backup.sql \| docker compose exec -T db psql -U nextia nextia` |
| Données de démo | `docker compose --env-file .env.production run --rm migrate npx tsx src/db/seed.ts` (efface tout) |

## Paiement en ligne Stripe (optionnel)

Sans clé Stripe, la facturation est manuelle : l'équipe émet les factures et les marque payées.
Pour activer la souscription en ligne depuis le portail :

1. Créer un produit et un prix récurrent dans Stripe, copier l'ID `price_…` dans l'offre (back-office → Offres).
2. Renseigner `STRIPE_SECRET_KEY`.
3. Créer un webhook vers `https://DOMAIN/api/stripe/webhook` avec les événements `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, et renseigner `STRIPE_WEBHOOK_SECRET`.
4. Activer le portail client dans Stripe (Settings → Billing → Customer portal).

En local : `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## Structure

```
src/
  app/
    admin/          back-office (clients, factures, tickets, offres, équipe, journal)
    portal/         espace client
    login/          connexion
    api/stripe/     webhook Stripe
    *-actions.ts    actions serveur partagées (tickets, compte)
  components/       UI partagée (shell, formulaires, facture, fil de ticket)
  db/               schéma Drizzle, seed, création du gérant
  lib/              auth (DAL), session, permissions, formatage, audit, Stripe
  proxy.ts          redirection rapide des visiteurs non connectés
drizzle/            migrations SQL générées
```

Modifier le schéma : éditer `src/db/schema.ts`, puis `npm run db:generate` (crée la migration) et `npm run db:migrate`.

## Prochaines étapes (lot 2 et suivants)

- Agents IA : table `agents` rattachée à l'abonnement, table `agent_events` (bus d'événements entre agents), journal d'actions par agent.
- Facturation récurrente automatique (tâche planifiée) si Stripe n'est pas utilisé.
- Emails transactionnels (nouveau ticket, réponse, facture émise).
- Mot de passe oublié par email.
