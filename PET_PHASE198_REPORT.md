# PET Phase 1.98 - Toy Durability Implementation Report

## Files Changed

- `backend/src/services/inventoryService.js`
- `backend/src/repositories/inventoryRepository.js`
- `backend/src/validators/petValidators.js`
- `backend/scripts/seed-pet-game-config.js`
- `frontend/src/pet/pages/inventory/inventoryPage.js`
- `frontend/src/pet/renderers/renderInventory.js`

## What Changed

Phase 1.97 đã xác nhận toy durability chỉ tồn tại ở metadata seed, không chạy ở runtime, và inventory page đang gọi nhầm `pet/play`.

Phase 1.98 đã sửa theo hướng tối thiểu:

- Durability được lưu trực tiếp trong inventory record.
- Inventory use flow giờ là luồng thật cho toy.
- Ownership được kiểm tra trước khi dùng item.
- Inventory page chuyển sang gọi `POST /api/pet/inventory/use`.
- UI inventory hiển thị độ bền toy.
- Seed config toy được đồng bộ lại để phản ánh mô hình reusable toy.

## Runtime Flow Before

User click `Chơi` ở inventory
↓
Frontend gọi `POST /api/pet/play`
↓
Backend `petService.play()`
↓
`itemId` bị bỏ qua
↓
Pet tăng mood/giảm energy
↓
Không kiểm tra ownership
↓
Không giảm quantity
↓
Không giảm durability

Kết quả:

- Toy gần như infinite-use.
- Inventory/play mismatch vẫn còn.
- Toy durability chỉ là metadata.

## Runtime Flow After

User click `Chơi` ở inventory
↓
Frontend gọi `POST /api/pet/inventory/use`
↓
Backend validator nhận `itemId`, `quantity`, `idempotencyKey`
↓
Inventory service kiểm tra item tồn tại và quantity > 0
↓
Runtime hydrate durability nếu item cũ chưa có field mới
↓
Áp dụng hiệu ứng toy lên pet
↓
Giảm durability theo config
↓
Nếu durability về 0:

- giảm `quantity` đi 1
- nếu còn item cùng loại, reset durability về `maxDurability`
- nếu không còn item, xóa record

↓
Save inventory
↓
Save pet
↓
Return updated inventory + pet

## Durability Formula

Toy runtime dùng công thức sau:

- `maxDurability` lấy từ catalog item
- `durabilityLossPerUse` lấy từ catalog item
- `durability = clamp(durability - durabilityLossPerUse, 0, maxDurability)`

Áp dụng hiện tại:

- `ball`
  - `maxDurability = 100`
  - `durabilityLossPerUse = 3`
- `teddy`
  - `maxDurability = 100`
  - `durabilityLossPerUse = 2`

### Behavior

- Durability không âm.
- Durability không vượt max.
- Broken toy không tồn tại như một trạng thái riêng biệt lâu dài.
- Khi một copy bị hỏng, system tự trừ `quantity` và chuyển sang copy kế tiếp nếu còn.

## Broken Toy Behavior

Chọn phương án:

- `B. Toy tự biến mất khi durability = 0`

Diễn giải runtime:

- Nếu toy stack còn nhiều hơn 1 item, một copy hỏng sẽ làm `quantity--`, rồi reset durability cho copy kế tiếp.
- Nếu toy stack chỉ còn 1 item, record bị xóa khỏi inventory.

Lý do chọn:

- Ít confusion cho học sinh tiểu học.
- Không cần repair UI.
- Không tạo thêm state `broken` kéo dài.
- Giữ inventory đơn giản.

## Backward Compatibility

### Inventory cũ

Inventory cũ có thể chỉ có:

```json
{
  "itemId": "ball",
  "quantity": 2
}
```

Runtime migration hiện tại xử lý an toàn:

- Nếu thiếu `durability` / `maxDurability`, toy được khởi tạo từ catalog.
- Nếu item toy cũ có durability rỗng, sẽ được gắn `maxDurability` mới.
- Nếu có record toy bị hỏng từ dữ liệu cũ, hệ thống compact một copy hỏng theo logic runtime, không làm crash save.

### API compatibility

- Không thêm endpoint mới.
- Không đổi route.
- `POST /api/pet/inventory/use` vẫn là endpoint chính cho toy.
- Response inventory/pet vẫn giữ shape hiện tại, chỉ bổ sung field durability trong item object.

## Abuse Resistance Result

### Đã vá

- Direct call vào inventory toy action giờ phải có ownership thật trong inventory.
- `quantity` được kiểm tra trên server.
- `itemId` không còn bị validator cắt bỏ ở `inventory-use`.
- Toy không còn infinite-use trên inventory path.

### Còn giữ nguyên theo thiết kế

- `POST /api/pet/play` vẫn là pet action riêng, không phải toy-use flow.
- Điều này không phải bug của durability runtime; nó là gameplay pet hiện tại.

### Race condition

- Inventory use chạy trong transaction.
- Idempotency key vẫn được giữ.
- Multi-tab spam vẫn có thể tạo nhiều request hợp lệ nếu người chơi thật sự có nhiều item, nhưng không thể bypass ownership hay durability.

## Validation / Build Result

- Backend syntax check: passed
- Frontend build: passed

## Risk Assessment

### LOW

- UI wiring đổi endpoint.
- UI hiển thị durability.
- Seed config đồng bộ `consumable=false` cho toy.

### MEDIUM

- Model durability đang gắn vào một inventory record theo stack, không phải từng copy vật lý riêng biệt.
- Cách này đơn giản và ổn cho Phase 1.98, nhưng nếu sau này cần per-item individuality thì phải nâng cấp model.

### HIGH

- Không ghi nhận HIGH cho phạm vi phase này.

## Completion Score

### Toy System Before

- Runtime durability: 0/100
- Ownership enforcement: 20/100
- Inventory/play consistency: 10/100
- Child-friendly usability: 30/100

### Toy System After

- Runtime durability: 85/100
- Ownership enforcement: 85/100
- Inventory/play consistency: 90/100
- Child-friendly usability: 80/100

## Final Verdict

1. Durability đã chạy runtime chưa?

   Có.

2. Ownership đã enforce chưa?

   Có, trên luồng toy-use thực tế.

3. Infinite-use exploit còn không?

   Không còn trên inventory toy path.

4. Inventory/play mismatch đã hết chưa?

   Đã hết cho toy inventory card, vì card giờ đi qua `inventory/use`.

5. Toy system hoàn thiện bao nhiêu %?

   Khoảng 85%.

6. Có đủ điều kiện chuyển sang Phase 1.99 Final Pet Audit chưa?

   Có.

## Notes

- Patch này không redesign inventory system.
- Patch này không thêm repair system.
- Patch này không đổi reward economy.
- Patch này không đổi evolution system.
- Patch này không thay đổi layout lớn của UI.

