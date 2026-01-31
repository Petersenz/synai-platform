# CI/CD Fix Plan: Next.js 16 + Tailwind v4 stability

## Problem

- Frontend build fails in CI (Linux) but works locally (Windows).
- Error: `Cannot find module '../lightningcss.linux-x64-gnu.node'` (Missing native binary).
- Side Effect: Path aliases (`@/*`) fail because Turbopack crashes during CSS evaluation.

## Solution Steps

### 1. Package Management Fix

- [ ] Move `@lightningcss/linux-x64-gnu` to main `dependencies`.
- [ ] Ensure `trustedDependencies` includes `lightningcss`.

### 2. CI/CD Workflow Optimization

- [ ] Use `npm install` with platform-specific flags if needed.
- [ ] Ensure `NODE_ENV=production` is set clearly during build.

### 3. Path Resolution Verification

- [ ] Double-check `src/lib/api.ts` vs `src/lib/API.ts` (Case sensitivity).
- [ ] Standardize `tsconfig.json` to be predictable for Turbopack.

## Expected Result

- Successful CSS compilation on Ubuntu runners.
- Correct module resolution by Turbopack after the CSS engine is stabilized.
