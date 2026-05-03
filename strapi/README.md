# strapi-ragflow-adapter

Fetches published sections and chapters from the Thilo Scouts Strapi API (all supported locales: `de`, `fr`, `it`), writes each section as a Markdown file plus a JSON metadata file, and uploads both to an S3-compatible object store.

## Configuration

Copy `.env.sample` to `.env` and fill in the values:

| Variable | Description |
|---|---|
| `S3_ENDPOINT` | Full URL of the S3-compatible endpoint (e.g. `https://fsn1.your-objectstorage.com`) |
| `S3_REGION` | Region identifier (e.g. `fsn1`) |
| `S3_BUCKET` | Target bucket name |
| `S3_PREFIX` | Optional key prefix inside the bucket |
| `S3_ACCESS_KEY_ID` | Access key |
| `S3_SECRET_ACCESS_KEY` | Secret key |

## Run with Docker

```sh
docker run --rm \
  -e S3_ENDPOINT=https://fsn1.your-objectstorage.com \
  -e S3_REGION=fsn1 \
  -e S3_BUCKET=my-bucket \
  -e S3_PREFIX=ragflow \
  -e S3_ACCESS_KEY_ID=your-access-key \
  -e S3_SECRET_ACCESS_KEY=your-secret-key \
  -e STRAPI_BASE_URL=https://api.thilo.scouts.ch \
  strapi-ragflow-adapter
```

## Local development

```sh
npm install
cp .env.sample .env   # fill in values
npx ts-node app.ts
```
