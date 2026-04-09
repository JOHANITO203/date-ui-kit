# OpenClaw + Freepik Setup (Repo Local)

## 1) OpenClaw commands in this repo

Use the local wrapper (it auto-picks Node >= 22.12 from nvm when needed):

```bash
npm run openclaw -- --version
npm run openclaw:doctor
npm run openclaw:config
```

If needed, you can force paths with env vars:

- `OPENCLAW_NODE_PATH`
- `OPENCLAW_MJS_PATH`
- `OPENCLAW_GLOBAL_ROOT`

## 2) Freepik image fetch for seed assets

Add credentials in your untracked `.env`:

```bash
FREEPIK_API_KEY=...
FREEPIK_ACCEPT_LANGUAGE=fr-FR
FREEPIK_IMAGE_SIZE=large
FREEPIK_SEARCH_LIMIT=20
```

Run fetch:

```bash
npm run seed:assets:freepik
```

Dry run:

```bash
npm run seed:assets:freepik -- --dry-run
```

Overwrite existing assets before download:

```bash
npm run seed:assets:freepik -- --overwrite
```

## 3) Use downloaded assets for Supabase seed

```bash
npm run seed:profiles
npm run seed:photos:retry
npm run seed:interactions
```

Assets target directory:

- `seed-assets/launch-servers/moscow`
- `seed-assets/launch-servers/saint-petersburg`
- `seed-assets/launch-servers/voronezh`
- `seed-assets/launch-servers/sochi`
