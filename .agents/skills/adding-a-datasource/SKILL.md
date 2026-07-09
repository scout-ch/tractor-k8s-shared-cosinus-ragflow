---
name: adding-a-datasource
description: Use when adding a new datasource to this repo — a CronJob that fetches content from an external site/API and uploads markdown or PDF files to S3 for RAGFlow to ingest — or when asked to sync a new website/API into RAGFlow.
---

# Adding a Datasource

## Overview

A datasource is a container run on a schedule
(`helm/templates/datasources/*.yaml` CronJobs) that fetches content from one
external system and uploads files to an S3 bucket. Two reference
implementations to copy from, depending on shape:
- `strapi/` (thilo, hering) — one adapter reused for multiple named sources
  via a `datasource.strapi.<name>` map in `values.yaml` and a `range` over
  it in the CronJob template.
- `cudesch/` — a single source with per-locale auth tokens and a flat
  (non-map) `datasource.cudesch` config block.

## Procedure

1. New `<name>/` directory: fetch/upload logic + `Dockerfile`. Add `<name>`
   to `matrix.image` in `.github/workflows/build-images.yml` — skip this and
   the CronJob's image never gets built.

2. Deterministic S3 keys, so re-running with unchanged content overwrites
   the same keys instead of duplicating (`putObject` already overwrites).
    - Fetch all relevant contents in all languages (usually de/fr/it).
    - Filenames on S3 should be nested under the locale, start with `<name>-`
      plus an ordinal if the source produces multiple files (use real
      display-order, like in the source app) and then a description / title
      of the file content.
    - Delete stale objects the run no longer produces (list the source's S3
      prefix, diff, delete). Without this, a shrinking/reordered source leaks
      orphaned files forever — index-based keys are not enough on their own.
      `cudesch/app.ts`'s `removeStaleObjects` is a worked example.
    - If the best output format is Markdown: metadata goes in YAML frontmatter
      in the file. If it's PDF: Check what RAGFlow actually reads from S3
      object metadata/tags before inventing a way to carry source info.
    - Required metadata: title (description of file content), source_document
      (value is just `<name>`), source_url (closest URL that points to the
      contents as seen on the source webapp)

3. Add tests for the adapter, and add them to the GitHub Actions CI.

4. Helm: non-secret config under `values.yaml`'s `datasource.<name>`;
   `helm/templates/datasources/<name>.yaml` CronJob using
   `datasource.imageBase`+`-<name>` as the image, with an `ensure-bucket`
   initContainer (`mc mb --ignore-existing`, copy `cudesch.yaml`) — never
   assume the bucket exists. Only add a dedicated `Secret` if the source
   needs creds beyond MinIO root (`cudesch-secrets.yaml` shows the fallback).
   Validate with `helm template ./helm -f helm/values.yaml --set ...`

5. RAGFlow won't ingest the bucket on its own — this repo has no automation
   for creating the dataset/file-source connector (README todo: "Set up
   multiple datasets"). Someone has to wire it up manually in the RAGFlow
   admin UI after deploying.

6. Add the source to README's "Add data sources" checklist, using the
   finished `thilo` entry's sub-items as the done-definition template. Also
   update any other documentation in the repo where appropriate.

7. If the data source requires some new secrets, please remind me to copy
   from secrets.example.yml, fill them in and apply them to the cluster
   using `kubectl apply -f secrets.yml`.