# `apps/web`

This is the Paperflow web workspace.

Main routes:
- `/` project landing page
- `/studio` paper composition workspace
- `/review` review center
- `/auth` lightweight auth and org entry

Run locally:

```bash
pnpm install
cd apps/web
cp .env.example .env.local
pnpm dev
```

The best first run is:
1. Open `/studio`
2. Click `导入示例数据`
3. Switch template preset and preview mode
4. Export PDF / QTI XML / JSON

For repo-level overview, use the root [`README.md`](../../README.md).
