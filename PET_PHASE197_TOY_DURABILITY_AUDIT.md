# PET_PHASE197_TOY_DURABILITY_AUDIT.md

Audit hiện trạng hệ thống Toy Durability.

Phạm vi:
- Không sửa code
- Không đổi database
- Không đổi API
- Không đổi gameplay
- Chỉ đọc mã nguồn, mô phỏng và tổng hợp báo cáo

## Files đã đọc

Core:
- [backend/src/services/inventoryService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/inventoryService.js)
- [backend/src/services/shopService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/shopService.js)
- [backend/src/services/petService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petService.js)
- [backend/src/services/petItemEffectService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petItemEffectService.js)
- [backend/src/services/petMathService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petMathService.js)

Controllers / routes:
- [backend/src/controllers/inventoryController.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/controllers/inventoryController.js)
- [backend/src/controllers/shopController.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/controllers/shopController.js)
- [backend/src/controllers/petController.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/controllers/petController.js)
- [backend/src/routes/petRoutes.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/routes/petRoutes.js)

Config:
- [backend/scripts/seed-pet-game-config.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/scripts/seed-pet-game-config.js)

Frontend:
- [frontend/src/pet/api/petApi.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/frontend/src/pet/api/petApi.js)
- [frontend/src/pet/api/inventoryApi.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/frontend/src/pet/api/inventoryApi.js)
- [frontend/src/pet/api/shopApi.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/frontend/src/pet/api/shopApi.js)
- [frontend/src/pet/pages/inventory/inventoryPage.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/frontend/src/pet/pages/inventory/inventoryPage.js)
- [frontend/src/pet/pages/shop/shopPage.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/frontend/src/pet/pages/shop/shopPage.js)
- [frontend/src/pet/pages/feed/feedPage.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/frontend/src/pet/pages/feed/feedPage.js)
- [frontend/src/pet/services/petClient.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/frontend/src/pet/services/petClient.js)

## 1. Toy System Audit

### 1.1 Toy hiện có

Từ [seed-pet-game-config.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/scripts/seed-pet-game-config.js), hiện chỉ có 2 item category `toy`:

| Toy | Price | Durability (runtime) | Durability meta | Happiness Gain | Other Effects |
|---|---:|---|---|---:|---|
| Ball (`ball`) | 12 | Not tracked | `maxDurability=100`, `durabilityLossPerUse=3` | +10 | `health +1`, `energy -4` |
| Teddy (`teddy`) | 15 | Not tracked | `maxDurability=100`, `durabilityLossPerUse=2` | +12 | `health +2`, `energy -3` |

Ghi chú:
- `maxDurability` và `durabilityLossPerUse` chỉ tồn tại trong seed config.
- Không thấy field durability nào được persist trong inventory state hoặc pet state.

### 1.2 Toy type / catalog behavior

Trong catalog:
- `ball`: `category: "toy"`, `consumable: true`, `affectsPet: true`, `maxStack: 20`
- `teddy`: `category: "toy"`, `consumable: true`, `affectsPet: true`, `maxStack: 20`

Điểm quan trọng:
- Toy hiện được mô tả như vật phẩm tiêu hao trong catalog.
- Nhưng toy không có durability runtime.
- Và đường UI hiện tại còn không gọi đúng API để tiêu hao toy.

## 2. Play Action Audit

### 2.1 Flow thực tế khi user bấm Play ở Inventory

Nguồn:
- [frontend/src/pet/pages/inventory/inventoryPage.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/frontend/src/pet/pages/inventory/inventoryPage.js)
- [frontend/src/pet/api/petApi.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/frontend/src/pet/api/petApi.js)
- [backend/src/controllers/petController.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/controllers/petController.js)
- [backend/src/services/petService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petService.js)

Flow thực tế:

```text
User
↓
Click "Chơi" trên inventory card
↓
frontend/src/pet/pages/inventory/inventoryPage.js -> petApi.playPet()
↓
POST /api/pet/play
↓
backend/src/controllers/petController.js
↓
backend/src/services/petService.js -> play()
↓
mutatePetAction(actionName = PLAY)
↓
syncPetRuntime()
↓
validateActionGate()
↓
applyActionDelta()
↓
applyPetMutation()
↓
savePetState()
↓
Response trả pet state mới
```

### 2.2 Có consume durability không

- Không.
- `play()` của pet service không đọc `itemId`.
- `validatePetActionBody()` chỉ giữ lại `idempotencyKey`, mọi field khác bị bỏ.
- Do đó `itemId` mà inventory page gửi lên backend bị bỏ qua hoàn toàn.

### 2.3 Có consume quantity không

- Không trong flow `play`.
- Quantity chỉ bị trừ nếu đi qua `POST /api/pet/inventory/use`.
- Nhưng inventory page hiện không gọi endpoint đó cho nút `Chơi`.

### 2.4 Có randomness không

- Không thấy randomness trong backend play/durability flow.
- Play action deterministic:
  - cộng happiness theo config
  - trừ energy theo config
  - cộng exp theo config
  - áp cooldown

### 2.5 Có cooldown không

Có:
- `play.cooldownSeconds = 300`
- `minEnergyToAllow = 15`

### 2.6 Có giới hạn spam không

Có, nhưng chỉ ở cấp action:
- cooldown 300 giây
- energy gate

Không có giới hạn spam theo toy durability.

## 3. Durability Logic Audit

### 3.1 Durability giảm ở đâu

Không thấy runtime giảm durability ở đâu.

Kiểm tra repo:
- `maxDurability` chỉ xuất hiện trong seed config
- `durabilityLossPerUse` chỉ xuất hiện trong seed config
- không có service nào đọc hoặc trừ durability

### 3.2 Giảm theo công thức nào

Không có công thức runtime.

Nếu nhìn seed metadata:
- Ball: `-3` mỗi use
- Teddy: `-2` mỗi use

Nhưng các con số này chưa được dùng ở runtime.

### 3.3 Có floor về 0 không

Không áp dụng, vì durability không được tính.

### 3.4 Có thể âm không

Không có state durability để âm.

### 3.5 Có thể vượt max không

Không có state durability để vượt max.

### 3.6 Kết luận về durability

| Test | Kết luận |
|---|---|
| `durability = 1` | Không có runtime path |
| `durability = 0` | Không có runtime path |
| `durability < 0` | Không có runtime path |

Đánh giá:
- `Needs Fix`

Lý do:
- durability hiện chỉ là metadata, không phải mechanic đang chạy.

## 4. Broken Toy Audit

### 4.1 Khi durability = 0

Trong runtime hiện tại:
- không có trạng thái broken
- không có `isBroken`
- không có `brokenAt`
- không có disable logic theo durability

### 4.2 Có còn dùng được không

Có.
- Vì durability không được enforce.
- Nút `Chơi` trong inventory vẫn gọi `pet/play`.

### 4.3 Có còn cộng happiness không

Có.
- `pet/play` cộng happiness theo `petBalance.actions.play.happinessIncrease`
- hiện là `+12`

### 4.4 Có bị consume tiếp không

Không qua flow `play`.
- Không trừ quantity
- Không trừ durability

### 4.5 Có hiển thị trạng thái hỏng không

Không.
- Frontend inventory/shop chỉ hiển thị quantity, không hiển thị durability hoặc broken state.

### 4.6 Behavior runtime chính xác

Kết luận:
- Toy không bao giờ “broken” trong runtime hiện tại.
- `durability = 0` chỉ tồn tại trên paper nếu Phase 2 triển khai sau.

## 5. Inventory Consistency Audit

### 5.1 Toy có stack không

Có.
- `ball.maxStack = 20`
- `teddy.maxStack = 20`

Trong inventory service:
- stack được quản lý bằng `quantity`
- không có từng item instance riêng lẻ

### 5.2 Toy có unique durability riêng từng item không

Không.
- không có item instance durability
- không có per-item state
- inventory model hiện chỉ là `itemId + quantity + metadata`

### 5.3 Durability nằm ở item definition hay không

Hiện tại:
- `maxDurability` và `durabilityLossPerUse` nằm ở definition
- nhưng chỉ là metadata
- không ảnh hưởng runtime

### 5.4 Mua nhiều toy cùng loại

Flow:
- `shopService.buyItem()` cộng quantity
- giới hạn bởi `maxStack`
- không gắn durability riêng cho từng unit

### 5.5 Dùng nhiều toy cùng loại

Có 2 đường:

#### Đường A: UI inventory play
- không giảm quantity
- không dùng durability
- chỉ chạy `pet/play`

#### Đường B: API inventory/use
- `useItemFromInventory()` sẽ trừ quantity
- nhưng vẫn không dùng durability
- item consumable true nên quantity biến mất theo số lượng

### 5.6 Xóa toy / bán toy

- Không thấy flow xóa toy riêng.
- Không thấy flow bán toy.
- Không thấy route sell trong backend/frontend.

### 5.7 Bug inventory tiềm ẩn

1. UI inventory gọi sai endpoint cho toy.
2. `itemId` gửi lên `pet/play` bị bỏ qua.
3. Toy không có runtime durability.
4. Toy consumable flag và play UX đang mâu thuẫn.
5. Generic `inventory/use` có quantity consumption nhưng không phải flow mà toy card đang dùng.

## 6. Economy Audit

### 6.1 Reward coin hiện tại

Từ reward flow hiện tại:
- daily login: 3 coin
- lesson complete: 5 coin
- quiz high score: +10 coin
- assignment: 10 coin
- assignment high score: +10 coin
- learning path checkpoint: 50 coin override
- learning path mountain: 200 coin override

### 6.2 Coin/ngày theo profile

#### LIGHT USER
- daily login + 1 lesson/day
- coin/ngày = `3 + 5 = 8`

#### MEDIUM USER
- daily login + 1 lesson/day + 1 quiz/day
- nếu quiz high score:
  - coin/ngày = `3 + 5 + 10 = 18`
- nếu quiz không high score:
  - coin/ngày = `8`

#### ACTIVE USER
- daily login + 1 lesson/day + 1 quiz/day + learning path checkpoint
- coin/ngày = `3 + 5 + 10 + 50 = 68`
- nếu learning path còn có mountain, coin còn cao hơn nữa

### 6.3 Toy mua được bao lâu

Giá:
- Ball = 12
- Teddy = 15

Ước tính:
- LIGHT:
  - Ball: 2 ngày
  - Teddy: 2 ngày
- MEDIUM:
  - Ball: 1 ngày
  - Teddy: 1 ngày
- ACTIVE:
  - Ball: trong ngày đầu
  - Teddy: trong ngày đầu

### 6.4 Đánh giá giá toy

Kết luận:
- Giá toy hiện tại khá rẻ so với reward economy.
- Nhưng vấn đề lớn hơn là toy không bị tiêu hao ở flow UI thật.
- Vì vậy trong thực tế toy còn “rẻ hơn giá” rất nhiều, gần như một lần mua là dùng mãi.

## 7. Durability Lifetime Simulation

### 7.1 Current runtime

Vì durability không được enforce:
- lifetime thực tế của toy theo flow `inventory/play` là **vô hạn**
- bị giới hạn bởi cooldown và energy, không phải durability

| Toy | 1 Play/Day | 3 Plays/Day | 5 Plays/Day |
|---|---:|---:|---:|
| Ball | ∞ | ∞ | ∞ |
| Teddy | ∞ | ∞ | ∞ |

### 7.2 Nếu nhìn theo metadata seed như giả định Phase 2

Chỉ để tham khảo, không phải runtime hiện tại:
- Ball: `100 / 3` -> khoảng 34 lần use trước khi chạm 0
- Teddy: `100 / 2` -> khoảng 50 lần use trước khi chạm 0

Nếu giả định 1 toy = 1 use/day:
- Ball: ~34 ngày
- Teddy: ~50 ngày

Nếu giả định 3 uses/day:
- Ball: ~12 ngày
- Teddy: ~17 ngày

Nếu giả định 5 uses/day:
- Ball: ~7 ngày
- Teddy: ~10 ngày

Nhưng nhắc lại:
- đây là mô phỏng giả định theo metadata
- không phải runtime hiện tại

## 8. Exploit Audit

### 8.1 Spam play

Tình huống:
- user bấm `Chơi` ở inventory page liên tục

Nguyên nhân:
- `playItem()` gọi `petApi.playPet()`
- backend `play()` không dùng `itemId`
- durability không tồn tại

Mức độ ảnh hưởng:
- cao
- toy không bị hao mòn
- toy ownership không quan trọng
- chỉ còn cooldown 300 giây và energy gate

Risk level:
- HIGH

### 8.2 Infinite happiness

Tình huống:
- người chơi dùng play loop để giữ happiness cao

Nguyên nhân:
- play cộng happiness
- không có durability/hard cost cho toy
- toy không bị consume trong UI play path

Mức độ ảnh hưởng:
- cao về balance
- happiness từ toy không bị giới hạn theo tài nguyên toy

Risk level:
- HIGH

### 8.3 Durability bypass

Tình huống:
- `durabilityLossPerUse` không hề chạy

Nguyên nhân:
- metadata không được consume ở runtime
- UI gọi sai endpoint

Mức độ ảnh hưởng:
- hệ thống durability thực tế không tồn tại

Risk level:
- HIGH

### 8.4 Negative durability

- Không thể xảy ra vì durability không được tính.

Risk level:
- LOW

### 8.5 Duplicate toy

Tình huống:
- mua nhiều toy cùng loại

Quan sát:
- inventory có stack `quantity`
- `maxStack = 20`
- không có per-instance durability nên duplicate không tạo state mới

Risk level:
- LOW to MEDIUM

### 8.6 Race condition / multi-tab

Quan sát:
- `shopService.buyItem()` và `inventoryService.useItem()` đều chạy trong transaction
- có idempotency key cache

Tuy nhiên:
- inventory/play path không consume item
- nên race condition không phải vấn đề chính của durability

Risk level:
- MEDIUM

### 8.7 Direct API exploit

Tình huống:
- gọi thẳng `POST /api/pet/play`
- hoặc `POST /api/pet/inventory/use`

Quan sát:
- `play` không yêu cầu toy ownership
- `inventory/use` có thể tiêu hao stack nhanh nhưng không dùng durability

Risk level:
- HIGH cho path `play`
- MEDIUM cho path `inventory/use`

## 9. Balance Assessment

| Category | Score / 10 |
|---|---:|
| Durability Design | 2 |
| Economy Balance | 3 |
| Abuse Resistance | 2 |
| Child Friendliness | 7 |

Giải thích:
- Durability Design thấp vì metadata chưa chạy runtime.
- Economy Balance thấp vì toy quá rẻ so với rewards và lại không hao mòn ở path thật.
- Abuse Resistance thấp vì không có durability enforcement và UI gọi nhầm endpoint.
- Child Friendliness khá hơn vì UI đơn giản, nhưng đang đơn giản quá mức đến mức mất chức năng.

## 10. Recommendations

Không sửa code trong phase này, chỉ đề xuất.

### LOW RISK

- Hiển thị rõ `quantity` và trạng thái item trong UI.
- Đồng bộ tên gọi hành động: nếu là toy, tránh gọi nhầm là `play` nếu không consume item.
- Log riêng play path và inventory-use path để dễ debug.

### MEDIUM RISK

- Chuyển inventory toy card sang gọi `inventory/use` nếu muốn toy thực sự là vật phẩm tiêu hao.
- Đồng bộ response để frontend biết quantity thay đổi sau khi dùng toy.
- Tách rõ “pet play” và “use toy”.

### HIGH RISK

- Thêm durability runtime cho toy instance.
- Thêm broken state và repair flow sau đó.
- Điều chỉnh economy nếu toy từ infinite-use thành reusable-with-wear.

## Final Verdict

1. Toy durability hiện có hoạt động đúng không?
- Không.
- Hiện chỉ là metadata trong seed config.

2. Có bug nghiêm trọng nào không?
- Có.
- Inventory page gọi sai API cho toy.
- `itemId` bị bỏ qua ở `pet/play`.
- Toy không hao mòn ở flow UI thật.

3. Có exploit nào không?
- Có.
- Người chơi có thể dùng toy play nhiều lần mà không mất quantity/durability.
- Direct API `play` không cần ownership toy.

4. Toy economy có hợp lý không?
- Chưa hợp lý.
- Toy quá rẻ so với coin economy, và thực tế còn gần như không bị tiêu hao.

5. Có cần Phase 1.98 Rebalance không?
- Có.
- Cần ít nhất một phase fix alignment giữa UI, API và durability model.

6. Mức độ hoàn thiện hiện tại của Toy System (%)
- Khoảng **30%**.

7. Có đủ điều kiện chuyển sang Final Pet Audit chưa?
- Chưa.
- Cần xử lý ít nhất:
  - toy use path
  - durability runtime
  - inventory/play mismatch

## Kết luận cuối

Toy system hiện tại là một hybrid chưa hoàn chỉnh:
- catalog đã có metadata durability
- inventory có quantity
- shop có maxStack
- nhưng runtime chưa có durability
- và UI toy còn gọi sai endpoint

Nói ngắn gọn:
- toy đang tồn tại như dữ liệu,
- chưa tồn tại như một cơ chế gameplay hoàn chỉnh.
