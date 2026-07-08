# cudesch-ragflow-adapter

Fetches all books from the three cudesch.scout.ch BookStack instances (`de`, `fr`, `it` — each a
separate instance with its own API token), writes one Markdown file per chapter and per loose page
with RAG-relevant metadata in its YAML frontmatter, and uploads it to an S3-compatible object store.

## Configuration for running this adapter standalone

Copy `.env.sample` to `.env` and fill in the values:

| Variable | Description |
|---|---|
| `S3_ENDPOINT` | Full URL of the S3-compatible endpoint (e.g. `https://fsn1.your-objectstorage.com`) |
| `S3_REGION` | Region identifier (e.g. `fsn1`) |
| `S3_BUCKET` | Target bucket name |
| `S3_PREFIX` | Optional key prefix inside the bucket |
| `S3_ACCESS_KEY_ID` | Access key |
| `S3_SECRET_ACCESS_KEY` | Secret key |
| `CUDESCH_BASE_URL` | Base URL shared by the API (`/<locale>/api/...`) and the public reader (`/<locale>/books/...`) |
| `CUDESCH_API_TOKEN_DE` | API token (`token_id:token_secret`) for the German instance |
| `CUDESCH_API_TOKEN_FR` | API token for the French instance |
| `CUDESCH_API_TOKEN_IT` | API token for the Italian instance |

## Run with Docker

```sh
docker build -t cudesch-ragflow-adapter .
docker run --rm \
  -e S3_ENDPOINT=https://fsn1.your-objectstorage.com \
  -e S3_REGION=fsn1 \
  -e S3_BUCKET=my-bucket \
  -e S3_PREFIX=ragflow \
  -e S3_ACCESS_KEY_ID=your-access-key \
  -e S3_SECRET_ACCESS_KEY=your-secret-key \
  -e CUDESCH_BASE_URL=https://cudesch.scout.ch \
  -e CUDESCH_API_TOKEN_DE=your-de-token-id:your-de-token-secret \
  -e CUDESCH_API_TOKEN_FR=your-fr-token-id:your-fr-token-secret \
  -e CUDESCH_API_TOKEN_IT=your-it-token-id:your-it-token-secret \
  cudesch-ragflow-adapter
```

## Local development

```sh
npm install
cp .env.sample .env   # fill in values
npx ts-node app.ts
```
