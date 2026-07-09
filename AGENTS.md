# CLAUDE.md

This file provides guidance to AI agents when working with code in this repository.

## What this repo is

This is a **deployment configuration repo**, not an application codebase. It deploys a self-hosted [RAGFlow](https://github.com/infiniflow/ragflow) instance that provides semantic search over PBS (Pfadibewegung Schweiz) scouting documentation. RAGFlow itself is not developed here — it's pulled as a container image and configured via Helm.

The instance is explicitly scoped to indexing/search only — it does not host LLM pipelines or agents. External tools (e.g. pfadi.ai) are meant to consume it via MCP.

## Working with the repo

On git push, the application is automatically re-deployed. For this reason, leave all git commit and git push actions to the user - do not commit and push on your own.

If available and unless instructed otherwise, always use the /ponytail skill to change code in this repo

After finishing work, if there was some basic knowledge about the repo that you want to memorize for later sessions, ask the user whether you should update AGENTS.md with this info.

## Repo layout

- `README.md` contains a short description of the repo, setup documentation and a todo list with the next tasks to implement.
- `helm/` — Helm chart deploying RAGFlow and its dependencies (Postgres via external host, Elasticsearch, MinIO, Redis, an MCP server, a datasync worker, and per-source CronJobs under `helm/templates/datasources/`). Adapted from the [upstream RAGFlow helm chart](https://github.com/infiniflow/ragflow/tree/main/helm).
- `fluxcd/ragflow.yaml` — the `HelmRelease` FluxCD reconciles in production, pulling in real secrets via `valuesFrom` and overriding the chart defaults in `helm/values.yaml`. Deployment happens automatically on push to `main` via [tractor-k8s-shared](https://github.com/scout-ch/tractor-k8s-shared) — there is no manual deploy step for normal changes.
- `strapi/` — a TypeScript adapter, containerized and run as the `thilo` and `hering` datasource CronJobs (`helm/templates/datasources/strapi.yaml`); see "Working with the strapi adapter" below.
- `cudesch/` — a TypeScript adapter, containerized and run as the `cudesch` datasource CronJob (`helm/templates/datasources/cudesch.yaml`), syncing cudesch.scout.ch content into RAGFlow; see "Working with the cudesch adapter" below.
- `.github/workflows/build-images.yml` — builds and pushes the `cudesch` datasource image to GHCR on push to `main`/tags and nightly; add new entries to the `matrix.image` list when adding datasource containers.
- `.github/workflows/test.yml` — runs `npm test` for every adapter directory (`matrix.adapter`) plus `helm lint` on every push/PR; add new entries to `matrix.adapter` when adding a datasource adapter.
- `secrets.example.yml` / `secrets.yml` — Kubernetes `Secret` manifests consumed by the FluxCD `HelmRelease` via `valuesFrom`. `secrets.yml` and `.env` are gitignored and must be created locally (`cp secrets.example.yml secrets.yml`) before first install.
- `pbs-rag-comparison.ods` — the evaluation spreadsheet documenting why RAGFlow was chosen over alternatives (see README "Why RAGFlow?").

## Working with the strapi adapter

`strapi/` is the single adapter behind both the `thilo` and `hering` CronJobs (`helm/templates/datasources/strapi.yaml`, looped over `helm/values.yaml`'s `datasource.strapi` map). Key facts that aren't obvious from a first read:

- thilo uses legacy Strapi v3 (flat array response, `slug` field present); hering uses a newer flattened v4-style response (`{data: [...]}`, no `slug` — one is derived from `menuName` via `slugify()`). `parse.ts` normalizes both into the same `Section` shape; `API_VERSION` (env `STRAPI_API_VERSION`) picks which parser runs.
- One markdown file = one Strapi *section*; chapters become `##` headings within that file, not separate documents.
- Metadata is embedded as YAML frontmatter directly in the `.md` file (`buildFrontmatter` in `app.ts`) — there used to be sidecar `metadata_<id>.json` files, that pattern was removed, don't reintroduce it.
- Per-source, non-secret config (base URL, API version, source URL template, S3 bucket/prefix) lives in `helm/values.yaml` under `datasource.strapi.<name>`; secrets live in `helm/templates/datasources/strapi-secrets.yaml`.
- `app.ts`'s `removeStaleObjects` deletes S3 objects from a previous run that the current run no longer produces (diffed per-locale against each source's S3 prefix).
- No test framework — `strapi/frontmatter.check.ts` and `strapi/parse.check.ts` are plain `assert`-based self-checks (`npm test` in `strapi/` runs `tsc --noEmit` + both). Update these alongside any change to `buildFrontmatter`/`parse.ts` instead of adding a test runner. Runs in CI via `.github/workflows/test.yml`.

## Working with the cudesch adapter

`cudesch/` syncs the [BookStack](https://www.bookstackapp.com/) instance behind cudesch.scout.ch. Key facts that aren't obvious from a first read:

- cudesch.scout.ch is actually **three separate BookStack instances**, one per locale (`de`/`fr`/`it`), each requiring its own API token (`CUDESCH_API_TOKEN_DE`/`_FR`/`_IT`) — not one multilingual instance behind a locale switch.
- One markdown file = one BookStack *chapter* or one loose *page* (a page placed directly in a book, not inside any chapter) — unlike strapi, chapters are split into separate documents rather than becoming `##` headings in one file. `bookstack.ts`'s `flattenBook` does this split and filters out draft/template pages.
- Content comes from BookStack's own `.../export/markdown` endpoint per chapter/page, not reassembled from HTML.
- Unlike strapi, this is a single datasource, not a map of named sources — `datasource.cudesch` in `helm/values.yaml` is a flat config block, and `helm/templates/datasources/cudesch.yaml`/`cudesch-secrets.yaml` have no `range`.
- `app.ts`'s `removeStaleObjects` deletes S3 objects from a previous run that the current run no longer produces (diffed against the bucket's locale prefix).
- No test framework — `cudesch/bookstack.check.ts` is a plain `assert`-based self-check (`npm test` runs `tsc --noEmit` + it). Update it alongside any change to `bookstack.ts`. Runs in CI via `.github/workflows/test.yml`.

## Working with the Helm chart

- Chart values documentation and defaults live in `helm/values.yaml`; production overrides live in `fluxcd/ragflow.yaml` under `spec.values`. When adding a new configurable value, add the default to `helm/values.yaml` first.
- Secrets are never set as literal values in `helm/values.yaml` or `fluxcd/ragflow.yaml` — they're injected via `valuesFrom` referencing Kubernetes `Secret` resources (see `secrets.example.yml` for the full list of secrets FluxCD expects to already exist in the namespace).
- The `mcp` and `ragflow`/`datasync`/`taskexecutor` deployments all run from the *same* RAGFlow image but with different `entrypoint.sh` flags (`--disable-webserver`, `--enable-mcpserver`, etc. — see `helm/templates/mcp.yaml` and `helm/templates/datasync.yaml`). When changing container startup behavior, check whether the change needs to apply to all of these variants.
- New datasources are added as a CronJob under `helm/templates/datasources/`, using the `datasource.imageBase` value as the image prefix and a corresponding image built by `.github/workflows/build-images.yml`.
- `helm lint` runs in CI (`.github/workflows/test.yml`, `helm-lint` job) on every push/PR; validate chart changes locally the same way with `helm template ./helm -f <values-file>` or `helm lint ./helm` if Helm is available locally.
- Several templates use `required(...)` on secret/config values that are normally supplied via `valuesFrom` in `fluxcd/ragflow.yaml`, not present in `helm/values.yaml` — plain `helm template ./helm -f helm/values.yaml`/`helm lint ./helm -f helm/values.yaml` fails against these. `helm/ci-dummy-secrets.yaml` stubs all of them with dummy values; add `-f helm/ci-dummy-secrets.yaml` to render/lint locally (the CI job uses the same file — add any newly-`required(...)`-ed field there, not as inline `--set` flags, so it stays the one place to update).

## Secrets and env files

`.env` and `secrets.yml` in this working tree contain real, live credentials (Elasticsearch/Postgres/MinIO/Redis passwords, MiData OAuth client secret, RAGFlow API key) — both are gitignored. Never copy their contents into commits, code, or generated files.
