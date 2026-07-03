---
name: updating-ragflow
description: Use when bumping the RAGFlow image tag in this repo (helm/values.yaml ragflow.image.tag), or when asked to update RAGFlow to a new/latest version.
---

# Updating RAGFlow

## Overview

RAGFlow releases often ship breaking changes: new services folded into the
single `infiniflow/ragflow` image's `entrypoint.sh`, or config defaults that
assume MySQL. This repo runs external Postgres and reuses one image across
four deployments (`ragflow`, `mcp`, `datasync`, `taskexecutor` — see
`helm/templates/*.yaml`) with different `entrypoint.sh` flags, plus a sed'd
copy of `entrypoint.sh` in `mcp.yaml`. A naive tag bump can break one of
these silently.

## Procedure

1. **Find current and target version.** Current: `ragflow.image.tag` in
   `helm/values.yaml`. Target: latest tag via
   `gh api repos/infiniflow/ragflow/tags`, or the version named in the
   README todo if one is given.

2. **Read every release's notes between current and target, not just the
   latest** (`gh api repos/infiniflow/ragflow/releases/tags/vX.Y.Z`) — a
   breaking change in an intermediate release is easy to miss if you only
   diff against the final tag.

3. **Specifically check for:**
   - New `ensure_*` functions/services added to `entrypoint.sh`. The sed in
     `helm/templates/mcp.yaml` strips `ensure_docling`/`ensure_db_init` for
     the MCP variant — a new function needs the same treatment or it starts
     an unwanted service there.
   - MySQL-only migrations, SQL, or config keys. `helm/templates/ragflow-config.yaml`
     forces `DB_TYPE: postgres`, so anything upstream that only works under
     the MySQL default silently misbehaves here.
   - Renamed/removed `entrypoint.sh` flags (`--disable-webserver`,
     `--enable-mcpserver`, ...) — `ragflow.yaml`, `mcp.yaml`, `datasync.yaml`,
     and `taskexecutor.yaml` each pass a different set.

4. **Update `helm/values.yaml`** (`ragflow.image.tag`). `fluxcd/ragflow.yaml`
   has no tag override today, so this is the only place to change.

5. **Update the README todo checklist** (`- [ ] Update ragflow to X.Y.Z`).

6. **Validate** with `helm template ./helm -f <values-file>` if Helm is
   available locally.
