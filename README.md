# Speckit Tracker

A local web UI for [spec-kit](https://github.com/github/spec-kit) projects — render, navigate, and edit all your specs from a single place without touching raw markdown files.

[Spec-kit](https://github.com/github/spec-kit) generates a `specs/` directory with feature folders containing `spec.md`, `plan.md`, `tasks.md`, `data-model.md`, contracts, checklists, and more. Speckit Tracker reads that directory and gives you a polished interface to browse and edit everything.

## Features

- Sidebar with all features and live task completion progress
- Tabs for every artifact: spec, plan, tasks, data model, research, quickstart, checklists, contracts
- Inline markdown editing — saves write directly back to disk
- Dashboard with aggregate progress across all features
- Project history — recently opened projects remembered between sessions
- Dark/light theme, density, font, and accent color tweaks

## Setup

```bash
npm install
```

## Usage

```bash
# Start without a project — pick one in the browser
node server.js

# Or pre-load a project directly
node server.js /path/to/your/spec-kit-project
```

Open http://localhost:3000

The project root must contain a `specs/` directory with feature directories matching `<NNN>-<slug>/` — the standard spec-kit layout.

## Network access

By default the server listens on all interfaces (`0.0.0.0`). The startup log shows the LAN address:

```
Speckit Tracker running at http://localhost:3000
On network:            http://192.168.1.42:3000
```

To restrict to localhost only: `HOST=127.0.0.1 node server.js`

To change the port: `PORT=8080 node server.js`

## Lint

```bash
npm run lint
```

## License

MIT
