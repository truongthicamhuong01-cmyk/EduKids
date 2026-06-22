# PET_PHASE19_EVOLUTION_AUDIT.md

Audit hệ thống Evolution hiện tại, chỉ đọc mã nguồn và mô phỏng.

Phạm vi đọc chính:
- [backend/src/services/petMathService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petMathService.js)
- [backend/src/services/petService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petService.js)
- [backend/src/services/petDecayService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petDecayService.js)
- [backend/src/services/petOfflineService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petOfflineService.js)
- [backend/src/services/rewardService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/rewardService.js)
- [backend/src/services/petItemEffectService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petItemEffectService.js)
- [backend/scripts/seed-pet-game-config.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/scripts/seed-pet-game-config.js)

## Tóm tắt ngắn

- Evolution hiện tại là một hệ thống server-side có tính toán rõ ràng, nhưng trong gameplay thực tế gần như không đi tới các stage cao.
- Nguyên nhân chính không phải level curve, mà là hunger gate.
- Với các profile người chơi bình thường, pet bị tụt hunger quá nhanh so với tốc độ lên level.
- Kể cả ở kịch bản rất lạc quan, stage `young` vẫn không đạt được trong thực chiến không-spam-item.
- `baby` là stage duy nhất mà người chơi thường thấy trong một vòng đời học tập tự nhiên.

## 1. Evolution System Audit

### 1.1 Current stages

Nguồn điều kiện stage:
- [petMathService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petMathService.js)
- [seed-pet-game-config.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/scripts/seed-pet-game-config.js)

`calculateEvolutionStage(petType, level, evolutionConfig, petState)` chỉ xét 4 điều kiện:
- `level`
- `health`
- `happiness`
- `hunger`

Không thấy điều kiện runtime nào khác được enforce.

Lưu ý:
- `requiresAchievement` có được parse trong `normalizeStageRules()`, nhưng trong `calculateEvolutionStage()` không hề được dùng.
- `petTypes` và `byPetType` có hỗ trợ override theo pet type, nhưng seed hiện tại cho `horse`, `elephant`, `cat`, `dog` đều dùng cùng bộ stage.

| Stage | Điều kiện code thực tế |
|---|---|
| `baby` | `minLevel=1`, `minHealth=0`, `minHappiness=0`, `minHunger=0` |
| `young` | `minLevel=10`, `minHealth=60`, `minHappiness=50`, `minHunger=40` |
| `teen` | `minLevel=20`, `minHealth=65`, `minHappiness=55`, `minHunger=45` |
| `hero` | `minLevel=35`, `minHealth=70`, `minHappiness=60`, `minHunger=50` |
| `legend` | `minLevel=50`, `minHealth=75`, `minHappiness=65`, `minHunger=55` |
| `mythic` | `minLevel=80`, `minHealth=80`, `minHappiness=70`, `minHunger=60` |

### 1.2 Stage calculation logic

`calculateEvolutionStage()`:
- sort stage theo `minLevel`
- mặc định `selectedStage = evolutionConfig.defaultStage || "baby"`
- đi qua từng stage theo thứ tự tăng dần
- nếu `level`, `health`, `happiness`, `hunger` đều đạt thì stage được nâng lên stage đó
- kết quả cuối cùng là stage cao nhất mà pet đủ điều kiện

Kết luận:
- Stage là derived state có điều kiện tích lũy.
- Không có bước “unlock” riêng nào ngoài điều kiện stat/level.

## 2. Evolution Trigger Audit

### 2.1 Stage được tính ở đâu

Stage được tính trong `petMathService` và được gọi từ nhiều nhánh server-side:
- [petDecayService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petDecayService.js)
- [petService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petService.js)
- [rewardService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/rewardService.js)
- [petItemEffectService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petItemEffectService.js)

### 2.2 Khi nào stage được cập nhật

Stage được tính lại khi:
- user mở pet và hệ thống sync offline decay trong `getPet()`
- user feed/play/sleep qua `mutatePetAction()`
- reward service mutate pet khi nhận coin/exp/happiness
- item use mutate pet qua `applyItemEffectsToPet()`

### 2.3 Realtime hay không

- Không có background job riêng cho evolution.
- Không có cron tick riêng để tính stage.
- Stage được cập nhật theo server write-path, tức là “event-driven”, không phải “timer-driven”.

### 2.4 Persist DB hay derive runtime

- Stage là derived runtime, nhưng hiện được persist lại cùng pet state.
- `petService.getPet()` sync state, rồi `savePetState()` với `stage` đã được tính lại.
- `rewardService` và `inventoryService` cũng save pet state sau mutation.
- Frontend không tự tính stage nghiệp vụ; frontend chỉ render theo state server trả về.

### 2.5 Flow thực tế

```text
User Action
↓
petService / rewardService / inventoryService
↓
applyPetDecay() hoặc applyPetMutation()
↓
calculateLevelState()
↓
calculateEvolutionStage()
↓
savePetState()
↓
Response chứa pet.stage
↓
Frontend render theo stage
```

### 2.6 Pet item path

`petItemEffectService.applyItemEffectsToPet()` chỉ là lớp adapter:
- map `hungerDelta`
- map `happinessDelta`
- map `energyDelta`
- map `healthDelta`
- map `expDelta`
- sau đó gọi `applyPetMutation()`

Kết luận:
- Item use cũng có thể làm stage thay đổi, nhưng chỉ gián tiếp qua stat mutation.
- Không có “evolution bonus” riêng cho item use.

## 3. Stage Reachability Simulation

### 3.1 Mô hình mô phỏng

Tôi mô phỏng theo chu kỳ ngày:
- 24 giờ offline decay theo logic hiện tại
- sau đó áp reward của profile trong ngày
- không spam item
- không feed để cứu hunger

Lý do chọn kịch bản này:
- đây là cách gần nhất với gameplay thực tế bình thường của học sinh
- nếu kịch bản lạc quan nhất còn fail, thì kịch bản trung bình cũng fail

### 3.2 Reward assumptions từ code thật

Nguồn:
- [rewardService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/rewardService.js)
- [quizSubmitController.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/controllers/quizSubmitController.js)
- [assignmentController.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/controllers/assignmentController.js)
- [learningPathController.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/controllers/learningPathController.js)
- [learningPathEngine.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/learningPathEngine.js)

Reward pet hiện tại:
- daily login: `+1 EXP`, `+1 happiness`
- lesson complete: `+3 EXP`, `+1 happiness`
- quiz high score bonus: `+5 EXP`, `+3 happiness`
- assignment: `+5 EXP`, `+3 happiness`
- assignment high score: `+5 EXP`, `+4 happiness`
- learning path checkpoint: `+100 EXP`, `+6 happiness`, `+5 energy`
- learning path mountain: `+250 EXP`, `+6 happiness`, `+5 energy`

High score threshold đã tách:
- quiz: `score >= 90`
- assignment: `score >= 9`

### 3.3 Profile summary

| Profile | Daily EXP lạc quan | Daily happiness lạc quan | Ghi chú |
|---|---:|---:|---|
| LIGHT | `4` | `2` | daily login + 1 lesson |
| MEDIUM | `9` | `6` | daily login + 1 lesson + quiz high score |
| ACTIVE | `109` | `12` | daily login + 1 lesson + quiz high score + checkpoint |

Lưu ý:
- MEDIUM và ACTIVE ở đây dùng kịch bản lạc quan nhất để làm upper bound.
- Nếu quiz không high score, progression còn chậm hơn.

### 3.4 Stage reachability kết luận theo profile

#### LIGHT

Kết quả mô phỏng 365 ngày:
- level chỉ lên tới 8
- stage vẫn là `baby`
- `young`, `teen`, `hero`, `legend`, `mythic`: không đạt

Kết luận:
- `young` gần như không thể đạt trong gameplay bình thường.
- mọi stage cao hơn cũng không đạt.

#### MEDIUM

Kịch bản lạc quan nhất:
- level 10 đạt vào ngày 238
  - tại đúng ngày đó:
  - hunger = `0`
  - energy = `52`
  - happiness = `100`
  - health = `0`
  - stage vẫn là `baby`

Mô phỏng 365 ngày:
- level chỉ lên tới 12
- stage vẫn là `baby`
- `teen`, `hero`, `legend`, `mythic`: không đạt

Kết luận:
- `young` không đạt được vì hunger/health đã rơi về 0 trước khi chạm mốc stage.

#### ACTIVE

Kịch bản lạc quan nhất:
- level 10 đạt vào ngày 20
  - hunger = `0`
  - energy = `8`
  - happiness = `100`
  - health = `0`
- level 20 đạt vào ngày 85
  - hunger = `0`
  - energy = `21`
  - happiness = `100`
  - health = `0`
- level 35 đạt vào ngày 297
  - hunger = `0`
  - energy = `34`
  - happiness = `100`
  - health = `0`

Mô phỏng 365 ngày:
- level chỉ lên tới 38
- stage vẫn là `baby`
- `legend`, `mythic`: không đạt

Kết luận:
- Dù EXP tăng rất nhanh, stage vẫn bị khóa vì hunger về 0 rất sớm và health chết theo sau.

### 3.5 Kết luận reachability

Trong gameplay thực tế hiện tại:
- `young`: gần như không đạt được nếu không chủ động nuôi lại hunger
- `teen`: không đạt được trong profile bình thường
- `hero`: không đạt được trong profile bình thường
- `legend`: không đạt được trong profile bình thường
- `mythic`: không đạt được trong profile bình thường

Nếu giữ nguyên profile không spam item và không feed nhiều:
- người chơi chỉ thấy `baby`
- các stage sau chỉ tồn tại trên giấy tờ

## 4. Stat Gate Analysis

### 4.1 Hunger gate

Nguồn hunger:
- khởi tạo từ `petBalance.initialState` hoặc mặc định 100
- có thể tăng từ feed action
- có thể tăng từ food/item effect qua `petItemEffectService`

Nguồn mất hunger:
- `applyPetDecay()` trừ `1 / giờ`
- tức `24 / ngày` khi sync 24h

Tốc độ thực tế trong profile bình thường:
- day 1: 76
- day 2: 52
- day 3: 28
- day 4: 4

Kết luận:
- hunger là gate khóa progression mạnh nhất.
- chỉ sau 3 ngày, `young` đã gần như đóng cửa vì minHunger = 40.

### 4.2 Happiness gate

Nguồn happiness:
- daily login `+1`
- lesson complete `+1`
- quiz high score `+3`
- assignment `+3`
- assignment high score `+4`
- learning path checkpoint `+6`
- learning path mountain `+6`
- item effects có thể tăng thêm nếu item có `happinessDelta`

Tốc độ:
- LIGHT: net `-4 / ngày`
- MEDIUM high score: net `0 / ngày`
- ACTIVE high score: net `+6 / ngày`

Kết luận:
- happiness không phải bottleneck chính cho MEDIUM/ACTIVE.
- với LIGHT, happiness cũng tụt dần và sẽ thất bại nếu chỉ nhìn dài hạn.

### 4.3 Health gate

Nguồn health:
- không có decay trực tiếp khi stats ổn
- giảm `0.5 / giờ` khi `hunger < 20` hoặc `energy < 20`
- tương đương `12 / ngày` khi đã bước vào vùng suy giảm
- item/food có thể tăng health nếu config có `healthDelta`

Kết luận:
- health là hậu quả của hunger/energy thấp, không phải nguyên nhân đầu tiên.
- khi hunger chạm dưới 20, health nhanh chóng rơi về 0.

### 4.4 Level gate

Nguồn:
- exp curve quadratic trong [petMathService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petMathService.js)
- seed config ở [seed-pet-game-config.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/scripts/seed-pet-game-config.js)

Mốc cumulative EXP:

| Level | Cumulative EXP cần có |
|---|---:|
| 10 | 2140 |
| 20 | 9185 |
| 35 | 32365 |
| 50 | 75480 |
| 80 | 243115 |

Kết luận:
- level gate tự thân không quá phi lý.
- nhưng level gate chỉ là một phần của bài toán.
- khi hunger đã sập, level gate không còn ý nghĩa thực tế cho evolution.

### 4.5 Gate nào khóa progression nhiều nhất

Xếp hạng ảnh hưởng:
1. Hunger
2. Health
3. Level
4. Happiness

Lý do:
- hunger tụt sớm nhất và chặn tất cả stage từ rất sớm.
- health là hệ quả của hunger.
- level có thể đạt được ở ACTIVE, nhưng không cứu được stage vì stats đã hỏng.

## 5. Evolution Bottleneck Audit

### 5.1 Young

Điều kiện:
- level 10
- health 60
- happiness 50
- hunger 40

Bottleneck chính:
- hunger

Tại sao:
- hunger xuống dưới 40 vào ngày 3.
- level 10 trong profile bình thường không kịp tới.

### 5.2 Teen

Điều kiện:
- level 20
- health 65
- happiness 55
- hunger 45

Bottleneck chính:
- hunger

Tại sao:
- hunger dưới 45 cũng vào khoảng ngày 3.
- level 20 còn xa hơn rất nhiều.

### 5.3 Hero

Điều kiện:
- level 35
- health 70
- happiness 60
- hunger 50

Bottleneck chính:
- hunger, sau đó là level

Tại sao:
- hunger dưới 50 vẫn từ rất sớm.
- level 35 trong ACTIVE lạc quan cũng chỉ đạt quanh ngày 289.

### 5.4 Legend

Điều kiện:
- level 50
- health 75
- happiness 65
- hunger 55

Bottleneck chính:
- hunger, level

Tại sao:
- hunger dưới 55 trước cả khi người chơi kịp đi được một phần nhỏ của level curve.
- level 50 không đạt trong 365 ngày ngay cả với ACTIVE lạc quan.

### 5.5 Mythic

Điều kiện:
- level 80
- health 80
- happiness 70
- hunger 60

Bottleneck chính:
- hunger, level

Tại sao:
- hunger dưới 60 chỉ sau 2 ngày.
- level 80 là mục tiêu dài hạn rất xa.

### 5.6 Bottleneck tổng kết

Stage bị nghẽn nhất không phải do một stage riêng biệt, mà do cùng một root cause:
- hunger decay không được bù bởi learning rewards
- health follow-up làm progression chết thêm nhanh

## 6. Real Player Feasibility

Đánh giá cho học sinh tiểu học bình thường, không spam item:

| Câu hỏi | Đánh giá |
|---|---|
| Có thể đạt `Young` không | `Nearly Impossible` |
| Có thể đạt `Teen` không | `Impossible` |
| Có thể đạt `Hero` không | `Impossible` |

Giải thích:
- muốn đạt `Young`, người chơi phải có level 10 trước khi hunger rơi dưới 40.
- với LIGHT, level 10 quá xa.
- với MEDIUM, level 10 vẫn quá xa so với tụt hunger.
- với ACTIVE lạc quan nhất, level 10 tới ngày 20, nhưng hunger/health đã sập từ ngày 3-4.

## 7. Evolution Reward Gap Audit

### 7.1 Evolution có mang lại gì không

Theo code hiện tại:
- không có stat bonus đặc thù khi stage lên
- không có reward coin/exp riêng cho stage up
- không có unlock gameplay riêng theo stage trong backend

### 7.2 Stage đổi ngoại hình không

Có một đường render theo stage ở frontend:
- [frontend/src/pet/renderers/renderPet.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/frontend/src/pet/renderers/renderPet.js)
- [frontend/src/pet/utils/assetResolver.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/frontend/src/pet/utils/assetResolver.js)

`renderPet()` truyền `pet.stage` vào `resolvePetAssetPath()`.

Kết luận:
- stage có thể ảnh hưởng đến hiển thị nếu asset manifest có mapping phù hợp.
- backend không cấp thêm gameplay reward khi stage đổi.

### 7.3 Stage đổi stat/reward/gameplay không

- Không thấy stage-up tự động tăng stat.
- Không thấy stage-up tự động tăng coin/exp.
- Không thấy stage-up mở khóa cơ chế gameplay mới trong backend.

Kết luận:
- evolution hiện tại chủ yếu là state/visual progression, chưa phải gameplay progression đầy đủ.

## 8. Long-Term Progression Audit

### 8.1 Từ level 1 đến 100 có còn động lực không

EXP curve có động lực số học:
- LIGHT: level 10 là mục tiêu rất xa
- MEDIUM: level 10 vẫn xa nhưng có thể thấy tiến triển
- ACTIVE: level tăng tương đối nhanh

Nhưng evolution là nút thắt lớn hơn EXP:
- stage vẫn dính ở `baby`
- vì vậy level tăng không chuyển hóa thành cảm giác “lớn lên”

### 8.2 Dead zones

Dead zone lớn nhất:
- `baby` kéo dài quá lâu

Dead zone khác:
- các stage trên `baby` chỉ tồn tại như cột mốc trên config, không trở thành trải nghiệm tự nhiên

### 8.3 Progression gaps

- khoảng cách giữa level milestone và stage milestone quá lớn
- reward loop cho học tập không bù hunger
- health snowball làm pet “chết năng lượng” sau khi hunger tụt

### 8.4 Late-game gaps

- level 35/50/80 là mốc đẹp trên giấy
- nhưng gameplay hiện tại không cho thấy đường đi tự nhiên tới đó

## 9. Phase 2 Recommendations

Không sửa code trong phase này. Chỉ đề xuất.

### 9.1 Evolution Threshold Changes

Đề xuất:
- giảm ngưỡng hunger cho các stage sau
- hoặc bỏ hunger khỏi một số stage sau nếu gameplay muốn nhẹ nhàng hơn
- cân nhắc tách stage đầu game và endgame theo kiểu tiến trình mềm hơn

### 9.2 Reward Changes

Đề xuất:
- gắn thưởng phụ khi stage up
- ví dụ: coin, exp, hoặc cosmetic unlock
- nếu muốn progression có ý nghĩa, mỗi stage nên đổi được một thứ gì đó thấy được

### 9.3 Hunger Requirement Changes

Đề xuất:
- giảm tốc độ tụt hunger cho user học đều
- hoặc thêm hunger recovery nhỏ từ học tập có nhịp độ hợp lý
- hoặc tạo cơ chế “maintain hunger” qua hoạt động học thay vì chỉ feed item

### 9.4 Stage Expansion

Đề xuất:
- nếu muốn progression dài hạn, thêm stage trung gian
- tránh nhảy từ baby sang young với yêu cầu quá cao rồi dừng ở đó

### 9.5 Additional Evolution Rewards

Đề xuất:
- reward visual
- reward stat nhỏ
- reward unlock shop skin / background / animation frame
- reward title hoặc badge

## 10. Final Assessment

### 10.1 Scoring

| Hạng mục | Điểm / 10 |
|---|---:|
| Evolution Design | 6 |
| Evolution Balance | 1 |
| Evolution Reachability | 1 |
| Long-Term Progression | 2 |

### 10.2 Overall classification

Phân loại:
- `Critical`

Lý do:
- hệ thống có công thức rõ, nhưng progression thực tế bị nghẽn ở hunger gate quá sớm
- `baby` gần như là stage duy nhất có thể duy trì trong gameplay học tập bình thường
- stage cao không tạo được vòng lặp chơi tự nhiên
- level tăng không kéo theo cảm giác evolution

## 11. Kết luận cuối

Evolution hiện tại là một hệ thống có cấu trúc tốt trên giấy, nhưng trong gameplay thực tế lại không đi tới đích.

Tóm gọn:
- level có thể lên
- stage thì không
- vì hunger sập trước
- health kéo theo sập tiếp
- reward loop học tập không bù được khoảng trống đó

Nếu Phase 2 muốn biến Pet thành companion có progression thật sự, cần sửa trọng tâm ở:
- hunger economy
- stage threshold
- stage reward
- và khoảng cách giữa học tập với chăm pet
