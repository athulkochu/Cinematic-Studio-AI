# Cinematic AI Studio

AI-powered video content creation app with a Continuity Engine that locks character look, world style, and narrative context across scenes, then auto-schedules publishing to YouTube and Instagram.

## Architecture

pnpm monorepo. TypeScript everywhere. Each package owns its own dependencies.

### Artifacts
- `artifacts/studio` — React + Vite frontend. Mounted at `/`. Uses wouter, Tailwind v4, shadcn/ui, framer-motion. Cinematic dark theme with a cyan accent.
- `artifacts/api-server` — Express + Drizzle ORM backend. Mounted at `/api`. Calls OpenAI via the Replit AI Integration proxy.
- `artifacts/mockup-sandbox` — Canvas component preview server (template).

### Shared libs
- `lib/api-spec` — OpenAPI 3.1 spec at `openapi.yaml`. Run `pnpm --filter @workspace/api-spec run codegen` after edits.
- `lib/api-zod` — Codegen output: zod schemas for request validation. Re-exports from `./generated/api` only (the duplicate `./generated/types` exports were removed to fix conflicts).
- `lib/api-client-react` — Codegen output: orval React Query hooks.
- `lib/db` — Drizzle schemas: `projects`, `characters`, `scenes` (jsonb characterIds), `schedules`. All cascade-delete to projects. Plus the OpenAI conversation/messages templates.
- `lib/integrations-openai-ai-server` — Replit OpenAI integration proxy client. Uses `gpt-5.4` for text and `gpt-image-1` for images. No API key required.

## Continuity Engine (`artifacts/api-server/src/lib/continuity-engine.ts`)
1. **Story breakdown**: `generateStoryPlan` — `gpt-5.4` with a strict JSON schema returns title, logline, locked global style/color grading, character sheets, and 3-6 scenes with `previousSummary` chaining.
2. **Character lock**: `generateCharacterReferenceImage` — `gpt-image-1` produces a per-character A-pose reference, stored as a base64 data URL in `characters.reference_image_url`.
3. **Style lock**: project-level `stylePrompt`, `colorGrading`, and `seed` are appended to every downstream image prompt.
4. **Scene-to-scene context**: `generateScenePreviewImage` re-injects the locked style, the per-character face/clothing descriptions, and the previous scene's summary into the storyboard prompt.

Image data flows through the API as `data:image/png;base64,...` URLs (no object storage required for storyboards).

## API Routes
- `GET/POST /api/projects` — list / create-with-plan (synchronous, ~20-40s for full plan + character refs)
- `GET/PATCH/DELETE /api/projects/:id`
- `POST /api/projects/:id/render` — queue all scenes
- `PATCH /api/characters/:id` and `POST /api/characters/:id/regenerate-reference`
- `PATCH /api/scenes/:id` and `POST /api/scenes/:id/regenerate`
- `GET/POST/DELETE /api/schedules`, `GET /api/schedules/upcoming`
- `GET /api/dashboard/summary`, `GET /api/dashboard/recent-activity`

## Frontend pages
- `/` Dashboard, `/projects/new` New project, `/projects/:id` Workspace (Storyboard + Cast tabs + Continuity Engine sidebar), `/schedule` Publish queue, `/settings` Engine explainer.

## Limitations / honest scope
- Video file rendering and YouTube/Instagram publishing are stubbed at the queue layer (status fields advance but no real upload). Real video render APIs (Runway, Pika, etc.) and publish APIs require paid third-party credentials.
- Character reference and scene preview images are real (Replit OpenAI integration). Story planning is real.
- Schedules are stored and listed; the publish worker is not wired to a real cron.

## Conventions
- Always run `pnpm install` after touching any `package.json`.
- After editing `openapi.yaml`, run codegen and restart the studio + api-server workflows.
- After editing `lib/db/src/schema/*`, run `pnpm --filter @workspace/db run push`.
- Server reads `PORT` and `DATABASE_URL` from env.
- Use the existing CSS-variable theme in `artifacts/studio/src/index.css`; don't hardcode colors.
