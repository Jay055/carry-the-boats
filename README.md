# Carry the Boats

Evidence-guided 3–4 day strength + hypertrophy tracker.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FJay055%2Fcarry-the-boats)

## What it does

- Three core gym sessions + one optional recovery-dependent session
- Hevy-style set logging with previous-set values beside today's inputs
- Automatic double-progression guidance
- Automatic rest timer
- 14-day workout calendar + full session history
- Exercise rationale, technique cues and equipment-aware substitutions
- Animated/video exercise-guide links
- Bodyweight + waist tracking
- Nigerian-friendly meal examples alongside standard meal ideas
- Local-first persistence with JSON export
- Supabase/Postgres schema with Row Level Security for future cross-device sync
- GitHub Actions production-build gate

## Training logic

The program intentionally avoids novelty for novelty's sake.

1. Stable exercises make progressive overload measurable.
2. Most working sets finish around 1–2 reps in reserve.
3. Heavy/moderate work is used early for strength; moderate/higher reps add muscle with lower joint cost.
4. Compounds get roughly 2–3 minutes rest; isolations usually 90–120 seconds.
5. Priority muscles receive enough weekly volume without making Session D mandatory.
6. No squat, deadlift, or other lift is mandatory if a safer movement trains the same target.
7. Session D adds volume only when recovery is good.

Current baseline direct volume is roughly 9 quad sets, 7 hamstring sets, 8 lateral-delt sets, 5 rear-delt sets plus compound overlap, with additional optional volume on Session D.

## Local development

```bash
npm install
npm run dev
```

## Cloud data

The current UI works immediately with browser persistence. The production database design is in `supabase/schema.sql` and includes:

- profiles
- workouts
- workout_sets
- body_metrics
- equipment_preferences
- Row Level Security policies

## Evidence surfaced in the app

- ACSM resistance-training position stand
- Resistance-training volume dose-response research
- Proximity-to-failure research
- Rest-interval meta-analysis
- Load-spectrum research for hypertrophy and strength
