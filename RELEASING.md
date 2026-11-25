# Releasing hexamap-tiles

Releases are published by the **Publish to npm** GitHub Action (`.github/workflows/publish.yml`). It runs
only when you start it by hand, and it:

1. installs dependencies, typechecks and runs the tests,
2. optionally bumps the version (`patch`, `minor` or `major`),
3. stops if that version is already on npm,
4. builds the package and publishes it with provenance,
5. commits the version bump and pushes a `hexamap-tiles@vX.Y.Z` tag.

## One-time setup

1. **Push the repo to GitHub** with the workflow on the default branch (manual workflows only show up in
   the Actions tab once the file is on the default branch).
2. **Create an npm account** at <https://www.npmjs.com/signup> and turn on two-factor authentication.
3. **Publish the first version.** npm's trusted publishing can only be configured for a package that already
   exists, so the very first release is done one of these two ways:
   - **From your machine (simplest):** `npm login`, then
     `npm run build -w hexamap-tiles && npm publish -w hexamap-tiles --access public`.
     npm asks for your 2FA code.
   - **From the workflow with a token:** npmjs.com → your avatar → **Access Tokens** → **Generate New Token** →
     **Granular Access Token**, with *Read and write* on all packages, a short expiry, and **"Bypass
     two-factor authentication (2FA)" ticked**. Without that box, publishing fails with `EOTP` (CI can't
     enter a one-time code). Save it as the repository secret `NPM_TOKEN`, then run **Publish to npm** with
     *bump* = `none` (publishes 1.0.0 as-is).
4. **Switch to trusted publishing** (no long-lived tokens):
   - npmjs.com → package **hexamap-tiles** → **Settings** → **Trusted Publisher** → **GitHub Actions**.
   - Organization or user: `SoorajSNBlaze333`, repository: `hexamap-tiles`, workflow filename: `publish.yml`.
   - Delete the `NPM_TOKEN` secret from GitHub and revoke the token on npm. The workflow uses trusted
     publishing automatically when no token is set.

## Every release

1. Merge your changes to the default branch.
2. Actions tab → **Publish to npm** → **Run workflow**.
3. Pick a **bump**: `patch` for fixes, `minor` for new features, `major` for breaking changes.
   Tick **dry run** first if you want to see the package contents without publishing.
4. Check the run summary for the npm link.

If your default branch is protected so that bots can't push, either allow GitHub Actions to push to it, or
bump the version in a pull request yourself and run the workflow with *bump* = `none`.

## Publishing from your machine (fallback)

```bash
npm login
npm run build -w hexamap-tiles
npm publish -w hexamap-tiles --access public
```
