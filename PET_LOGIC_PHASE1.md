# PET Logic Phase 1

## Scope

Backend-only rework for Pet companion logic.

- No UI/layout changes.
- No frontend code changes in this phase.
- No API contract breakage.
- Existing `GET /api/pet` remains usable.
- Existing Pet data is preserved with backward-compatible migration.

## What Changed

### Files updated

- `backend/src/services/petDecayService.js`
- `backend/src/services/petService.js`
- `backend/src/services/petMathService.js`
- `backend/src/services/petOfflineService.js`
- `backend/src/services/petItemEffectService.js`
- `backend/src/services/rewardService.js`
- `backend/src/services/inventoryService.js`
- `backend/scripts/seed-pet-game-config.js`

### Files added

- `backend/src/services/petDecayService.js`

## New Pet Schema

The normalized pet state now supports these standardized stats:

- `hunger`: `0-100`
- `energy`: `0-100`
- `happiness`: `0-100`
- `health`: `0-100`
- `isSleeping`: `boolean`

Derived/runtime fields still exist in API responses and internal runtime state:

- `mood` is derived, not persisted.
- `stage` is derived from level + evolution config.
- `requiredExpToNextLevel` is derived from level config.
- `isMaxLevel` is derived from level config.

### Default values

For older users whose stored pet document is missing the new fields:

- `hunger = 100`
- `energy = 100`
- `happiness = 100`
- `health = 100`
- `isSleeping = false`

For fresh seed data:

- `backend/scripts/seed-pet-game-config.js` now seeds the same 100 baseline.

## Backend Data Flow

### Read flow

User opens Pet screen or any Pet API call needs current state:

User Action
->  
`petService` loads pet document
->  
`petDecayService.applyPetDecay`
->  
normalize missing stats / resolve sleep state / apply offline decay
->  
`buildPetResponse`
->  
API response to frontend

### Write flow

User performs feed / play / sleep / reward / item-use:

User Action
->  
Action service
->  
`applyPetMutation`
->  
derived mood/stage/runtime recalculated
->  
`stripDerivedPetFields` before persistence
->  
Firestore save
->  
response rebuilt from normalized state

## Decay Flow

Decay is now backend-owned and centralized in `petDecayService.js`.

### Decay rules

- Hunger: `-2` per hour
- Energy: `-1.5` per hour
- Happiness: `-0.5` per hour
- Health: no direct time decay

### Health rule

Health decreases by `1` per hour when either condition is true:

- `hunger < 20`
- `energy < 20`

Health is clamped to never go below `0`.

### Offline/runtime handling

The service computes elapsed time since `lastUpdateAt` / `updatedAt` and applies decay server-side.

Flow:

Stored pet state
->  
Normalize missing fields
->  
Compute elapsed hours
->  
Apply per-hour decay step
->  
Clamp stats
->  
Recompute derived mood/stage
->  
Save normalized result back to DB

## Sleep Flow

### Auto sleep

If:

- `energy <= 15`

then:

- `isSleeping = true`

### Sleep recovery

While sleeping:

- energy increases by `3` per hour
- this replaces the normal `-1.5` per hour energy decay

### Auto wake

If:

- `energy >= 70`

then:

- `isSleeping = false`

### Behavior note

The sleep state is resolved server-side on every runtime normalization and every mutation. Frontend does not decide sleep logic.

## Mood System

`mood` is now derived state.

It is not treated as the source of truth and is stripped before persistence.

Current derivation order:

- `health < 20` -> `sick`
- `energy < 20` -> `sleepy`
- `hunger < 20` -> `hungry`
- `happiness < 30` -> `sad`
- otherwise:
  - if stats are strong enough -> `happy`
  - else -> `normal`

This logic lives in `petMathService.calculateMood()` and is still reused for response shaping.

## Migration Flow

The migration is runtime-safe and backward compatible.

### Existing user with old pet document

Old document
↓
`normalizePetShape`
↓
missing `hunger` / `energy` / `happiness` / `health` / `isSleeping` are filled
↓
defaults applied:

- hunger `100`
- energy `100`
- happiness `100`
- health `100`
- isSleeping `false`

↓
`applyPetDecay` or `applyPetMutation`
↓
`stripDerivedPetFields`
↓
save back without losing existing fields

### Important compatibility detail

- Existing API endpoints are preserved.
- New fields are appended in responses.
- No user-owned data is deleted.
- `mood` is intentionally not stored going forward.

## API Compatibility

### Kept as-is

- `GET /api/pet`
- Pet action endpoints behind the current service layer
- Existing response envelopes
- Existing inventory/shop/reward flows

### Response changes

Pet responses now include:

- `hunger`
- `energy`
- `happiness`
- `health`
- `isSleeping`

Derived response data also includes:

- `mood`
- `stage`
- `canFeed`
- `canPlay`
- `canSleep`

## File-Level Notes

### `backend/src/services/petDecayService.js`

New runtime service for:

- normalization
- decay
- auto sleep / auto wake
- mutation handling
- derived mood/stage recalculation
- stripping derived persistence fields

### `backend/src/services/petService.js`

Main Pet orchestration service updated to:

- hydrate standardized stats
- use backend decay before reads/writes
- persist normalized state only
- keep existing APIs intact
- return derived runtime data in responses

### `backend/src/services/petMathService.js`

Mood thresholds updated for the new companion model.

### `backend/src/services/petOfflineService.js`

Converted into a compatibility wrapper that delegates to the new decay service.

### `backend/src/services/petItemEffectService.js`

Now uses the same mutation pipeline as the rest of the Pet system.

### `backend/src/services/rewardService.js`

Reward grants can now mutate pet stats through the same backend pipeline, while avoiding persistence of derived `mood`.

### `backend/src/services/inventoryService.js`

Inventory item use now saves normalized pet state without persisting derived `mood`.

### `backend/scripts/seed-pet-game-config.js`

Fresh seed data now initializes Pet stats at `100/100/100/100`.

## Frontend vs Backend Responsibility

### Frontend

- displays pet state
- sends user actions
- renders API results

### Backend

- computes decay
- computes sleep transitions
- computes mood
- computes derived progression state
- migrates missing fields
- persists canonical pet state

## Implementation Summary

The old mood-first / lightweight pet logic is now replaced by a backend-owned companion model with:

- standardized stats
- sleeping state
- server-side decay
- server-side migration
- backward-compatible API responses

The result is compatible with old pet documents while moving all business rules to the backend.
