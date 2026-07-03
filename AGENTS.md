# CLAUDE.md

This file provides guidance to AI agents when working with code in this repository.

## What this repo is

This is a **deployment configuration repo**, not an application codebase. It deploys a self-hosted [RAGFlow](https://github.com/infiniflow/ragflow) instance that provides semantic search over PBS (Pfadibewegung Schweiz) scouting documentation. RAGFlow itself is not developed here — it's pulled as a container image and configured via Helm.

The instance is explicitly scoped to indexing/search only — it does not host LLM pipelines or agents. External tools (e.g. pfadi.ai) are meant to consume it via MCP.

## Working with the repo

On git push, the application is automatically re-deployed. For this reason, leave all git commit and git push actions to the user - do not commit and push on your own.

## Repo layout

- `README.md` contains a short description of the repo, setup documentation and a todo list with the next tasks to implement.
- `helm/` — Helm chart deploying RAGFlow and its dependencies (Postgres via external host, Elasticsearch, MinIO, Redis, an MCP server, a datasync worker, and per-source CronJobs under `helm/templates/datasources/`). Adapted from the [upstream RAGFlow helm chart](https://github.com/infiniflow/ragflow/tree/main/helm).
- `fluxcd/ragflow.yaml` — the `HelmRelease` FluxCD reconciles in production, pulling in real secrets via `valuesFrom` and overriding the chart defaults in `helm/values.yaml`. Deployment happens automatically on push to `main` via [tractor-k8s-shared](https://github.com/scout-ch/tractor-k8s-shared) — there is no manual deploy step for normal changes.
- `cudesch/` — a small Node container (`app.js` + `Dockerfile`) that acts as one of the datasource CronJobs (`helm/templates/datasources/cudesch.yaml`), meant to sync cudesch.scout.ch content into RAGFlow.
- `.github/workflows/build-images.yml` — builds and pushes the `cudesch` datasource image to GHCR on push to `main`/tags and nightly; add new entries to the `matrix.image` list when adding datasource containers.
- `secrets.example.yml` / `secrets.yml` — Kubernetes `Secret` manifests consumed by the FluxCD `HelmRelease` via `valuesFrom`. `secrets.yml` and `.env` are gitignored and must be created locally (`cp secrets.example.yml secrets.yml`) before first install.
- `pbs-rag-comparison.ods` — the evaluation spreadsheet documenting why RAGFlow was chosen over alternatives (see README "Why RAGFlow?").

## Working with the Helm chart

- Chart values documentation and defaults live in `helm/values.yaml`; production overrides live in `fluxcd/ragflow.yaml` under `spec.values`. When adding a new configurable value, add the default to `helm/values.yaml` first.
- Secrets are never set as literal values in `helm/values.yaml` or `fluxcd/ragflow.yaml` — they're injected via `valuesFrom` referencing Kubernetes `Secret` resources (see `secrets.example.yml` for the full list of secrets FluxCD expects to already exist in the namespace).
- The `mcp` and `ragflow`/`datasync`/`taskexecutor` deployments all run from the *same* RAGFlow image but with different `entrypoint.sh` flags (`--disable-webserver`, `--enable-mcpserver`, etc. — see `helm/templates/mcp.yaml` and `helm/templates/datasync.yaml`). When changing container startup behavior, check whether the change needs to apply to all of these variants.
- New datasources are added as a CronJob under `helm/templates/datasources/`, using the `datasource.imageBase` value as the image prefix and a corresponding image built by `.github/workflows/build-images.yml`.
- There's no local `helm template`/lint tooling configured in this repo; validate chart changes with `helm template ./helm -f <values-file>` or `helm lint ./helm` if Helm is available locally.

## Secrets and env files

`.env` and `secrets.yml` in this working tree contain real, live credentials (Elasticsearch/Postgres/MinIO/Redis passwords, MiData OAuth client secret, RAGFlow API key) — both are gitignored. Never copy their contents into commits, code, or generated files.
