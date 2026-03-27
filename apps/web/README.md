# `apps/web`

This app is the file-first Paperflow workspace UI.

Primary routes:
- `/`
- `/new`
- `/editor`
- `/questions/[id]`
- `/export`

Primary APIs:
- `GET /api/workspace`
- `POST /api/workspace/init`
- `GET/POST /api/items`
- `POST /api/preview`
- `POST /api/export`
- `POST /api/lint`
- `POST /api/imports`

Run locally:

```bash
pnpm install
cd apps/web
cp .env.example .env.local
pnpm dev
```

Recommended first run:
1. Open `/new`.
2. Create a local project directory.
3. Jump to `/editor`.
4. Edit `paper.qmd` and `questions/*.md` through the UI.
5. Validate with `/export`.

This app no longer depends on the old Studio/demo import/auth flow as the main path.
