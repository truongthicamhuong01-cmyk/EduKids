# Toy Durability Audit

## Scope

Audit chỉ đọc code hiện tại và thiết kế kiến trúc cho Phase 2.

- Không sửa UI.
- Không sửa layout.
- Không triển khai durability thật.
- Không thay đổi gameplay ngoài phạm vi Toy.

## 1. Inventory Schema Hiện Tại

### Storage location

Inventory hiện đang lưu theo user tại:

- `users/{uid}/inventory/state`

### Repository layer

Code inventory hiện tại nằm ở:

- `backend/src/repositories/inventoryRepository.js`

### Current document shape

Inventory document hiện tại có dạng:

```json
{
  "categories": {
    "foods": {},
    "toys": {},
    "medicine": {},
    "decoration": {},
    "special": {}
  },
  "updatedAt": "",
  "version": 0
}
```

### Current item shape

Mỗi item trong inventory hiện tại được normalize về:

```json
{
  "itemId": "ball",
  "quantity": 1,
  "equipped": false,
  "updatedAt": "2026-06-22T00:00:00.000Z",
  "metadata": {}
}
```

### Important normalization behavior

`normalizeInventoryState()` hiện chỉ giữ các field sau:

- `itemId`
- `quantity`
- `equipped`
- `updatedAt`
- `metadata`

Điều này có nghĩa là:

- mọi field mới thêm trực tiếp vào item record sẽ bị rơi nếu repository chưa được sửa
- durability không thể chỉ “thêm đại” vào object cũ mà không cập nhật repository

### Inventory service behavior

`backend/src/services/inventoryService.js` hiện chia hai nhánh chính:

- `addItemToInventory()` để cộng item khi mua
- `useItemFromInventory()` để trừ quantity hoặc equip item

`useItemFromInventory()` hiện xử lý như sau:

- nếu `itemConfig.consumable !== false` thì giảm `quantity`
- nếu `consumable === false` thì không giảm quantity, chỉ set `equipped: true`

### Current limitation

Mô hình hiện tại là stack-based theo `quantity`, chưa có khái niệm per-item durability.

## 2. Pet Inventory APIs Hiện Tại

### Read

- `GET /api/pet/inventory`
- controller: `backend/src/controllers/inventoryController.js`
- service: `backend/src/services/inventoryService.js`

### Use

- `POST /api/pet/inventory/use`
- controller: `backend/src/controllers/inventoryController.js`
- service: `backend/src/services/inventoryService.js`

### Related Pet action API

Inventory screen hiện tại của frontend không đi qua inventory use endpoint cho toy:

- frontend inventory page đang gọi `POST /api/pet/play`
- wrapper: `frontend/src/pet/api/petApi.js`
- page: `frontend/src/pet/pages/inventory/inventoryPage.js`

Điều này là nguyên nhân chính khiến toy hiện tại chưa được consume theo inventory model.

## 3. Shop Catalog Audit

### Source

Shop catalog nằm trong:

- `backend/scripts/seed-pet-game-config.js`

### Toy items hiện có trong `shopCatalog`

Chỉ có 2 item thuộc category `toy`:

- `ball`
- `teddy`

### Toy catalog details

#### `ball`

- `category`: `toy`
- `consumable`: `true`
- `affectsPet`: `true`
- `effects.happinessDelta`: `12`
- `effects.energyDelta`: `-4`
- `maxStack`: `20`
- `unlockLevel`: `2`

#### `teddy`

- `category`: `toy`
- `consumable`: `true`
- `affectsPet`: `true`
- `effects.happinessDelta`: `14`
- `effects.energyDelta`: `-3`
- `maxStack`: `20`
- `unlockLevel`: `3`

### Related non-toy reusable items

Các item reusable nhưng không phải toy:

- `hat`
- `cushion`

Chúng nằm ở `category: decoration` và có `consumable: false`.

### Catalog risk

Toy hiện đang được khai báo là `consumable: true`, nên backend hiện xem toy như đồ tiêu hao. Đây là điểm cần đổi ở Phase 2.

## 4. Toy Schema Hiện Tại

### Current toy schema in catalog

Toy hiện không có schema riêng. Nó chỉ là item bình thường trong `shopCatalog`:

```json
{
  "itemId": "ball",
  "category": "toy",
  "consumable": true,
  "affectsPet": true,
  "effects": {
    "happinessDelta": 12,
    "energyDelta": -4
  },
  "maxStack": 20
}
```

### Current toy schema in inventory

Khi vào inventory, toy hiện vẫn chỉ là item stack:

```json
{
  "itemId": "ball",
  "quantity": 1,
  "equipped": false,
  "updatedAt": "",
  "metadata": {}
}
```

### Conclusion

Hiện tại không có durability, maxDurability, broken state, hay instance model cho toy.

## 5. Vị Trí Phù Hợp Để Thêm Durability

### Best fit in current codebase

Durability nên được gắn ở 2 lớp:

- catalog layer để khai báo rule của từng toy
- inventory item layer để giữ trạng thái wear của từng toy

### Catalog layer đề xuất

Nên bổ sung vào `shopCatalog.items[*]` một field cấu hình durability, ví dụ:

```json
{
  "toyConfig": {
    "maxDurability": 100,
    "durabilityLossPerUse": 5,
    "repairable": true
  }
}
```

### Inventory layer đề xuất

Vì inventory hiện là stack-based, schema hợp lý hơn là per-instance toy state, không phải chỉ một số durability cho cả stack.

Đề xuất:

```json
{
  "itemId": "ball",
  "quantity": 2,
  "equipped": false,
  "updatedAt": "2026-06-22T00:00:00.000Z",
  "metadata": {},
  "toy": {
    "instances": [
      {
        "instanceId": "ball-1",
        "durability": 100,
        "maxDurability": 100,
        "status": "active"
      },
      {
        "instanceId": "ball-2",
        "durability": 100,
        "maxDurability": 100,
        "status": "active"
      }
    ]
  }
}
```

### Why this is better than a flat durability field

Một field flat như `durability: 100` trên item record chỉ phù hợp nếu mỗi toy chỉ có 1 bản.

Codebase hiện tại cho phép stack `quantity`, nên:

- một durability chung cho cả stack là khó hiểu
- durability per copy cần có instance model
- Phase 2 sẽ ít rủi ro hơn nếu inventory chuẩn bị từ sớm theo hướng instance-based

## 6. Toy Consumption Redesign

### Current behavior

Hiện tại toy bị coi là consumable:

- `consumable: true`
- quantity giảm sau khi dùng

### Proposed behavior

Toy nên là:

- `consumable: false`
- quantity không giảm khi chơi
- durability giảm thay vì quantity

### Food behavior

Food giữ nguyên mô hình hiện tại:

- `consumable: true`
- quantity giảm

## 7. Durability Design

### Recommended durability model

Mô hình nên dùng:

- toy instance có `durability`
- toy instance có `maxDurability`
- toy instance có `status`

### Suggested states

- `active`
- `broken`

### Suggested loss model

Vì codebase hiện chưa có rarity system, nên nên dùng cấu hình theo item thay vì suy ra bằng heuristic.

Khuyến nghị:

- `ball`: `-5 durability/use`
- `teddy`: `-5 durability/use`

Nếu muốn tiering trong Phase 2, có thể mở rộng thêm:

- Common: `-5/use`
- Rare: `-3/use`
- Epic: `-2/use`

Nhưng với code hiện tại, explicit per-item config là an toàn nhất.

### Break rule

Khi:

- `durability <= 0`

thì toy chuyển sang:

- `status = broken`
- không dùng được nữa

## 8. Broken Toy Design

### Broken definition

Toy hỏng không nên bị xóa khỏi inventory ngay.

Nên giữ lại để:

- người dùng thấy nó đã hỏng
- có thể repair sau này
- không mất lịch sử sở hữu

### Recommended broken state

```json
{
  "durability": 0,
  "maxDurability": 100,
  "status": "broken"
}
```

### UI note

Phase này không sửa UI, nhưng Phase 2 sau này cần có trạng thái hiển thị broken để người dùng hiểu toy không còn dùng được.

## 9. Repair System Audit

### Không triển khai ở phase này

Chỉ đánh giá kiến trúc tương lai.

### Khuyến nghị

Nên có repair hoặc restore durability trong tương lai.

Ưu tiên theo thứ tự:

- restore durability
- repair
- replacement

### Vì sao nên có repair

- giữ cảm giác gắn bó với toy
- tránh mất item progression
- phù hợp mô hình companion hơn là consumable-only

### Vì sao không nên chỉ replacement

- replacement làm toy giống đồ tiêu hao lại
- mất tính tích lũy
- phá cảm giác “chăm sóc đồ chơi”

## 10. API Flow Đề Xuất Cho Phase 2

### Recommended flow

Inventory Page
-> `POST /api/pet/inventory/use`
-> validate ownership
-> resolve item category
-> if food: consume quantity
-> if toy: apply durability loss
-> if broken: reject use
-> persist inventory
-> apply pet effects
-> return updated inventory + pet

### Why this flow fits the codebase

- `inventoryService.useItem()` đã là nơi duy nhất hiểu inventory state và catalog item config
- backend đã trả về cả inventory + pet trong response
- API hiện tại đã có sẵn endpoint consume, chỉ thiếu durability logic

### Alternative flow

Có thể giữ `POST /api/pet/play` cho free play và reserve `POST /api/pet/inventory/use` cho item-based toy use.

Đây là cách sạch hơn vì:

- play là hành vi pet
- inventory use là hành vi item

## 11. Data Migration Plan

### Goal

- không phá user hiện tại
- không mất item
- không reset quantity
- rollout dần dần

### Recommended migration strategy

#### Step 1

Update inventory normalization để preserve durability fields và toy instance payload.

#### Step 2

On read/write, nếu item là toy và chưa có durability metadata:

- set `maxDurability = 100`
- set `durability = 100`
- set `status = active`

#### Step 3

Nếu item stack có `quantity > 1`:

- expand thành multiple toy instances, hoặc
- giữ quantity là aggregate và tạo `instances[]`

Recommended:

- `instances[]` để không mất semantics khi một số copy đã mòn hơn số khác

#### Step 4

Persist lại doc theo normalize mới sau khi item được chạm vào hoặc inventory được mở.

### Migration risk

Nếu chỉ thêm field mới mà không sửa `normalizeInventoryState()`:

- durability sẽ bị rơi
- migration sẽ không bền

Nếu chỉ dùng flat durability:

- multi-copy toy sẽ không có mô hình wear đúng

## 12. Phase 2 Readiness

### Backend files likely to change

- `backend/src/repositories/inventoryRepository.js`
- `backend/src/services/inventoryService.js`
- `backend/src/services/shopService.js`
- `backend/src/controllers/inventoryController.js`
- `backend/src/services/petService.js`
- `backend/src/services/petItemEffectService.js`
- `backend/scripts/seed-pet-game-config.js`

### Frontend files likely to change

- `frontend/src/pet/pages/inventory/inventoryPage.js`
- `frontend/src/pet/services/petClient.js`
- `frontend/src/pet/api/petApi.js`
- `frontend/src/pet/api/inventoryApi.js`
- `frontend/src/pet/store/*` nếu store cần đọc durability

### API files likely to change

- `POST /api/pet/inventory/use`
- `POST /api/pet/play` nếu muốn bridge legacy toy use
- `GET /api/pet/inventory` nếu muốn trả thêm durability fields

### Why frontend changes are needed

Inventory page hiện tại đang gọi:

- `playPet()`

không phải:

- `useItem()`

Nên nếu muốn toy durability hoạt động đúng mô hình inventory, frontend inventory interaction cần đổi flow.

## 13. Technical Risks

### Risk 1

`normalizeInventoryState()` hiện sẽ loại bỏ field mới nếu chưa được update.

### Risk 2

Stack-based inventory hiện tại không tương thích tự nhiên với per-instance durability.

### Risk 3

`maxStack` trong shop hiện đang hợp với quantity-based consumable items, nhưng toy durability sẽ khiến semantics của `quantity` thay đổi.

### Risk 4

Current inventory page uses `/api/pet/play`, so durability logic sẽ không được kích hoạt nếu không đổi flow.

### Risk 5

Durability dễ làm document tăng kích thước nếu lưu instance array cho nhiều toy, nhưng với `maxStack` hiện tại thì vẫn kiểm soát được.

### Risk 6

Nếu render UI sau này không hiển thị broken/durability state, người dùng sẽ tưởng toy vẫn dùng được.

## 14. Summary

### Current state

- Inventory hiện là stack-based.
- Toy hiện đang bị định nghĩa như consumable item.
- Current inventory UI đang dùng play route, không dùng inventory consume route.

### Recommended Phase 2 direction

- Keep food consumable.
- Make toy reusable with durability.
- Preserve inventory quantity semantics by moving toward toy instances.
- Update repository normalization to preserve new fields.
- Move toy interaction to inventory use flow.

### Final conclusion

Nếu muốn durability làm đúng và bền trong codebase này, **không nên** chỉ thêm một field `durability` phẳng vào item hiện tại.

Thiết kế tốt hơn là:

- catalog-level toy durability config
- inventory-level toy instances
- backend normalization được update để bảo toàn schema mới

Đây là nền tảng phù hợp nhất cho Phase 2.
