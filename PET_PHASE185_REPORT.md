# PET Phase 1.85 Report

## Scope

Balance pass only.

- Không sửa UI.
- Không sửa layout.
- Không đổi API contract.
- Không triển khai durability thật.
- Không đổi database schema.

## Files Changed

### Code

- `backend/src/services/rewardService.js`
- `backend/scripts/seed-pet-game-config.js`

### Report

- `PET_PHASE185_REPORT.md`

## Reward Before / After

### 1. Lesson Complete

Before:

- `petHappiness = 2`

After:

- `petHappiness = 1`

Other reward fields unchanged:

- coin: `5`
- petExp: `3`

### 2. Quiz High Score

Before:

- shared threshold effectively treated as `9` for both quiz and assignment
- quiz bonus happiness from Phase 1.5: `+5`

After:

- quiz high score threshold: `>= 90/100`
- quiz bonus happiness: `+3`

Other reward fields unchanged:

- coin: `10`
- petExp: `5`
- base high-score pet happiness from reward config stays as before

### 3. Learning Path Checkpoint

Before:

- bonus happiness from Phase 1.5: `+10`

After:

- bonus happiness: `+6`

Other reward fields unchanged:

- coin: `20`
- petExp: `10`

### 4. Assignment High Score

Before:

- shared threshold effectively treated as `9` for both quiz and assignment

After:

- assignment high score threshold: `>= 9/10`

Other reward fields unchanged:

- coin: `10`
- petExp: `5`
- petHappiness: unchanged

## High Score Before / After

### Before

- `rewardHighScore()` used one shared threshold path for high score reward gating.
- Quiz and assignment were both effectively checked through the same reward path logic.

### After

Introduced explicit helpers:

- `isQuizHighScore()`
- `isAssignmentHighScore()`

Behavior now:

- quiz: high score only when `score >= 90`
- assignment: high score only when `score >= 9`

This keeps quiz and assignment separated without changing routes or API payloads.

## Toy Before / After

### Ball

Before:

- happiness: `+12`
- health: `+0`
- energy cost: `-4`

After:

- happiness: `+10`
- health: `+1`
- energy cost: `-4`

### Teddy

Before:

- happiness: `+14`
- health: `+0`
- energy cost: `-3`

After:

- happiness: `+12`
- health: `+2`
- energy cost: `-3`

## Phase 2 Preparation Metadata

Added catalog metadata only:

- `ball.maxDurability = 100`
- `ball.durabilityLossPerUse = 3`
- `teddy.maxDurability = 100`
- `teddy.durabilityLossPerUse = 2`

Important:

- metadata is only stored in catalog seed/config
- runtime durability is not implemented
- inventory schema is unchanged
- repository logic is unchanged

## API Contract Confirmation

No API routes were changed.

No controller signatures were changed.

No response envelope was changed.

Changed files are backend balance/config files only:

- `rewardService.js`
- `seed-pet-game-config.js`

## UTF-8 Confirmation

This report file is written in UTF-8 and includes Vietnamese text without changing encoding behavior.

## Balance Notes

### Reward inflation reduced

- Lesson complete happiness lowered.
- Quiz high-score happiness bonus lowered.
- Learning path checkpoint happiness bonus lowered.

### Toy identity improved

- ball and teddy now feel more distinct:
  - ball is slightly cheaper, lighter, and weaker
  - teddy is a bit stronger and more rewarding

### High-score balance fixed

- quiz and assignment no longer share the same threshold.

## Technical Summary

### `rewardService.js`

- added `isQuizHighScore()`
- added `isAssignmentHighScore()`
- high-score gate now uses source-aware thresholds
- quiz bonus happiness reduced
- learning-path bonus happiness reduced

### `seed-pet-game-config.js`

- lesson complete pet happiness reduced
- ball effects adjusted
- teddy effects adjusted
- toy durability metadata added for Phase 2 preparation

## Outcome

Phase 1.85 keeps gameplay within the current API/UI constraints while reducing passive happiness inflation and giving toys a clearer identity for the next phase.
