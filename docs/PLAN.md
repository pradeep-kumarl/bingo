# Plan (event ends Oct 11)

- [x] Day 1: gov-web live on Amplify (ap-south-1: https://main.dz6psz0qwkmgt.amplifyapp.com), Expo app opens on phone, AWS Budgets alert
- [x] Day 2 (backend): data model (types.ts), scan API (functions/scan), bay-token Lambda, seed data
- [x] Day 2 (frontend): gov dashboard (zone summary, vehicle fills, household cards, swap alerts), resident screens (login, scan, green-tick, BinGo card, history, out-of-station), bay tablet QR page
- [ ] Final: SAM deploy to AWS, seed run, set NEXT_PUBLIC_API_BASE_URL in Amplify console, redeploy
- [ ] Video done before submission, submit with buffer
- [ ] Keep Amplify + backend running until results are announced

## MVP screens
Resident app: login, scan, green-tick result, BinGo card, history, out-of-station toggle
Government web: zone summary, vehicle fill bars, per-household BinGo card grid, swap alerts
Bay page: rotating QR token (tablet at each bay, /bay/[bayId])

## Deploy checklist
1. `sam build && sam deploy --guided` from backend/ (region ap-south-1)
2. Copy HttpApiUrl output → set NEXT_PUBLIC_API_BASE_URL in Amplify console env vars
3. `ts-node backend/seed/seed.ts` to populate DynamoDB
4. Push to git → Amplify auto-redeploys
5. Open https://main.dz6psz0qwkmgt.amplifyapp.com and verify dashboard shows live data
6. Open /bay/bay-wet-01 on a tablet — confirm QR refreshes every 55s
7. Paste deep-link into resident app Scan screen — confirm green tick
