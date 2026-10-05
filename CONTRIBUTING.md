# Contributing to CloakShare

Welcome to CloakShare! We appreciate your interest in contributing to the project. Whether it's a bug fix, new feature, or documentation improvement, every contribution makes a difference.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- Docker (for storage/rendering)

### Clone and install

```bash
git clone https://github.com/cloakshare/cloakshare.git
cd cloakshare
pnpm install
```

### Environment setup

```bash
cp .env.example .env
```

The repo-root `.env` is the single source of truth for local development. The API also loads
`apps/api/.env` afterwards (if present) as an optional override layer for machine-specific
values — see `apps/api/.env.example`.

### Start development

```bash
pnpm dev
```

This starts the API, the dashboard and the viewer. All of them are served from a single origin:
open **http://localhost:3000**. The API reverse-proxies `/dashboard` and `/v` to the Vite dev
servers, which run on the internal ports `DASHBOARD_DEV_PORT` (5174) and `VIEWER_DEV_PORT`
(5173) from your `.env`. You should not need to open those ports directly.

The marketing site (`apps/site`) is a separate deployment and runs on its own port
(`SITE_DEV_PORT`, default 4321).

### Run tests

```bash
pnpm test
```

## Project Structure

```
apps/api/              API server (Hono + TypeScript)
apps/site/             Marketing site (Astro)
apps/viewer/           Secure document viewer
apps/web/              Dashboard (React + Tailwind)
packages/shared/       Shared types and constants
packages/viewer-core/  Embeddable viewer Web Component
packages/react/        React wrapper for viewer
packages/sdk-node/     Node.js SDK
```

## Making Changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Write/update tests if applicable
4. Ensure the build passes: `pnpm build`
5. Open a pull request

## Good First Issues

Looking for a place to start? Check out issues labeled [`good first issue`](https://github.com/cloakshare/cloakshare/labels/good%20first%20issue).

## Code Style

- TypeScript throughout the codebase
- ESLint config in repo
- Prettier for formatting

## Reporting Bugs

Use the [bug report issue template](https://github.com/cloakshare/cloakshare/issues/new?template=bug_report.md). Please include steps to reproduce the issue.

## License

MIT — all contributions are under the same license.
