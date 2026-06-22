# Inventory Audit

## Scope

Read-only audit of the current Pet inventory flow.

No code changes are made in this document.

## Current Flow

### Inventory screen action: toy use

Current frontend inventory page calls:

- `frontend/src/pet/pages/inventory/inventoryPage.js`
- `petApi.playPet(...)`
- endpoint: `POST /api/pet/play`

Relevant API wrapper:

- `frontend/src/pet/api/petApi.js`

Relevant route:

- `backend/src/routes/petRoutes.js`
- `backend/src/controllers/petController.js`

### Backend behavior for `/api/pet/play`

The request goes to:

- `petService.play()`
- `mutatePetAction()`

This path:

- mutates pet stats
- applies cooldown validation
- saves pet state
- does **not** consume inventory
- does **not** decrement item quantity

## Answers to Required Questions

### 1. Khi dùng đồ chơi, API nào được gọi?

Current inventory page calls:

- `POST /api/pet/play`

Notably, it does **not** call:

- `POST /api/pet/inventory/use`

### 2. Item có bị consume không?

No, not on the current inventory-page toy flow.

Because `/api/pet/play` only mutates pet state, it does not touch inventory stock.

### 3. Inventory có giảm số lượng không?

No, not on the current inventory-page toy flow.

Quantity reduction only happens in:

- `backend/src/services/inventoryService.js`
- `useItemFromInventory()`

when the request hits:

- `POST /api/pet/inventory/use`

### 4. Backend có thực sự dùng itemId không?

For the current inventory-page toy flow:

- `itemId` is passed in the body
- `petController.play` validates the body
- `petService.play()` forwards the body into the pet action pipeline
- the actual play mutation logic does not use `itemId` to select or consume inventory

So in practice:

- `itemId` is not used as an inventory selector on `/api/pet/play`

For the real inventory consume route:

- `POST /api/pet/inventory/use`
- `itemId` is used to look up the catalog item

### 5. Logic hiện tại có đúng với mô hình "Đồ chơi là vật phẩm tiêu hao" hay không?

No, not for the current inventory-page flow.

Reasons:

- the inventory page uses `/api/pet/play`
- the consume path is `/api/pet/inventory/use`
- the two flows are not aligned
- toy usage from inventory does not reduce quantity

## Backend Inventory Logic

### `POST /api/pet/inventory/use`

This backend route exists and does the following:

- loads item config from `shopCatalog`
- checks inventory ownership
- consumes quantity if `itemConfig.consumable !== false`
- applies pet stat effects if `itemConfig.affectsPet !== false`
- persists updated inventory
- persists updated pet state

### Consumable behavior

In backend inventory service:

- `consumable: true` -> item quantity decreases
- `consumable: false` -> item becomes equipped / toggled, quantity does not decrease

### Important mismatch

Toy items in the catalog are typically marked:

- `category: "toy"`
- `consumable: true`

However the current UI inventory page still routes toy clicks to `/api/pet/play`, bypassing the consume logic.

## Current Inventory Architecture

### Inventory data source

Inventory state is stored in Firestore under the user’s inventory document.

### Inventory read path

- `GET /api/pet/inventory`
- `backend/src/controllers/inventoryController.js`
- `backend/src/services/inventoryService.js`

### Inventory write path

- `POST /api/pet/inventory/use`
- `backend/src/controllers/inventoryController.js`
- `backend/src/services/inventoryService.js`

## Problems Found

### 1. UI/backend route mismatch

The inventory page visually presents toy use as inventory consumption, but the actual action goes through `/api/pet/play`.

### 2. No stock decrement on toy use from inventory screen

Because the play route does not read inventory, users can reuse the same toy repeatedly without consuming it.

### 3. `targetPetId` is not functionally enforced

The inventory consume endpoint accepts `targetPetId`, but current backend logic does not use it to enforce target validation.

### 4. Two competing concepts exist

There is both:

- a pet action route: `/api/pet/play`
- an inventory consume route: `/api/pet/inventory/use`

The current frontend uses the former for toy interaction, while the backend inventory model expects the latter for consumption.

## Phase 2 Recommendation

### Preferred architecture

Unify toy interaction on a single backend inventory consume flow:

- user clicks toy
- frontend calls `/api/pet/inventory/use`
- backend:
  - validates inventory ownership
  - consumes quantity
  - applies pet effects
  - returns updated inventory + pet state

### Why this is better

- one source of truth for item consumption
- no duplicated pet action semantics
- easier reward/stat balancing
- clearer inventory audit trail

### Secondary cleanup

- make `targetPetId` validation explicit if the feature requires it
- distinguish between:
  - pet actions
  - item consumption
  - cosmetic/equipped items

## Summary

Current inventory logic is partially implemented but not aligned with the inventory screen behavior.

The backend has a proper consume endpoint, but the current UI does not use it for toys, so toy items are not consumed in the observed flow.
