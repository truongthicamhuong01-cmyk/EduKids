# PET Phase 1.99 - Final System Audit Report

## Executive Summary

Sau khi audit lại toàn bộ Pet System ở trạng thái hiện tại, hệ thống đã đi khá xa về mặt cấu trúc:

- Core pet lifecycle chạy ổn.
- Offline decay và sleep logic chạy nhất quán.
- Evolution thresholds đã được làm reachable hơn.
- Shop, inventory, reward pipeline và toy durability runtime đã có luồng thực tế.

Tuy nhiên vẫn còn một lỗi gameplay mức cao:

- Một số food item đang bị cấu hình `consumable: false`, trong khi luồng feed thực tế đi qua `inventory/use`.
- Hệ quả là sau khi mua `biscuit` hoặc `milk`, người chơi có thể cho ăn lặp vô hạn mà không giảm quantity.

Kết luận ngắn:

- Hệ thống đã gần production-ready.
- Chưa đủ điều kiện khóa backend logic hoàn toàn.
- Chưa nên coi là release-ready cho gameplay economy trước khi vá lỗi food consumption.

## Systems Audited

### Backend

- `backend/src/services/petService.js`
- `backend/src/services/petMathService.js`
- `backend/src/services/petDecayService.js`
- `backend/src/services/petOfflineService.js`
- `backend/src/services/rewardService.js`
- `backend/src/services/inventoryService.js`
- `backend/src/services/shopService.js`
- `backend/src/services/petItemEffectService.js`
- `backend/src/validators/petValidators.js`
- `backend/src/repositories/inventoryRepository.js`
- `backend/src/controllers/quizSubmitController.js`
- `backend/src/controllers/assignmentController.js`
- `backend/src/controllers/learningPathController.js`

### Frontend

- `frontend/src/pet/pages/homePet/homePetPage.js`
- `frontend/src/pet/pages/inventory/inventoryPage.js`
- `frontend/src/pet/pages/shop/shopPage.js`
- `frontend/src/pet/pages/feed/feedPage.js`
- `frontend/src/pet/api/petApi.js`
- `frontend/src/pet/api/inventoryApi.js`
- `frontend/src/pet/api/shopApi.js`
- `frontend/src/pet/api/rewardApi.js`
- `frontend/src/pet/services/petClient.js`
- `frontend/src/pet/renderers/renderInventory.js`
- `frontend/src/pet/utils/assetResolver.js`

### Config

- `backend/scripts/seed-pet-game-config.js`

## Critical Issues

### 1. Infinite Food Exploit

Severity: `HIGH`

Location:

- `backend/scripts/seed-pet-game-config.js`
- `backend/src/services/inventoryService.js`
- `backend/src/services/petService.js`
- `frontend/src/pet/pages/feed/feedPage.js`

Root cause:

- `biscuit` và `milk` đang được seed với `consumable: false`.
- Feed flow dùng `petApi.feedPet()` trên frontend, backend đi vào `petService.feed()`.
- Nếu có `itemId`, backend chuyển sang `inventoryService.useItem()`.
- Với `consumable: false`, `useItemFromInventory()` chỉ đánh dấu `equipped = true`, không giảm quantity.

Reproduction:

1. Mua `biscuit` hoặc `milk` một lần.
2. Vào Feed page.
3. Bấm Cho ăn nhiều lần.
4. Quantity không giảm.

Impact:

- Người chơi có thể cho ăn vô hạn sau một lần mua.
- Economy bị méo.
- Feeding loop không còn phản ánh chi phí thật.

Assessment:

- Đây là exploit thực tế, không phải chỉ là inconsistency.
- Nên vá trước release.

## High Issues

### 1. Durability Model Is Stack-Level, Not Per-Item

Severity: `MEDIUM`

Location:

- `backend/src/services/inventoryService.js`
- `backend/src/repositories/inventoryRepository.js`

Observation:

- Toy durability đang được lưu trong record inventory theo `itemId` + `quantity`.
- Đây là giải pháp đơn giản và đủ cho Phase 1.98.
- Nhưng nó không tạo ra tính cá thể cho từng copy toy.

Risk:

- Nếu sau này muốn per-item wear, repair, hoặc trade system, model này sẽ cần nâng cấp.

### 2. Read Path Mutates Inventory State

Severity: `MEDIUM`

Location:

- `backend/src/services/inventoryService.js`

Observation:

- `getInventory()` có hydrate durability và có thể save lại inventory nếu gặp state cũ/broken toy.

Risk:

- Read path có side effect.
- Không crash, nhưng làm logic khó reasoning hơn.

### 3. High-Score Reward Logic Depends on Source Prefix

Severity: `LOW to MEDIUM`

Location:

- `backend/src/services/rewardService.js`
- `backend/src/controllers/quizSubmitController.js`
- `backend/src/controllers/assignmentController.js`

Observation:

- Quiz và assignment cùng dùng `rewardHighScore()`.
- Threshold đã tách đúng:
  - quiz: `>= 90/100`
  - assignment: `>= 9/10`
- Việc phân biệt dựa trên `sourceId` prefix.

Assessment:

- Hoạt động đúng trong code hiện tại.
- Nhưng là convention-based, nên cần giữ controller chuẩn khi mở rộng về sau.

## Medium Issues

### 1. Some Special Items Are Effectively Placeholder Content

Severity: `MEDIUM`

Location:

- `backend/scripts/seed-pet-game-config.js`

Observation:

- `eventPass` có `affectsPet: false`.
- Đây không phải bug, nhưng gần như chỉ là item collection/placeholder nếu chưa có gameplay riêng.

### 2. Inventory Page Still Receives `petApi` Parameter But No Longer Uses It

Severity: `LOW`

Location:

- `frontend/src/pet/pages/inventory/inventoryPage.js`

Observation:

- Sau phase 1.98, inventory page dùng `inventoryApi.useItem()` cho toy.
- `petApi` trong factory vẫn còn trong signature nhưng không còn là dependency thực tế của luồng toy.

## Low Issues

### 1. Dead / Documentation-Like Config

Location:

- `backend/scripts/seed-pet-game-config.js`

Observation:

- `rewardConfig.rules.highScore.minScore` hiện không phải nguồn truth runtime cho threshold quiz/assignment.
- Runtime đã chuyển sang `isQuizHighScore()` và `isAssignmentHighScore()`.

Assessment:

- Không gây lỗi.
- Có thể xem là metadata/documentation hơn là config thực thi.

### 2. Frontend Asset Mapping Contains Legacy Aliases

Location:

- `frontend/src/pet/utils/assetResolver.js`

Observation:

- Có một số alias icon/item cũ vẫn tồn tại để tương thích.

Assessment:

- Không ảnh hưởng runtime.
- Chỉ là dư thừa nhẹ.

## Exploits Found

### 1. Infinite Food Use

- Severity: `HIGH`
- Risk level: `HIGH`
- Reproduction: mua `biscuit` hoặc `milk`, sau đó feed lặp lại không mất quantity.
- Root cause: `consumable: false` + feed flow đi qua `inventory/use`.

### 2. No Significant Reward Duplication Found

- Severity: `LOW`
- Transaction + idempotency key đang chặn phần lớn duplicate reward.
- `rewardHighScore()` cũng có threshold riêng cho quiz và assignment.

### 3. No Serious Toy Infinite-Use Exploit Remaining

- Severity: `LOW`
- Toy runtime durability đã có.
- Inventory/play mismatch đã được sửa.
- Ownership được enforce trên server.

### 4. No Crash-Grade Multi-Tab Exploit Found

- Severity: `LOW`
- Transaction boundaries vẫn đang giữ hệ thống ổn định.
- Tuy nhiên feed exploit từ food config vẫn là lỗ hổng gameplay.

## Dead Code Found

### Keep

- `backend/src/services/petService.js`
  - `play()` và `feed()` vẫn cần giữ.
- `frontend/src/pet/pages/homePet/homePetPage.js`
  - `petApi.playPet()` là gameplay pet trực tiếp, không liên quan toy.

### Consider Later Cleanup

- `frontend/src/pet/pages/inventory/inventoryPage.js`
  - `petApi` parameter trong factory có thể bỏ ở phase sau nếu muốn giản lược API wiring.
- `backend/scripts/seed-pet-game-config.js`
  - `rewardConfig.rules.highScore.minScore` đang là metadata hơn là logic runtime.

## Production Readiness Score

| Category | Score / 10 |
| --- | ---: |
| Pet Core | 9.0 |
| Economy | 6.5 |
| Shop | 8.0 |
| Inventory | 7.0 |
| Toy System | 8.5 |
| Evolution | 8.5 |
| Stability | 8.0 |
| Abuse Resistance | 6.0 |
| Child Friendliness | 8.0 |

### Total

- Weighted impression: `77 / 100`
- Overall: `7.7 / 10`

## Estimated Completion %

- Estimated gameplay/system completion: `87%`

Rationale:

- Core loops are present and mostly coherent.
- The remaining issues are not numerous, but one of them is a real economy exploit.

## Final Answers

### 1. Pet System hoàn thiện bao nhiêu %?

- Khoảng `87%`.

### 2. Có bug nghiêm trọng nào còn tồn tại không?

- Có.
- Bug nghiêm trọng nhất là infinite food exploit với `biscuit` và `milk`.

### 3. Có exploit nghiêm trọng nào còn tồn tại không?

- Có.
- Chính exploit infinite food nói trên.

### 4. Có đủ điều kiện khóa backend logic không?

- Chưa.
- Cần vá food consumable bug trước.

### 5. Có đủ điều kiện chuyển sang thêm content (toy mới, item mới) không?

- Có thể bắt đầu chuẩn bị content pipeline.
- Nhưng nên fix exploit food trước khi coi là nền tảng ổn định cho mở rộng.

### 6. Có đủ điều kiện chuyển sang UI/UX redesign không?

- Có, nếu chỉ xét nền tảng kỹ thuật hiện tại.
- Nhưng redesign nên đi kèm checklist regression vì economy vẫn còn một exploit cần vá.

### 7. Nếu chỉ còn 3 việc quan trọng nhất trước release thì đó là gì?

1. Vá `consumable` cho food: `biscuit` và `milk` phải bị consume đúng khi feed.
2. Chạy regression end-to-end cho feed/inventory/shop sau khi chỉnh food behavior.
3. Chốt và document rõ mô hình durability stack-level để tránh hiểu nhầm khi mở rộng inventory về sau.

## Verdict

Pet System hiện tại:

- Đã đủ gần production để tiếp tục mở rộng.
- Chưa đủ để gọi là release-ready hoàn toàn.
- Nút thắt cuối cùng không nằm ở pet core hay toy durability, mà nằm ở food consumption và economy integrity.

