# Run from the repo root: ./scripts/setup.ps1
$ErrorActionPreference = "Stop"
if (-not (Test-Path "apps/gov-web/package.json")) {
  npx create-next-app@latest apps/gov-web --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
}
if (-not (Test-Path "apps/resident-app/package.json")) {
  npx create-expo-app@latest apps/resident-app --template blank-typescript
}
Write-Host "Done. Next: cd apps/gov-web; npm run dev"
