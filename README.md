"# Rmi-Gideon"

## CI / Frontend build (dist handling)

The project keeps the frontend build output (`frontend/dist`) out of source control. We produce the distribution files during CI runs and attach them as a release artifact — this keeps the repository clean and avoids tracking generated files.

How it works:

- A GitHub Actions workflow builds the frontend on push, PR, or manually.
- The workflow saves `frontend/dist` as the `frontend-dist` artifact which can be downloaded from the Actions run details.

Retrieve artifacts:

- From the GitHub web UI: open the workflow run and click the `frontend-dist` artifact to download the generated `dist` bundle.
- From the command line (GitHub CLI installed):

```powershell
# list runs and artifacts, find the run id and artifact
gh run list --workflow frontend-build.yml
gh run download <run-id> --name frontend-dist --dir ./downloaded-dist
```

Local build (if you need a local `dist`):

```powershell
cd frontend
npm ci
npm run build
# dist will be created in frontend/dist
```

If you'd like CI to automatically deploy `frontend/dist` (to pages, S3, or another target), we can add an additional step to the workflow to publish artifacts to your hosting provider.

### Deploying to Cloudflare Pages from CI

The workflow can optionally deploy the built `frontend/dist` to Cloudflare Pages. To enable automatic deploys, add the following repository secrets (Repository Settings → Secrets → Actions):

- `CF_PAGES_API_TOKEN` — An API token or Pages deployment token with permissions to deploy to Pages.
- `CF_ACCOUNT_ID` — Your Cloudflare account ID.
- `CF_PAGES_PROJECT_NAME` — The Pages project name (the Pages project slug).

Once those secrets are present, the CI run will deploy `frontend/dist` automatically to the specified Pages project.

## Checking payroll calculations (backend)

We added a helper and a script to validate payroll calculations and inspect payrolls in a given date range.

- Helper: `backend/lib/payrollCalc.js` (exports computeTotalSalary and computeWeeklyShort)
- Check script: `backend/scripts/check-payroll-range.js`

Usage (from repo root):

```powershell
cd backend
node scripts/check-payroll-range.js 2025-11-01 2025-11-28
```

The script connects to MongoDB using `process.env.MONGO_URI` or `process.env.MONGODB_URI` — if those are not set, it will attempt the configured development cluster (check `scripts/check-payroll-range.js` to change the fallback). The script prints payrolls that have mismatched computed totals so you can inspect and backfill them.

## Desktop app with Electron (for thermal printer support)

Wrap your existing web app inside an Electron shell so you can print directly to thermal printers without browser dialogs.

1. Install dependencies once:

```powershell
npm install
```

2. Launch the desktop app (rebuilds frontend and starts Electron):

```powershell
npm run electron
```

   The desktop shell loads the built `frontend/dist` bundle (or falls back to your hosted web app URL if dist is missing).

3. Use the `Print` button in the teller report page. When running inside Electron, the app uses native `webContents.print()` for silent thermal printing. From a browser, it opens the native print dialog.

### Packaging as a Windows installer

To distribute the desktop app without npm scripts, package it into an `.exe` installer:

1. Run the packager from an **elevated PowerShell/Terminal** (right-click "Run as administrator"):

```powershell
npm run dist
```

   This rebuilds the frontend, bundles the Electron shell, and produces a Windows installer in the `release/` directory (e.g., `release/RMI Teller Report Setup 1.0.0.exe`).

2. Double-click the installer to install/run the desktop app. No npm scripts needed.

**Note:** If `npm run dist` fails with symbolic link errors, run it from an elevated terminal or enable Windows Developer Mode so the build tool can create symlinks without restrictions.
