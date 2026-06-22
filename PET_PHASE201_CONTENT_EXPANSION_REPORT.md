# PET Phase 2.01 - Shop Content Expansion Report

## Files Changed

- `backend/scripts/seed-pet-game-config.js`
- `frontend/src/pet/pages/shop/shopPage.js`

## New Items Added

### Food

- `biscuit`
- `milk`
- `apple`
- `banhChung`
- `banhGiay`
- `xoiGac`
- `cheSen`

### Toy

- `ball`
- `teddy`
- `kite`
- `pinwheel`
- `drum`
- `lantern`
- `toHe`
- `paperMask`

### Medicine

- `bandage`
- `vitamin`
- `herbalTea`
- `lotusMedicine`
- `firstAidKit`

## Shop Category Changes

Shop UI hiện chỉ còn 3 tab:

- `food` -> `Thức ăn`
- `toy` -> `Đồ chơi`
- `medicine` -> `Thuốc`

Đã thực hiện:

- Whitelist category order trong frontend shop page.
- Filter bỏ toàn bộ category ngoài 3 nhóm trên.
- Không render tab rỗng.
- Không tạo category mới.

Kết quả:

- Không còn `decoration`.
- Không còn `special`.

## Asset Mapping Verification

Tất cả item mới trong seed config đều dùng asset path tuyệt đối đúng chuẩn:

- `assets/pet/shop/food/*`
- `assets/pet/shop/toy/*`
- `assets/pet/shop/medicine/*`

Các item được map như sau:

- Food:
  - `biscuit` -> `/assets/pet/shop/food/biscuit.png`
  - `milk` -> `/assets/pet/shop/food/milk.png`
  - `apple` -> `/assets/pet/shop/food/apple.png`
  - `banhChung` -> `/assets/pet/shop/food/banh-chung.png`
  - `banhGiay` -> `/assets/pet/shop/food/banh-giay.png`
  - `xoiGac` -> `/assets/pet/shop/food/xoi-gac.png`
  - `cheSen` -> `/assets/pet/shop/food/che-sen.png`
- Toy:
  - `ball` -> `/assets/pet/shop/toy/ball.png`
  - `teddy` -> `/assets/pet/shop/toy/teddy.png`
  - `kite` -> `/assets/pet/shop/toy/kite.png`
  - `pinwheel` -> `/assets/pet/shop/toy/pinwheel.png`
  - `drum` -> `/assets/pet/shop/toy/drum.png`
  - `lantern` -> `/assets/pet/shop/toy/lantern.png`
  - `toHe` -> `/assets/pet/shop/toy/to-he.png`
  - `paperMask` -> `/assets/pet/shop/toy/paper-mask.png`
- Medicine:
  - `bandage` -> `/assets/pet/shop/medicine/bandage.png`
  - `vitamin` -> `/assets/pet/shop/medicine/vitamin.png`
  - `herbalTea` -> `/assets/pet/shop/medicine/herbal-tea.png`
  - `lotusMedicine` -> `/assets/pet/shop/medicine/lotus-medicine.png`
  - `firstAidKit` -> `/assets/pet/shop/medicine/first-aid-kit.png`

## Validation Results

### Static validation

- `node --check backend/scripts/seed-pet-game-config.js`: passed
- `node --check frontend/src/pet/pages/shop/shopPage.js`: passed
- `node --check frontend/src/pet/utils/assetResolver.js`: passed

### Frontend build

- `npm run build` trong frontend: passed

### Code-path validation

- Shop page chỉ còn whitelist 3 category.
- `resolveItemIconPath()` vẫn nhận được asset path tuyệt đối trực tiếp từ `icon`.
- Toy durability logic không bị đổi.
- Inventory architecture không bị đổi.
- API contract không bị đổi.

## Remaining Issues

- Backend runtime end-to-end trong môi trường audit này chưa được chạy bằng Firebase credentials thật.
- Đây là giới hạn môi trường, không phải lỗi gameplay.

## Final Verdict

### Shop hiện còn bao nhiêu item?

- `20` item.

### Chỉ còn đúng 3 tab chưa?

- Có.

### Các item mới có hoạt động đầy đủ không?

- Ở mức code/config và frontend wiring: có.
- Mỗi item đều có category, price, effects, và asset path đúng.

### Có phát sinh regression không?

- Không thấy regression ở:
  - toy durability
  - inventory consumption
  - shop buy flow
  - API contract

### Kết luận chung

- Shop đã được mở rộng đúng hướng.
- Nội dung mới phù hợp chủ đề Việt Nam.
- UI vẫn giữ layout cũ, chỉ rút gọn category và cập nhật catalog.

