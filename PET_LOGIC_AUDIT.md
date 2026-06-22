# PET LOGIC AUDIT

Tài liệu này mô tả logic hiện tại của module Pet theo đúng trạng thái code trong workspace, không refactor và không thay đổi hành vi.

Phạm vi đọc:
- Frontend: `frontend/src/pet/**`
- Backend: `backend/src/**` liên quan Pet, Shop, Inventory, Reward và config game
- Seed/config: `backend/scripts/seed-pet-game-config.js`

## 1. Tổng Quan Kiến Trúc

### Nguồn dữ liệu Pet

- Dữ liệu Pet thật nằm ở Firestore trong `users/{uid}/pet/state`.
- Cấu hình gameplay nằm ở Firestore `gameConfig/{petBalance, levelConfig, evolutionConfig, shopCatalog, rewardConfig}`.
- Inventory nằm ở `users/{uid}/inventory/state`.
- Coin và các chỉ số user liên quan nằm ở `users/{uid}.stats`.
- Reward đã nhận được ghi ở `rewardLedger`.
- Request idempotency của Pet, Inventory, Shop nằm ở các subcollection request/transaction tương ứng.

### State nằm ở đâu

- Global state frontend nằm trong `frontend/src/pet/store/petStore.js`.
- Local state nằm trong từng page closure:
  - `choosePetPage`
  - `homePetPage`
  - `feedPage`
  - `inventoryPage`
  - `shopPage`
- Backend là state authority. Frontend chỉ cache và render snapshot.

### Flow backend -> frontend

```text
User Action
↓
Page handler / petClient wrapper
↓
API call
↓
Backend service + Firestore transaction
↓
Success response { data, popupEvents, animationEvents, requestId, meta }
↓
petStore.applyBackendResponse()
↓
STATE_UPDATED subscribers + feedbackManager
↓
Page render + UI update
```

### Flow cập nhật sau mỗi hành động

- `petClient` bọc action bằng `wrapAction`.
- Trước khi gọi API, store được set loading flag.
- Sau khi API trả về, `petStore.applyBackendResponse()`:
  - normalize response
  - cập nhật `pet`, `inventory`, `shop`, `wallet`
  - cập nhật `popupQueue`, `animationEvents`, `lastResponse`, `serverTime`, `requestId`
  - phát `STATE_UPDATED`
- `renderAll()` render các renderer tổng quát.
- `feedbackManager` đọc `popupQueue`, `lastResponse`, `animationEvents` để dựng popup/toast/float/pulse.

### Điểm quan trọng

- Không có polling, websocket, SSE, hay hook React.
- Trạng thái Pet được sync theo kiểu request-response.
- `GET /api/pet` không chỉ đọc mà còn có thể ghi lại state sau khi áp dụng offline decay.

## 2. Home Page Logic

File chính:
- `frontend/src/pet/pages/homePet/homePetPage.js`

### Dữ liệu đang hiển thị

- Ảnh pet chính.
- Tên pet.
- Mood badge.
- Level chip.
- Coin chip.
- Thanh EXP và text `current / required`.
- 4 stat:
  - Hunger
  - Happiness
  - Energy
  - Health
- Bubble thông báo.
- Tip “chạm vào pet”.
- Nút `Cửa hàng`.
- Nút `Cho ăn` và `Túi đồ`.
- Error panel.
- Skeleton khi chưa có dữ liệu.

### Mood lấy từ đâu

- Từ `snapshot.pet.mood`.
- `mood` được backend tính bởi `calculateMood()` trong `backend/src/services/petMathService.js`.
- Quy tắc:
  - `health <= sickThreshold` -> `sick`
  - `energy <= sleepyThreshold` -> `sleepy`
  - `hunger <= hungryThreshold` -> `hungry`
  - `happiness <= sadThreshold` -> `sad`
  - nếu tất cả chỉ số đủ cao -> `happy`
  - còn lại -> `normal`

### EXP lấy từ đâu

- Từ `snapshot.pet.exp`.
- `requiredExpToNextLevel` cũng do backend trả về.
- EXP thực tế là phần exp còn lại sau khi backend chạy `calculateLevelState()`.

### Coin lấy từ đâu

- Từ `snapshot.wallet.eduCoin`.
- `wallet` chỉ được set khi response backend có `data.wallet`.
- Các response Pet thuần túy như `GET /api/pet`, `feed`, `play`, `sleep`, `select` không trả wallet.
- Vì vậy coin trên Home có thể là `0`/stale nếu chưa có response shop/reward cập nhật wallet.

### Bubble lấy từ đâu

- Bubble inline của Home không lấy trực tiếp từ store.
- Nó lấy từ:
  - `response.popupEvents[0].message`
  - hoặc `response.message`
- Bubble này là state local, tự tắt sau timeout.

### Trạng thái lấy từ đâu

- Home page xem `store.getState()`:
  - `pet`
  - `hasPet`
  - `wallet`
  - `loading`
  - `error`
- Nếu `hasPet === false` và không có pet, page chuyển sang màn chọn pet.

### Pet ngủ được xác định thế nào

- Không có field `isSleeping` riêng.
- “Ngủ” là mood `sleepy`.
- Mood `sleepy` xuất hiện khi `energy <= sleepyThreshold` ở backend.
- Trên UI:
  - ảnh pet đổi theo asset `sleepy`
  - CSS thêm `Zzz`
  - pet sway animation

### Pet tỉnh được xác định thế nào

- Không có state “awake” riêng.
- Pet được coi là “tỉnh” khi mood không phải `sleepy`.
- Nếu mood là `normal`, `happy`, `hungry`, `sad`, `sick` thì vẫn là một pet đang hoạt động, chỉ khác trạng thái cảm xúc/chỉ số.

### Có animation nào

- Có.
- JS:
  - `animateNumberText()` cho level, coin, stats, EXP
  - bubble show/hide transition
  - tap / flash / cheer class toggle
- CSS:
  - breathe, float, bounce, shimmer, Zzz, progress pop

### Có timer nào

- Bubble Home tự tắt sau `3200ms`.
- Loading action bị khóa trong lúc request đang chạy.
- UI loading overlay được bật/tắt theo `store.loading`.

## 3. Feed Logic

Files chính:
- `frontend/src/pet/pages/feed/feedPage.js`
- `backend/src/services/petService.js`
- `backend/src/services/inventoryService.js`

### Khi user bấm Cho ăn

Có 2 nhánh:

1. Bấm từ Home:
- Home page không cho ăn trực tiếp.
- Nút `Cho ăn` chỉ phát `edukids:pet:feed-requested` để chuyển sang feed page.

2. Bấm vào item food trong Feed page:
- Frontend gọi `petApi.feedPet({ itemId, idempotencyKey })`
- Backend `petService.feed()` thấy có `itemId` nên chuyển sang `inventoryService.useItem()`

### API nào được gọi

- `POST /api/pet/feed`

### Payload gửi gì

- `itemId`
- `idempotencyKey`

### Backend xử lý

- `petService.feed()`:
  - nếu có `itemId` -> `inventoryService.useItem()`
  - nếu không có `itemId` -> `mutatePetAction("feed")`
- `inventoryService.useItem()`:
  - đọc `shopCatalog`
  - lấy item config theo `itemId`
  - trừ inventory nếu item là consumable
  - nếu `affectsPet !== false` thì apply effects lên pet
  - lưu inventory và pet

### Response trả về gì

- `data.inventory`
- `data.pet` nếu pet được cập nhật
- `popupEvents` với type `ITEM_USE`
- `meta.itemId`, `meta.quantity`, `meta.targetPetId`

### UI cập nhật như thế nào

- Store nhận response qua `applyBackendResponse()`
- Feed page:
  - cập nhật catalog quantity theo `response.data.inventory.categories.foods`
  - hiện bubble từ response message/popup message
  - chạy FX bay từ card vào pet
  - bounce pet
- Global feedbackManager cũng nhận `popupEvents`

### Nếu không có item

- Trên Feed page, card bị disable nếu quantity = 0.
- Nếu backend nhận `feed` không có `itemId`, nó chạy nhánh direct action:
  - không đụng inventory
  - chỉ áp dụng config `petBalance.actions.feed`

## 4. Inventory Logic

Files chính:
- `frontend/src/pet/pages/inventory/inventoryPage.js`
- `backend/src/services/inventoryService.js`
- `backend/src/repositories/inventoryRepository.js`

### Khi user sử dụng đồ chơi

- UI đang hiển thị các item từ `inventory.categories.toys`.
- Khi bấm `Chơi`, frontend hiện tại gọi `petApi.playPet({ itemId, idempotencyKey })`.
- Backend `petService.play()` không dùng `itemId`, chỉ chạy `mutatePetAction("play")`.

### API nào được gọi

- Frontend hiện tại gọi `POST /api/pet/play`.

### Payload

- `itemId`
- `idempotencyKey`

### Response

- `data.pet`
- `data.inventory` không đổi trong nhánh play thường
- `popupEvents` type `PLAY_SUCCESS`

### Cập nhật UI

- Store update làm UI đổi pet, mood, stats, coin nếu có
- Inventory page hiển thị bubble và bounce
- Nhưng quantity item trong inventory **không bị trừ** vì backend play không consume item

### Có cooldown không

- Có, nhưng là cooldown của action `play` trên backend.
- `petBalance.actions.play.cooldownSeconds = 300`

### Có điều kiện gì không

- Backend chặn nếu:
  - energy quá thấp hơn ngưỡng cho phép
  - action đang trong cooldown

### Lưu ý nghiệp vụ

- Đây là một điểm lệch logic:
  - UI coi item như đồ chơi để “dùng”
  - Backend lại coi đó là một lượt play pet thuần túy
  - Inventory không giảm

## 5. Shop Logic

Files chính:
- `frontend/src/pet/pages/shop/shopPage.js`
- `backend/src/services/shopService.js`
- `backend/src/repositories/shopRepository.js`
- `backend/scripts/seed-pet-game-config.js`

### Danh sách sản phẩm lấy từ đâu

- Từ Firestore `gameConfig/shopCatalog`.
- `shopService.getShop()` đọc config này, map thành `items`.

### Giá lấy từ đâu

- Từ `shopCatalog.items[*].price`.

### Coin lấy từ đâu

- Backend mua hàng lấy coin từ `user.stats.eduCoin`.
- Frontend hiển thị coin từ `snapshot.wallet.eduCoin`.

### Khi bấm mua

- Frontend gọi `shopApi.buyItem({ itemId, idempotencyKey })`
- API:
  - `POST /api/shop/buy`

### Backend xử lý

- Đọc `shopCatalog`
- Kiểm tra item tồn tại
- Kiểm tra unlock level
- Kiểm tra inventory stack
- Kiểm tra coin balance
- Trừ coin khỏi `user.stats.eduCoin`
- Cộng vào `user.stats.totalEduCoinSpent`
- Thêm item vào inventory

### Response

- `data.inventory`
- `data.wallet.eduCoin`
- `data.item`
- `popupEvents` type `SHOP_BUY_SUCCESS`

### Sau khi mua

- Coin cập nhật:
  - backend trả wallet mới
  - `petStore.applyBackendResponse()` ghi vào `state.wallet`
  - Shop/Home/Stats render từ wallet đó
- Inventory cập nhật:
  - backend trả inventory mới
  - page rerender theo inventory mới

### Danh mục shop hiện có trong seed config

| Item | Category | Price | Consumable | Affects Pet |
|---|---:|---:|---:|---:|
| biscuit | food | 5 | yes | yes |
| milk | food | 8 | yes | yes |
| apple | food | 6 | yes | yes |
| carrot | food | 6 | yes | yes |
| ball | toy | 12 | yes | yes |
| teddy | toy | 15 | yes | yes |
| vitamin | medicine | 18 | yes | yes |
| medicineKit | medicine | 28 | yes | yes |
| hat | decoration | 20 | no | yes |
| cushion | decoration | 25 | no | yes |
| eventPass | special | 40 | yes | no |

## 6. Pet Stats

### Toàn bộ stat hiện có

| Stat | Ý nghĩa | Hiển thị ở đâu | Nguồn dữ liệu |
|---|---|---|---|
| hunger | Độ no | Home, Feed, Inventory, Shop | `pet.hunger` từ backend |
| happiness | Hạnh phúc | Home, Feed, Inventory, Shop | `pet.happiness` từ backend |
| energy | Năng lượng | Home, Feed, Inventory, Shop | `pet.energy` từ backend |
| health | Sức khỏe | Home | `pet.health` từ backend |
| mood | Mood hiện tại | Home, Feed, Inventory, Shop | backend derive từ hunger/happiness/energy/health |
| level | Cấp độ pet | Home, compact renderers | backend derive từ exp |
| exp | EXP còn lại trong level hiện tại | Home, compact renderers | backend derive từ total exp |
| requiredExpToNextLevel | EXP cần để lên cấp tiếp | Home | backend derive từ level config |
| stage | Stage tiến hóa | Ảnh pet, asset resolver | backend derive từ evolution config |
| wallet.eduCoin | Coin người dùng | Home, Feed, Inventory, Shop | backend trả qua `data.wallet` |
| inventory summary.totalQuantity | Tổng item trong kho | Compact renderer | inventory service summary |

### Giải thích từng stat

- `hunger`, `happiness`, `energy`, `health` là bộ stat lõi của Pet.
- `mood` là trạng thái derived, ảnh hưởng trực tiếp tới asset và animation.
- `level` và `exp` không phải input thô từ client, mà là kết quả của `calculateLevelState()`.
- `stage` quyết định asset theo level và điều kiện health/happiness/hunger.

## 7. Pet Level / EXP

### Level lấy từ đâu

- Từ `calculateLevelState(exp, levelConfig)` ở backend.
- `levelConfig` được seed từ `backend/scripts/seed-pet-game-config.js`.

### EXP lấy từ đâu

- Từ tổng EXP đang tích lũy của pet/user, sau đó backend quy đổi sang:
  - `level`
  - `exp` còn lại trong level hiện tại
  - `requiredExpToNextLevel`

### Có tính toán ở frontend không

- Không.
- Frontend chỉ hiển thị dữ liệu backend trả về.

### Có thanh tiến trình không

- Có.
- Home page hiển thị thanh EXP.
- Compact renderer `renderStats()` chỉ render text, không có progress bar.

### Có level-up animation không

- Có ở `feedbackManager`.
- Khi `currentLevel > previousLevel`, nó tự dựng popup `LEVEL_UP` nếu backend không gửi sẵn event đó.

### Công thức level hiện tại

- `curveType = quadratic`
- `baseExp = 80`
- `linearStep = 35`
- `quadraticFactor = 0.8`
- `levelCap = 100`

## 8. Reward System

### Frontend hiện đang nhận reward nào

Frontend Pet hiện có thể render các reward sau thông qua `feedbackManager`:

- Coin
- EXP
- Pet happiness
- Pet energy
- Pet health
- Pet hunger
- Badges

### Reward đến từ API nào

- Frontend adapter có các endpoint:
  - `POST /api/rewards/lesson-complete`
  - `POST /api/rewards/learning-path`
  - `POST /api/rewards/assignment`
  - `POST /api/rewards/high-score`
  - `POST /api/rewards/learning-streak`
  - `POST /api/rewards/daily-login`

### Hiện trạng route

- Trong `backend/src/server.js` hiện không thấy mount route `/api/rewards`.
- Vì vậy các endpoint này đang là adapter phía frontend nhưng không có route được đăng ký trong server hiện tại.

### Backend reward engine đang làm gì

- `backend/src/services/rewardService.js`:
  - đọc `rewardConfig`
  - cộng coin vào `user.stats.eduCoin`
  - cộng `totalEduCoinEarned`
  - nếu có pet thì cộng pet exp/happiness/health/energy/hunger
  - lưu `rewardLedger`

### Reward config hiện có

| Rule | Coin | Pet EXP | Happiness | Ghi chú |
|---|---:|---:|---:|---|
| lessonComplete | 5 | 3 | 2 | Hoàn thành bài học |
| learningPath | 20 | 10 | 5 | Hoàn thành learning path |
| assignment | 10 | 5 | 3 | Hoàn thành bài tập |
| highScore | 10 | 5 | 4 | Có `minScore = 9` |
| dailyLogin | 3 | 1 | 1 | Đăng nhập hằng ngày |

### Hiển thị ở đâu

- Nếu response reward được đẩy vào `petStore`, `feedbackManager` sẽ:
  - render popup reward
  - render float labels cho coin/EXP/badges
  - pulse coin và stat bars

### Ghi chú

- Reward service hiện được dùng chủ yếu từ auth, quiz, assignment, learning path backend.
- Module Pet chỉ có wiring frontend cho reward, nhưng trong Pet pages hiện tại không có luồng gọi thực tế nào đã thấy trong repo.

## 9. Pet Types

### Pet hiện có trong frontend asset manifest

| Pet | Asset | Background | Animation | Logic riêng |
|---|---|---|---|---|
| horse | Có 5 level folders x 6 mood images | `pet-bg-horse.png` và `pet-bg-horse-small.png` | CSS float/breathe/bounce theo mood | Không có logic riêng |
| elephant | Có 5 level folders x 6 mood images | `pet-bg-elephant.png` và `pet-bg-elephant-small.png` | CSS float/breathe/bounce theo mood | Không có logic riêng |

### Pet được backend cho phép

- `horse`
- `elephant`
- `cat`
- `dog`

### Chênh lệch hiện tại

- Backend `evolutionConfig.petTypes` cho phép `cat` và `dog`.
- Frontend `petAssetManifest` và `choosePetPage` hiện chỉ có `horse` và `elephant`.
- Nghĩa là `cat` và `dog` hợp lệ ở backend nhưng chưa có luồng chọn/asset phía frontend trong repo hiện tại.

## 10. State Management

### Context / Reducer / Store / Hook

- `Context`: không dùng.
- `Reducer`: không dùng.
- `Hook`: không dùng.
- `Store`: có, là `petStore` custom.

### Global state

`petStore` giữ:
- `pet`
- `inventory`
- `shop`
- `wallet`
- `loading`
- `loadingFlags`
- `hasPet`
- `popupQueue`
- `error`
- `serverTime`
- `lastResponse`
- `animationEvents`
- `requestId`

### Local state

Mỗi page có state local riêng:
- `choosePetPage`: selected pet, loading, visible, modal flow
- `homePetPage`: bubble timer, loading action, last exp/coin/stat values
- `feedPage`: catalog, loadingCatalog, loadingItemId, fx timers
- `inventoryPage`: items, loadingInventory, playingItemId, fx timers
- `shopPage`: items, categories, selectedCategory, buyingItemId, toast timers

### Event flow trong store

- `STATE_UPDATED`: tất cả page render từ đây
- `LOADING_CHANGED`: internal loading state changed
- `ERROR_CHANGED`: error state changed
- `PET_UPDATED`: pet response applied
- `INVENTORY_UPDATED`: emitted nhưng hiện không có listener trong repo
- `SHOP_UPDATED`: emitted nhưng hiện không có listener trong repo
- `POPUP`: emitted nhưng hiện không có listener riêng ngoài feedbackManager đọc STATE_UPDATED

## 11. API Inventory

### Endpoint đang dùng thực tế

| Method | Endpoint | Chức năng | Request | Response |
|---|---|---|---|---|
| GET | `/api/pet` | Lấy pet hiện tại và sync offline decay | không body, chỉ auth header | `pet`, `hasPet`, `derivedState`, `sync` |
| POST | `/api/pet/select` | Chọn pet lần đầu | `petTypeId`, `petName` | `pet`, `hasPet`, popup `PET_SELECTED`, animation `PET_SELECTED` |
| POST | `/api/pet/feed` | Cho ăn bằng item hoặc direct feed | `itemId` tùy nhánh, `idempotencyKey` | `inventory`, `pet`, popup `FEED_SUCCESS` hoặc `ITEM_USE` |
| POST | `/api/pet/play` | Chơi với pet | `idempotencyKey`, frontend inventory page còn gửi `itemId` nhưng backend bỏ qua | `pet`, popup `PLAY_SUCCESS` |
| POST | `/api/pet/sleep` | Cho pet ngủ | `idempotencyKey` | `pet`, popup `SLEEP_SUCCESS` |
| GET | `/api/pet/inventory` | Lấy inventory | auth only | `inventory.categories`, `summary`, `version`, `updatedAt` |
| POST | `/api/pet/inventory/use` | Dùng item trong inventory | `itemId`, `quantity`, `targetPetId`, `idempotencyKey` | `inventory`, `pet` nếu item ảnh hưởng pet, popup `ITEM_USE` |
| GET | `/api/shop` | Lấy shop catalog | auth only | `items`, `userLevel`, `currency` |
| POST | `/api/shop/buy` | Mua item | `itemId`, `quantity`, `idempotencyKey` | `inventory`, `wallet`, `item`, popup `SHOP_BUY_SUCCESS` |

### Endpoint adapter có nhưng backend chưa mount

| Method | Endpoint | Trạng thái |
|---|---|---|
| POST | `/api/rewards/lesson-complete` | Adapter frontend có, server không thấy route mount |
| POST | `/api/rewards/learning-path` | Adapter frontend có, server không thấy route mount |
| POST | `/api/rewards/assignment` | Adapter frontend có, server không thấy route mount |
| POST | `/api/rewards/high-score` | Adapter frontend có, server không thấy route mount |
| POST | `/api/rewards/learning-streak` | Adapter frontend có, server không thấy route mount |
| POST | `/api/rewards/daily-login` | Adapter frontend có, server không thấy route mount |

### Response shape chuẩn

- Backend Pet/Shop/Inventory/Reward dùng `buildSuccessResponse()`
- Dạng chung:
  - `success`
  - `message`
  - `data`
  - `popupEvents`
  - `animationEvents`
  - `serverTime`
  - `requestId`
  - `meta`

## 12. Frontend VS Backend

| Frontend đang xử lý gì | Backend đang xử lý gì |
|---|---|
| Vẽ UI page, card, bubble, toast, skeleton, modal | Lưu state thật trong Firestore |
| Chọn route Pet page và show/hide màn | Verify token, validate uid, role student |
| Asset resolution, icon mapping, fallback UI | Validate config shape, item config, cooldown, unlock level |
| Local animation, timer, transitions | Offline decay, level calc, evolution stage, mood calc |
| Merge inventory với shop catalog để hiển thị feed page | Inventory mutation, shop purchase, reward ledger |
| Hiển thị coin/EXP/stat từ snapshot | Tính `level`, `exp`, `requiredExpToNextLevel`, `derivedState` |
| Hiển thị popup/toast/fx theo response | Sinh `popupEvents` và `animationEvents` |
| Đọc store và render lại khi `STATE_UPDATED` | Source of truth |

## 13. File Map

### Frontend

- `frontend/src/pet/index.js` -> bootstrap module, wire store/API/page/renderers, expose `window.EduKidsPet`
- `frontend/src/pet/store/petStore.js` -> global state, normalize backend response, event bus
- `frontend/src/pet/services/petClient.js` -> wrapper action + loading/error
- `frontend/src/pet/api/petApi.js` -> `/api/pet/*`
- `frontend/src/pet/api/inventoryApi.js` -> `/api/pet/inventory*`
- `frontend/src/pet/api/shopApi.js` -> `/api/shop*`
- `frontend/src/pet/api/rewardApi.js` -> `/api/rewards/*`
- `frontend/src/pet/utils/assetResolver.js` -> resolve pet/background/item assets, audit manifest
- `frontend/src/pet/ui/feedbackManager.js` -> popup/toast/float/pulse engine
- `frontend/src/pet/ui/modal.js` -> confirm modal cho chọn pet
- `frontend/src/pet/ui/loadingOverlay.js` -> overlay loading
- `frontend/src/pet/ui/errorView.js` -> error banner
- `frontend/src/pet/pages/choosePet/choosePetPage.js` -> chọn pet
- `frontend/src/pet/pages/homePet/homePetPage.js` -> home dashboard
- `frontend/src/pet/pages/feed/feedPage.js` -> feed page + food catalog
- `frontend/src/pet/pages/inventory/inventoryPage.js` -> toy inventory page
- `frontend/src/pet/pages/shop/shopPage.js` -> shop page
- `frontend/src/pet/renderers/renderPet.js` -> renderer compact pet
- `frontend/src/pet/renderers/renderStats.js` -> renderer compact stats
- `frontend/src/pet/renderers/renderInventory.js` -> renderer compact inventory
- `frontend/src/pet/renderers/renderShop.js` -> renderer compact shop
- `frontend/src/pet/renderers/renderLoading.js` -> renderer loading state

### Backend

- `backend/src/services/petService.js` -> core pet gameplay
- `backend/src/services/petOfflineService.js` -> offline decay
- `backend/src/services/petMathService.js` -> mood, level, stage, clamping
- `backend/src/services/petItemEffectService.js` -> item effect apply to pet
- `backend/src/services/inventoryService.js` -> inventory mutation and item use
- `backend/src/services/shopService.js` -> shop catalog and purchase
- `backend/src/services/rewardService.js` -> reward engine
- `backend/src/repositories/petRepository.js` -> pet state persistence
- `backend/src/repositories/inventoryRepository.js` -> inventory persistence
- `backend/src/repositories/shopRepository.js` -> shop transactions
- `backend/src/repositories/rewardRepository.js` -> reward ledger
- `backend/src/repositories/gameConfigRepository.js` -> config docs
- `backend/src/constants/petConstants.js` -> action/error constants
- `backend/src/validators/petValidators.js` -> request validation
- `backend/src/routes/petRoutes.js` -> `/api/pet/*`
- `backend/src/routes/shopRoutes.js` -> `/api/shop/*`
- `backend/src/server.js` -> route mount, Pet entry point

### Seed/config

- `backend/scripts/seed-pet-game-config.js` -> nguồn cấu hình runtime cho petBalance, levelConfig, evolutionConfig, shopCatalog, rewardConfig

## 14. Improvement Notes

- `POST /api/rewards/*` được frontend khai báo nhưng backend hiện không mount route. Đây là lệch lớn giữa client adapter và server.
- `inventoryPage` đang gọi `petApi.playPet()` thay vì `inventoryApi.useItem()`, nên item toy không bị trừ khỏi inventory.
- `setBodyActive()` trong các page hiện là no-op, nhưng code vẫn kiểm tra `document.body.classList.contains("pet-feed-active")` và `pet-inventory-active`. Hai điều kiện này hiện không bao giờ được set trong repo.
- `petStore` có emit `INVENTORY_UPDATED`, `SHOP_UPDATED`, `POPUP`, nhưng repo hiện không có listener rõ ràng cho các event này.
- `derivedState` backend trả về nhưng frontend Pet hiện không dùng.
- Coin ở Home phụ thuộc `snapshot.wallet`, trong khi `GET /api/pet` không trả wallet. Nếu chưa có response shop/reward trước đó, coin có thể không phản ánh user stats mới nhất.
- `PET_ERROR_CODES` thiếu nhiều code đang được service dùng như `ITEM_NOT_FOUND`, `SHOP_ITEM_LOCKED`, `NOT_ENOUGH_COIN`, `ITEM_OUT_OF_STOCK`, `INSUFFICIENT_ITEM_QUANTITY`. Khi ném lỗi, chúng dễ rơi về `INTERNAL_ERROR` ở response chuẩn.
- `cat` và `dog` đã được backend cho phép, nhưng frontend asset manifest và màn chọn pet hiện chỉ có `horse` và `elephant`.
- `resolvePetAssetPath()` có fallback khá mơ hồ khi thiếu asset; audit manifest cũng đã báo thiếu global default.
- `GET /api/pet` là read endpoint nhưng lại ghi DB để sync offline decay. Đây là hành vi đúng theo thiết kế hiện tại, nhưng cần được coi là “read-with-write”.
- `getPet()` và `selectPet()` có đọc user/config lặp lại trong và ngoài transaction. Không sai, nhưng hơi dư.
- Reward system hiện mạnh ở backend, còn Pet frontend chỉ có wiring và feedback renderer. Nếu muốn Pet UI thật sự “nhận reward” từ learning path/quiz/assignment, cần có luồng caller thực sự đẩy response vào `petStore`.

## Kết Luận Ngắn

- Backend là nơi quyết định trạng thái Pet, inventory, shop, reward và coin thật.
- Frontend Pet là một app DOM-driven, render theo snapshot và event bus nội bộ.
- Luồng hiện tại hoạt động rõ nhất ở 4 hành động: chọn pet, cho ăn bằng item, mua shop item, đọc/sync pet.
- Hai điểm lệch đáng chú ý nhất hiện tại là:
  - reward route chưa mount
  - inventory page dùng play action thay vì use item action
