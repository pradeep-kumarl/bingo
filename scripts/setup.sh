#!/usr/bin/env bash
set -e
[ -f apps/gov-web/package.json ] || npx create-next-app@latest apps/gov-web --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
[ -f apps/resident-app/package.json ] || npx create-expo-app@latest apps/resident-app --template blank-typescript
echo "Done. Next: cd apps/gov-web && npm run dev"
