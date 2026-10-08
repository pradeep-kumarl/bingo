# BinGo

**Go to the zone. Bingo, done.**

Community waste zones with a digital household ID. Residents scan a QR at the correct vehicle bay; the resident app and the government dashboard both get a green tick.

**Hackathon:** Environmental Hacks (WeMakeDevs x AWS), Waste and Energy track.

> Put these at the top before submitting: live URL, demo login, video link, 3 screenshots, architecture image.

## Structure
```
apps/gov-web        Government dashboard (Next.js + Tailwind + shadcn/ui) -> Amplify Hosting
apps/resident-app   Resident mobile app (Expo / React Native)
backend/            Shared AWS backend (API Gateway + Lambda + DynamoDB + Cognito + SNS + EventBridge)
  functions/        One folder per Lambda
  shared/           Code shared between Lambdas
  seed/             Demo data (clearly labelled simulated)
docs/               Plan, video script, architecture, screenshots
scripts/            Setup helpers
```

## Setup
Windows (PowerShell): `./scripts/setup.ps1`
macOS/Linux: `bash scripts/setup.sh`

## Simulated parts (be honest in the README)
- Vehicle fill level: each scan adds an estimated weight per waste type.
- Demo households, zones and history are seeded and labelled.

## Region
Use AWS Mumbai (ap-south-1).

## BinGo card (recognition, not punishment)
Each household gets a card with five squares: wet, sanitary, dry, furniture, event waste. A correct scan fills a square; a full card is a "BinGo!". Streaks and a zone leaderboard sit on top.
