# SyncBridge Security & Vulnerability Audit Notes

## 1. Vulnerability Audit Results (Before & After Migration)

### Before Migration
- **Total Vulnerabilities**: 22 (16 High, 4 Moderate, 2 other)
- **Production Vulnerabilities (`npm audit --omit=dev`)**: **16 High-Severity Vulnerabilities**
  - High-severity advisories originated exclusively from `puppeteer` (v24.15.0) and `html-pdf-node` (v1.0.8) along with their transitive dependency chains:
    - `@puppeteer/browsers`
    - `extract-zip` (unvalidated symlink path traversal, arbitrary file writes)
    - `tar-fs` (arbitrary file overwrite via symlink)
    - `ws` (DoS via malformed frame)
    - `inline-css` -> `cheerio` / `htmlparser2`
    - `node-fetch` (denial of service, cookie exposure)

### After Migration
- **Production Vulnerabilities (`npm audit --omit=dev`)**: **0 Vulnerabilities**
  - `npm audit --omit=dev` reports: `found 0 vulnerabilities`.
  - All 16 production high-severity issues were resolved by removing `puppeteer`, `html-pdf-node`, and `@types/html-pdf-node` (115 packages total removed from the dependency tree).
- **Remaining Dev-Only Vulnerabilities (`npm audit`)**: 7 vulnerabilities (4 Moderate, 3 High)
  - **Dev Packages**:
    - `electron` (desktop app wrapper, dev/build tool)
    - `vite` / `esbuild` / `drizzle-kit` dev loaders
  - **Impact on Plesk Linux Production**: **None**. Plesk runs the production server using Node.js without `electron` or local dev servers. These dependencies are not loaded or executed in production.

---

## 2. Rationale for NOT Running `npm audit fix --force`

- Running `npm audit fix --force` was strictly avoided to safeguard application stability.
- `npm audit fix --force` would have performed uncontrolled major breaking version upgrades:
  - Upgrading `electron` from v33 to v44+ (breaking Electron APIs and desktop builds).
  - Upgrading `vite` to v8+ and overriding core build tools, causing bundling failures with React and Tailwind.
- By targeting the root cause—replacing headless browser PDF engines with pure Node `pdfmake` and removing unused packages—production vulnerabilities were reduced from 16 to 0 cleanly without any breaking changes.

---

## 3. PDF Architecture & Security Improvements

### Headless Browser Risks Eliminated
- **SSRF (Server-Side Request Forgery)**: Headless browsers (Chromium/Puppeteer) parse external HTML, load remote `<img>`, `<link>`, and `<iframe>` resources, and can be abused to probe internal network endpoints (e.g. `http://169.254.169.254` or `http://localhost:5432`).
- **Memory & Process Exhaustion**: Spawning Chromium child processes (`chrome.exe` / `chrome-linux`) consumes significant RAM (100–300MB per instance) and can cause Denial-of-Service or orphaned zombie processes under load.
- **Pure Node.js In-Memory Generation (`pdfmake`)**:
  - PDFs are synthesized directly into memory buffers using standard PostScript fonts (Times-Roman, Helvetica) without external network requests or browser sandboxes.
  - Strict security policies are enforced:
    - `pdfmake.setUrlAccessPolicy(() => false);` (prevents remote URL fetching)
    - `pdfmake.setLocalAccessPolicy(() => true);`

---

## 4. Observed Architectural Security Considerations for Future Hardening

During code review and audit, the following architectural considerations were identified for future hardening (no real credentials or secrets are documented below):

1. **Unauthenticated Superadmin Reset Route (`/reset-superadmin` or `/api/reset-superadmin`)**:
   - The application codebase contains a route designed to reset or bootstrap superadmin accounts.
   - *Recommendation*: Ensure this endpoint is strictly protected by IP whitelisting, an environment-driven setup key, or disabled entirely in production after initial system deployment.

2. **Database Seed and Fallback Credentials**:
   - Seed scripts and setup utilities reference default fallback credentials for initial administrative testing.
   - *Recommendation*: Ensure all default administrative passwords are changed immediately after production setup and that `NODE_ENV=production` enforces strict password policies.

3. **Session Store Architecture (`express-session`)**:
   - The application currently configures `MemoryStore` for session storage when PostgreSQL session persistence is not active. `MemoryStore` is not suitable for production deployments because sessions are lost on process restarts and can leak memory under heavy traffic.
   - *Recommendation*: The `connect-pg-simple` package is already installed in `package.json`. Configure `connect-pg-simple` backed by PostgreSQL for production session persistence across server restarts.

4. **Environment Secrets Management**:
   - Session secrets, database credentials, and email credentials should always be supplied via Plesk environment variables or a restricted `.env` file (permissions `600`) outside public web roots.
