# PET Balance Audit Phase 1.8

## Scope

Audit hệ thống Pet Economy hiện tại để chuẩn bị cho Phase 2.

- Không sửa code.
- Không sửa UI.
- Không sửa database.
- Không đổi API.

## 1. Full Catalog Audit

### Source files đọc

- `backend/scripts/seed-pet-game-config.js`
- `backend/src/services/shopService.js`
- `backend/src/services/inventoryService.js`
- `backend/src/services/petItemEffectService.js`
- `backend/src/services/rewardService.js`

### Catalog hiện tại

| itemId | name | category | price | unlockLevel | consumable | affectsPet | effects |
|---|---|---:|---:|---:|---|---|---|
| `biscuit` | Bánh quy | food | 5 | 1 | true | true | `hunger +18`, `happiness +2`, `health +1` |
| `milk` | Sữa | food | 8 | 1 | true | true | `hunger +22`, `happiness +3`, `health +2` |
| `apple` | Táo | food | 6 | 1 | true | true | `hunger +16`, `happiness +1`, `health +1` |
| `carrot` | Cà rốt | food | 6 | 1 | true | true | `hunger +15`, `happiness +1`, `health +1` |
| `ball` | Bóng | toy | 12 | 2 | true | true | `happiness +12`, `energy -4` |
| `teddy` | Gấu bông | toy | 15 | 3 | true | true | `happiness +14`, `energy -3` |
| `vitamin` | Vitamin | medicine | 18 | 3 | true | true | `health +14`, `happiness +1` |
| `medicineKit` | Bộ hồi phục | medicine | 28 | 5 | true | true | `health +22`, `energy +8` |
| `hat` | Mũ nhỏ | decoration | 20 | 2 | false | true | `happiness +4` |
| `cushion` | Đệm êm | decoration | 25 | 4 | false | true | `health +4`, `happiness +3` |
| `eventPass` | Vé sự kiện | special | 40 | 6 | true | false | `happiness +8` |

### Notes

- `inventoryService.useItemFromInventory()` hiện dùng `consumable` để quyết định có giảm quantity hay không.
- `petItemEffectService` chỉ áp dụng numeric effects, không có logic riêng theo itemId.
- `eventPass` là item có `affectsPet: false`, nên không thay đổi pet state.

## 2. Food Balance Audit

### Method

Value rating = `(hungerDelta + happinessDelta + healthDelta) / price`

| Food Name | Price | Effects | Value Rating |
|---|---:|---|---:|
| Bánh quy | 5 | `+18 hunger, +2 happiness, +1 health` | 4.20 |
| Sữa | 8 | `+22 hunger, +3 happiness, +2 health` | 3.38 |
| Táo | 6 | `+16 hunger, +1 happiness, +1 health` | 3.00 |
| Cà rốt | 6 | `+15 hunger, +1 happiness, +1 health` | 2.83 |

### Đánh giá

- `biscuit` là item hiệu quả nhất theo coin.
- `milk` đắt hơn nhưng vẫn hợp lý vì hồi phục toàn diện hơn.
- `apple` ở mức trung bình, không nổi bật.
- `carrot` là item yếu nhất về giá trị trên coin, phù hợp làm food entry-level nhưng không tạo động lực mua về lâu dài.

### Kết luận balance food

- Không có food nào quá mạnh tới mức phá economy.
- `biscuit` hơi vượt trội so với nhóm còn lại.
- `carrot` có thể bị bỏ qua nếu người chơi đã mở khóa `biscuit` và `milk`.

## 3. Toy Balance Audit

### Toy hiện có

| Toy | Price | Happiness Gain | Energy Cost | Unlock Level | Consumable hiện tại |
|---|---:|---:|---:|---:|---|
| Ball | 12 | +12 | -4 | 2 | true |
| Teddy | 15 | +14 | -3 | 3 | true |

### Đánh giá

- `ball` rẻ, unlock sớm, phù hợp toy entry-level.
- `teddy` đắt hơn một chút nhưng hiệu quả hơn trên coin và đỡ tốn energy hơn.
- Hai toy hiện có khá gần nhau về vai trò:
  - đều chủ yếu tăng happiness
  - đều trừ energy
  - không có variety về chiến lược sử dụng

### Progression cảm giác

- Có progression rất mỏng:
  - level 2 mở `ball`
  - level 3 mở `teddy`
- Sau đó shop không có toy mới nào.
- Do đó toy progression hiện tại dừng quá sớm.

## 4. Reward Economy Audit

### Source files đọc

- `backend/src/services/rewardService.js`
- `backend/scripts/seed-pet-game-config.js`
- `backend/src/controllers/quizSubmitController.js`
- `backend/src/controllers/assignmentController.js`
- `backend/src/controllers/learningPathController.js`
- `backend/src/services/authService.js`
- `backend/src/services/learningPathEngine.js`

### Reward configs hiện tại

| Activity | Coin Reward | EXP Reward | Pet Reward |
|---|---:|---:|---|
| Daily Login | 3 | 0 | `+1 petExp, +1 happiness` |
| Lesson Complete | 5 | 0 | `+3 petExp, +2 happiness` |
| Learning Path checkpoint | 50 | 0 | `+100 petExp, +10 happiness, +5 energy` |
| Learning Path mountain | 200 | 0 | `+250 petExp` |
| Assignment | 10 | 20 user EXP via `awardExp` | `+5 petExp, +3 happiness` |
| Assignment high score | 10 | 0 | `+5 petExp, +4 happiness` |
| Quiz submit | 5 | 30 user EXP via `awardExp` | `+3 petExp, +2 happiness` |
| Quiz high score | 10 | 0 | `+5 petExp, +4 happiness` + bonus `+5 happiness` if sourceId starts with `quiz:` |
| Learning streak 3 days | 10 | 0 | `+4 petExp, +2 happiness` |
| Learning streak 7 days | 25 | 0 | `+10 petExp, +5 happiness` |
| Learning streak 14 days | 50 | 0 | `+18 petExp, +8 happiness` |

### Quy đổi thực tế theo code

- `rewardLessonComplete()` dùng cho quiz submit hiện tại.
- `rewardHighScore()` dùng chung cho quiz và assignment.
- `rewardLearningPath()` nhận reward trực tiếp từ `learningPathEngine` qua event `REWARD_GRANTED`.
- `rewardDailyLogin()` được gọi khi login user.
- `rewardAssignment()` được gọi khi submit assignment.

### Lưu ý quan trọng

- `highScore.minScore = 9` đang chạy trên quiz score thang `0-100`.
- Vì vậy quiz gần như luôn nhận high score reward nếu không làm quá tệ.
- Assignment score dùng thang `0-10`, nên `minScore = 9` hợp lý hơn ở assignment context.
- Đây là nguồn inflate reward lớn nhất trong economy hiện tại.

## 5. Level Progression Audit

### Source

- `backend/scripts/seed-pet-game-config.js`
- `backend/src/services/petMathService.js`

### Level config hiện tại

- curve type: `quadratic`
- baseExp: `80`
- linearStep: `35`
- quadraticFactor: `0.8`
- levelCap: `100`

### EXP requirement table

| Level | Required EXP to next level | Cumulative EXP to reach level |
|---|---:|---:|
| 1 | 80 | 0 |
| 2 | 115 | 80 |
| 3 | 153 | 195 |
| 4 | 192 | 348 |
| 5 | 232 | 540 |
| 6 | 275 | 772 |
| 7 | 318 | 1047 |
| 8 | 364 | 1365 |
| 9 | 411 | 1729 |
| 10 | 459 | 2140 |
| 20 | 1033 | 9185 |
| 35 | 1859 | 32365 |
| 50 | 2691 | 75480 |
| 80 | 4344 | 243115 |
| 100 | max level | 432505 |

### Evolution stages

| Stage | Min Level | Min Health | Min Happiness | Min Hunger |
|---|---:|---:|---:|---:|
| baby | 1 | 0 | 0 | 0 |
| young | 10 | 60 | 50 | 40 |
| teen | 20 | 65 | 55 | 45 |
| hero | 35 | 70 | 60 | 50 |
| legend | 50 | 75 | 65 | 55 |
| mythic | 80 | 80 | 70 | 60 |

### Đánh giá progression

- Level progression ban đầu không quá nhanh:
  - level 6 cần 772 EXP
  - level 10 cần 2140 EXP
- Về giữa và cuối game, curve tăng mạnh rất nhanh:
  - level 20 cần 9185 EXP
  - level 50 cần 75480 EXP
- Pet level vẫn có ý nghĩa vì stage thresholds nằm ở 10/20/35/50/80.
- Tuy nhiên shop hiện chỉ unlock đến level 6, nên progression cấp shop bị front-loaded và chấm dứt sớm hơn progression cấp pet.

## 6. Economy Simulation

### Assumptions

Đây là mô phỏng ước tính theo các reward paths thực tế trong code.

- Light: 1 lesson/day + daily login
- Medium: 1 lesson/day + 1 quiz/day + daily login
- Active: 1 lesson/day + 1 quiz/day + 1 learning-path checkpoint trung bình mỗi 3 ngày + daily login
- Quiz được giả định đạt ngưỡng high score vì `minScore = 9` trên thang 0-100 là rất thấp

### Daily baseline

| Profile | Coin/day | User EXP/day | Pet EXP/day | Pet Happiness/day |
|---|---:|---:|---:|---:|
| Light | 8 | 0 | 4 | 3 |
| Medium | 23 | 30 | 12 | 14 |
| Active | 39.67 | 30 | 45.33 | 24.33 |

### 1 day

| Profile | Coin | User EXP | Pet EXP | Pet level estimate |
|---|---:|---:|---:|---|
| Light | 8 | 0 | 4 | level 1 |
| Medium | 23 | 30 | 12 | level 1 |
| Active | 40 | 30 | 45 | level 1 |

### 1 week

| Profile | Coin | User EXP | Pet EXP | Pet level estimate |
|---|---:|---:|---:|---|
| Light | 56 | 0 | 28 | level 1 |
| Medium | 161 | 210 | 84 | level 2 |
| Active | 278 | 210 | 318 | level 3 |

### 1 month

| Profile | Coin | User EXP | Pet EXP | Pet level estimate |
|---|---:|---:|---:|---|
| Light | 240 | 0 | 120 | level 2 |
| Medium | 690 | 900 | 360 | level 4 |
| Active | 1190 | 900 | 1360 | level 7 |

### Diễn giải

- Light learner vẫn có tiến triển pet, nhưng khá chậm.
- Medium learner lên level rõ rệt sau 1 tháng.
- Active learner có pet progression nhanh hơn đáng kể, nhưng vẫn chưa chạm các mốc stage cao.
- Economy hiện nghiêng mạnh về quiz và learning path, không phải food/toy loop.

## 7. Toy Durability Recommendations

### Dựa trên catalog hiện tại

| Toy | MaxDurability | LossPerUse | Lý do |
|---|---:|---:|---|
| Ball | 100 | 3 | toy entry-level, rẻ hơn, dùng thường xuyên hơn nên nên hao nhanh hơn |
| Teddy | 100 | 2 | cao cấp hơn ball, nên bền hơn để tạo cảm giác progression |

### Ghi chú balance

- Nếu Phase 2 chỉ thêm durability mà chưa thêm toy mới, `ball` và `teddy` vẫn hơi ít variety.
- Nên giữ durability cao để toy không “hết nhanh” và không tạo áp lực thay đồ chơi liên tục.

## 8. New Toy Recommendations

### Mục tiêu

- Tối thiểu 6 toy
- Tối ưu 8 đến 12 toy
- Phù hợp học sinh tiểu học

### Đề xuất 8 toy mới

| Toy | Unlock Level | Price | MaxDurability | LossPerUse | Effects |
|---|---:|---:|---:|---:|---|
| Ball | 2 | 12 | 100 | 3 | `+12 happiness, -4 energy` |
| Teddy Bear | 3 | 15 | 100 | 2 | `+14 happiness, -3 energy` |
| Kite | 2 | 14 | 90 | 3 | `+10 happiness, -2 energy` |
| Drum | 3 | 16 | 80 | 3 | `+11 happiness, -2 energy` |
| Jump Rope | 4 | 18 | 70 | 4 | `+13 happiness, -5 energy` |
| Bamboo Horse | 5 | 22 | 110 | 2 | `+15 happiness, -2 energy` |
| Toy Horse | 6 | 26 | 120 | 2 | `+16 happiness, -3 energy` |
| Toy Elephant | 7 | 28 | 130 | 2 | `+18 happiness, -4 energy` |

### Ghi chú

- Giá và durability nên tăng dần theo cảm giác “đồ chơi bền hơn khi lên level”.
- Toy mới nên tập trung vào happiness, chỉ dùng energy cost nhẹ để không phá sleep loop.
- Nên giữ toy là reusable, không quay lại mô hình consumable.

## 9. Shop Progression Design

### Shop hiện tại

| Unlock Level | Item |
|---|---|
| 1 | biscuit, milk, apple, carrot |
| 2 | ball, hat |
| 3 | teddy, vitamin |
| 4 | cushion |
| 5 | medicineKit |
| 6 | eventPass |

### Đánh giá

- Shop hiện có progression nhưng quá ngắn.
- Sau level 6, shop không còn item mới nào.
- Điều này làm late-game ít phần thưởng mở khóa.

### Đề xuất progression mới

| Level | Suggested unlock focus |
|---|---|
| 1 | basic food starter pack |
| 2 | Ball, Kite, Hat |
| 3 | Teddy, Drum, Vitamin |
| 4 | Jump Rope, Cushion |
| 5 | Bamboo Horse, Medicine Kit |
| 6 | Toy Horse, EventPass |
| 7 | Toy Elephant |
| 8 | Toy Cat |
| 9 | Toy Dog |
| 10 | seasonal / premium toy tier |

### Kết luận progression shop

- Current shop unlock curve chưa đủ sâu để nuôi cảm giác “mở khóa dần”.
- Phase 2 Toy Durability sẽ phù hợp hơn nếu đồng thời mở thêm toy theo level.

## 10. Dead Content Audit

### Không có item nào bị “never unlock” theo cấu hình hiện tại

- Tất cả item trong `shopCatalog` có `unlockLevel <= 6`.
- `levelCap = 100`, nên không item nào là không thể mở khóa theo config.

### Content underused hoặc chưa có downstream logic rõ ràng

| Content | Audit note |
|---|---|
| `eventPass` | có trong shop và inventory, nhưng `affectsPet: false` và không có downstream feature đặc biệt nào trong code hiện tại |
| `hat` | `consumable: false`, nhưng không có luồng equip/unequip riêng ngoài việc inventory ghi `equipped: true` |
| `cushion` | tương tự `hat`, chỉ có effect stat, không có gameplay loop riêng |
| `ball`, `teddy` | hiện bị coi như consumable item, chưa có durability/reuse loop |
| `highScore` reward | được dùng lại cho quiz và assignment, nhưng trên quiz score 0-100 threshold đang quá thấp nên reward dễ bị spam |

### Không thấy item nào “không xuất hiện trên UI”

- Catalog item đều có thể đi qua shop/inventory flows hiện tại.

## 11. Phase 2 Readiness Assessment

### Toy Durability có phù hợp với economy hiện tại không?

Có, nhưng chỉ khi inventory schema và item-use flow được đổi đồng bộ.

### Cần chỉnh giá toy nào

- `ball`: có thể giữ giá thấp vì entry-level
- `teddy`: có thể giữ hoặc tăng nhẹ nếu thêm durability cao hơn
- các toy mới nên có price tăng dần theo unlock

### Cần chỉnh reward nào

- `highScore.minScore` nên xem lại vì quiz đang dùng thang 0-100
- learning path checkpoint reward hiện rất lớn, cần được cân bằng với toy durability để không tạo ra nền kinh tế quá dễ tích lũy
- daily login reward tương đối ổn

### Cần chỉnh decay nào

- decay hiện tại của pet đã giảm ở Phase 1.5 và không cần đụng thêm chỉ để phục vụ toy durability

### Cần chỉnh unlock level nào

- toy unlock nên trải đều qua level 2-9
- shop hiện chỉ tới level 6 là quá ngắn

### Cần chỉnh file nào cho Phase 2

- `backend/src/repositories/inventoryRepository.js`
- `backend/src/services/inventoryService.js`
- `backend/src/services/shopService.js`
- `backend/src/controllers/inventoryController.js`
- `backend/src/services/petService.js`
- `backend/src/services/petItemEffectService.js`
- `backend/scripts/seed-pet-game-config.js`
- `frontend/src/pet/pages/inventory/inventoryPage.js`
- `frontend/src/pet/api/inventoryApi.js`
- `frontend/src/pet/api/petApi.js`

## 12. Summary

### What the code says now

- Food economy ổn ở mức cơ bản.
- Toy economy hiện quá mỏng, chỉ có 2 toy.
- Shop progression dừng quá sớm.
- Reward economy nghiêng mạnh về quiz và learning path.
- Quiz high-score reward đang quá dễ kích hoạt vì threshold thấp trên thang 0-100.

### Recommendation cho Phase 2

- Chuyển toy sang reusable + durability.
- Giữ food consumable.
- Mở thêm toy theo level để shop có progression thật.
- Sửa schema inventory để support per-toy state.
- Cân nhắc lại quiz high-score threshold trước khi mở rộng economy thêm nữa.
