# Repository Guidelines

## Project Structure & Module Organization
The active codebase lives in `voiceflow-pro`, a Node.js workspace with `apps` and `packages`. `apps/web` is the Next.js 14 client (routes under `app/`, UI in `src/components`). `apps/api` contains the Fastify service with REST modules in `src/routes` and platform helpers in `src/lib`. `apps/desktop` wraps the same features in Electron and keeps diagnostic scripts under its root. Shared contracts and design primitives ship from `packages/shared`, `packages/ui`, and `packages/database` (Prisma schema plus migrations).

## Build, Test, and Development Commands
Install dependencies once with `npm install` from `voiceflow-pro`. `npm run dev` starts the web app on 3000 and the API on 3002 (run `source setup_env.sh` beforehand for JWT and Supabase secrets). Target a single workspace with `npm run dev --workspace=apps/web` or `npm run dev --workspace=apps/api`. Production bundles come from `npm run build`; database maintenance flows through `npm run db:generate`, `db:push`, and `db:seed`.

## Coding Style & Naming Conventions
TypeScript is standard; export helpers with explicit return types. Run `npm run lint` (ESLint + Prettier) before commits—formatting follows 2-space indent, single quotes, and trailing commas. Keep React components in `PascalCase` files, hooks as `useThing`, and share logic by re-exporting through `packages/shared/index.ts`. Group Tailwind classes by layout → visual → state to mirror existing patterns.

## Testing Guidelines
`apps/api` uses Vitest; run `npm run test --workspace=apps/api` for focused feedback or `npm test` to fan out across workspaces. Name specs `feature.test.ts` beside the subject under `apps/api/tests`. Mock Supabase and JWT flows with the provided factories, and keep coverage on auth, transcription batches, and storage flows. Electron harness scripts (`apps/desktop/test-*.js`) should be exercised manually before releasing desktop changes.

## Commit & Pull Request Guidelines
History shows descriptive subject lines with concise summaries. Keep the first line imperative and under ~72 characters, add context paragraphs when touching multiple workspaces, and reference Jira/Notion IDs where relevant. PRs should outline scope, call out affected apps/packages, attach screenshots or CLI output for UI or backend changes, and highlight schema or env updates for reviewers.

## Security & Configuration Tips
Bootstrap env vars by copying `.env.local.example` in `apps/web` and sourcing `setup_env.sh` before starting the API. Never commit real Supabase keys, JWT secrets, or unsanitized audio; use the samples already in `apps/api/tests`. Prefer the WASM models in `build-wasm/` for browser Whisper features to avoid bundling native binaries, and rotate temporary API keys after debugging.
