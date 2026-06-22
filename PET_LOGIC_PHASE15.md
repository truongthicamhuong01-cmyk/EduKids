# PET Logic Phase 1.5

## Scope

Backend-only gameplay tuning after Phase 1.

- No UI changes.
- No layout changes.
- No frontend changes.
- No API contract changes.

## Files Changed

### Code

- `backend/src/services/petDecayService.js`
- `backend/src/services/rewardService.js`

### Reports

- `PET_LOGIC_PHASE15.md`
- `INVENTORY_AUDIT.md`

## New Balancing

### Decay rates

Updated backend decay constants:

- Hunger: `-1 / hour`
- Energy: `-1 / hour`
- Happiness: `-0.25 / hour`
- Health: `-0.5 / hour` when hunger or energy is below `20`

### Sleep rules

Unchanged from Phase 1:

- auto sleep when `energy <= 15`
- sleeping energy recovery `+3 / hour`
- auto wake when `energy >= 70`

## Reward Integration Status

The reward pipeline already supported pet mutation through `rewardService`.

Phase 1.5 adds extra pet bonuses on top of the existing config rewards:

- Lesson complete:
  - bonus `happiness +2`
- Quiz reward:
  - bonus `happiness +5`
  - implemented through the existing `highScore` reward path used by quiz submission
- Learning Path checkpoint reward:
  - bonus `happiness +10`
  - bonus `energy +5`

### Current reward flow

Learning activity
-> reward controller/service
-> `rewardService.grantReward()`
-> `applyPetMutation()`
-> clamp stats to `0-100`
-> persist pet state
-> return response

### Actual learning activity sources in code

- Quiz submit controller:
  - `rewardLessonComplete()`
  - `rewardHighScore()`
- Learning path controller:
  - `rewardLearningPath()`
- Assignment controller:
  - `rewardAssignment()`
  - `rewardHighScore()`
- Auth/login flow:
  - `rewardDailyLogin()`

## Gameplay Simulation

Assumptions:

- Starting pet state: `100 / 100 / 100 / 100`
- `isSleeping = false`
- no learning/reward actions during the simulated period
- derived mood uses Phase 1 thresholds

## After 24 Hours Without Learning

- Hunger: `76`
- Energy: `76`
- Happiness: `94`
- Health: `100`
- Mood: `happy`
- Sleeping: `false`

Reason:

- sleep does not trigger yet
- health never drops because hunger and energy stay at or above `20`

## After 72 Hours Without Learning

- Hunger: `28`
- Energy: `28`
- Happiness: `82`
- Health: `100`
- Mood: `normal`
- Sleeping: `false`

Reason:

- still above sleep threshold
- health still does not decay
- mood is no longer `happy` because the happy rule requires strong stat thresholds

## After 7 Days Without Learning

Seven days = `168` hours.

- Hunger: `0`
- Energy: `8`
- Happiness: `58`
- Health: `56`
- Mood: `sleepy`
- Sleeping: `true`

Reasoning:

- hunger reaches `0` by hour `100`
- energy drops to `15` at hour `85`, then auto-sleeps
- while sleeping, energy recovers until it wakes at `70+`
- after waking, energy decays again and ends below the sleep threshold
- health starts decaying from hour `81` because hunger and energy are below `20`
- total health decay over the period is `44`

## Inventory Audit Summary

See full details in `INVENTORY_AUDIT.md`.

Key point:

- the current inventory screen uses `/api/pet/play` for toy interaction
- this does not consume inventory quantity
- the backend consume route is `/api/pet/inventory/use`
- the current UI and backend inventory model are not aligned

## Risks

### 1. Reward inflation

The new bonuses are additive to existing rewardConfig pet stats, not replacements.

That means learning rewards now push pet happiness higher than before, which is intended for this phase but should still be watched.

### 2. Sleep oscillation

Because sleep recovery is much stronger than normal energy decay, pet energy can bounce between sleep and awake states in long inactive periods.

This is acceptable for now, but the threshold interplay may need future tuning.

### 3. Inventory mismatch remains

The inventory screen still bypasses the inventory consume endpoint for toys.

That is intentionally left for Phase 2.

### 4. No frontend feedback changes

Since UI is unchanged, players will still see the same screens and interactions while the backend behavior becomes softer and more companion-like.

## Summary

Phase 1.5 slows down decay, reduces health pressure, and strengthens learning-related pet rewards.

The result is a pet that feels more like a learning companion and less like a daily-penalty system, while keeping the existing API surface intact.
