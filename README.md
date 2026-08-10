# HK Split

A small shared expense-settlement app for trips and hangouts. HK Split supports:

- Bhagya, Buddhi, Dulan, Kasuni, Shirantha, Udula, and Umali
- any subset of friends in a case
- multiple contribution records per person
- an amount, note, and per-record exclusions
- simplified net payment lines
- marking individual payments as paid
- closing fully paid cases and deleting closed cases
- a shared, editable bank-details directory
- live shared data via Supabase

## One-time database setup

The app is already configured with the project's public Supabase URL and publishable key. To create its two tables:

1. Open the Supabase project dashboard.
2. Choose **SQL Editor** and **New query**.
3. Copy all of [`supabase-setup.sql`](supabase-setup.sql), paste it into the editor, and click **Run**.
4. Refresh the deployed app. Its status should change to **Live & synced**.

The policies intentionally allow anyone who has the app and public key to view or edit HK Split data. This matches the no-login requirement, but bank details should therefore be considered shared-link information, not private storage.

## Deployment

The included GitHub Actions workflow tests the settlement calculations and deploys the `main` branch to GitHub Pages. After the first successful workflow run, the app should be available at:

**https://dulanmahamithawa.github.io/HK-Split/**

If GitHub requests approval on the first run, open **Settings → Pages**, choose **GitHub Actions** as the source, then rerun the workflow.

## Local development

No build step or package installation is required. Serve the repository with any static web server, for example:

```bash
python3 -m http.server 8080
```

Run the calculation tests with:

```bash
node tests/settlement.test.js
```

## Data model

- `hk_friends`: one editable bank-details record per friend
- `hk_cases`: case metadata, participants, contribution records, generated settlements, and status

Amounts are converted to integer cents before calculation. Each expense is divided only among the case participants not excluded from that record. All resulting balances are netted and matched into simplified debtor-to-creditor payment lines.
