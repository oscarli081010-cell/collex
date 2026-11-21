# Backups

A GitHub workflow (`.github/workflows/backup.yml`) dumps the database every night and keeps the result for 30 days.
It does nothing, and shows green, until you add the two secrets below.

What is backed up: the `public` schema (listings, applications, committees, profiles and the rest), `auth` (the sign-in
records) and `storage` (the list of uploaded files, not the files). What is not: uploaded photos and guides themselves,
edge function code (it is in this repository) and the Resend and Supabase settings.

The dump is encrypted before it is uploaded. This repository is public and anyone with a GitHub account can download a
public repository's workflow artifacts, so a plain dump would publish every delegate's name and email.

## Set it up (once, about five minutes)

1. Supabase: open the project, then **Project Settings > Database > Connection string** (the **Connect** button at the
   top of the dashboard shows the same strings), and choose the **Session pooler** string (the URI form). It looks like
   `postgresql://postgres.PROJECTREF:[YOUR-PASSWORD]@aws-0-REGION.pooler.supabase.com:5432/postgres`.
   Replace `[YOUR-PASSWORD]` with the database password (Project Settings > Database > Reset database password if you
   don't have it). Use the session pooler, not the "direct" string: GitHub's runners can't reach the direct address
   (it needs IPv6), and not the transaction pooler (port 6543), which `pg_dump` can't use.
2. GitHub: the repository's **Settings > Secrets and variables > Actions > New repository secret**.
   - Name `SUPABASE_DB_URL`, value: the string from step 1 with the password filled in.
   - Name `BACKUP_PASSPHRASE`, value: a long random passphrase. Keep a copy in your password manager; without it
     the backups can't be opened.
3. **Actions > Backup > Run workflow** to try it now. A green run with an artifact named `collex-db-YYYY-MM-DD`
   means it works.

Download a backup: Actions > the run > Artifacts at the bottom. GitHub deletes it after 30 days.

## Restore

Practise this once on a spare Supabase project before you ever need it. You need the Postgres 17 client tools
(`brew install postgresql@17`) and `gpg`.

```bash
# 1. Open the download
unzip collex-db-2027-03-05.zip                      # the artifact arrives zipped
gpg --output collex.dump --decrypt collex-2027-03-05.dump.gpg   # asks for BACKUP_PASSPHRASE

# 2. Look inside first
pg_restore --list collex.dump | head

# 3. Restore into an EMPTY Supabase project (never over the live one without a reason).
#    Use that project's session pooler string.
pg_restore --no-owner --no-privileges --dbname "postgresql://postgres.NEWREF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres" collex.dump
```

Expect some messages about things that already exist (the new project already has its own `auth` and `storage`
schemas) or that need Supabase's own roles. They are normal. What matters is afterwards:

- Count rows in a few tables (`select count(*) from public.conferences;`) and compare with the live site.
- Extensions, cron jobs and edge functions are not in the dump. On a new project, apply the migrations in
  `supabase/migrations` to a fresh project first if the restore complains about missing functions, deploy the
  three edge functions, set `RESEND_API_KEY`, then point `NEXT_PUBLIC_SUPABASE_URL` and the key in Vercel at the new
  project and redeploy. The cron jobs in migrations 0026 and 0035 contain the old project's address; update it.
- Uploaded photos live in Supabase Storage and are not restored by this; re-upload or accept the loss.

If only a few rows were deleted, restore the dump into a spare project and copy those rows across with SQL rather than
replacing anything live.
