# PET_PHASE186_AUDIT.md

Audit long-term balance của module Pet tại thời điểm đọc mã nguồn.

Phạm vi:
- Chỉ audit và mô phỏng.
- Không sửa gameplay.
- Không sửa database.
- Không sửa API.
- Không sửa frontend/UI.

## Nguồn đã đọc

- [backend/src/services/petDecayService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petDecayService.js)
- [backend/src/services/petService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petService.js)
- [backend/src/services/petMathService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petMathService.js)
- [backend/src/services/petOfflineService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petOfflineService.js)
- [backend/src/services/rewardService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/rewardService.js)
- [backend/src/controllers/quizSubmitController.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/controllers/quizSubmitController.js)
- [backend/src/controllers/assignmentController.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/controllers/assignmentController.js)
- [backend/src/controllers/learningPathController.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/controllers/learningPathController.js)
- [backend/src/services/learningPathEngine.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/learningPathEngine.js)
- [backend/scripts/seed-pet-game-config.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/scripts/seed-pet-game-config.js)

## Assumptions mô phỏng

- Pet ban đầu ở trạng thái chuẩn: `hunger=100`, `energy=100`, `happiness=100`, `health=100`, `level=1`, `exp=0`, `isSleeping=false`.
- Mô phỏng offline dùng đúng logic runtime hiện tại và config seed hiện tại.
- Với mô phỏng exp economy:
  - `LIGHT` = daily login + 1 lesson/ngày.
  - `MEDIUM` = daily login + 1 lesson/ngày + 1 quiz/ngày.
  - `ACTIVE` = daily login + 1 lesson/ngày + 1 quiz/ngày + learning path checkpoint đều đặn.
- Với `MEDIUM` và `ACTIVE`, quiz score được tách thành hai nhánh:
  - không high score
  - high score

## Executive Summary

- Sleep/offline hiện tại cực kỳ khoan dung vì có cap offline 24 giờ.
- Pet không có cơ chế chết.
- Pet gần như không bị xuống cấp nếu người dùng biến mất dài ngày, vì mọi khoảng vắng mặt trên 24 giờ đều bị nén về đúng 24 giờ decay.
- EXP curve có ý nghĩa, nhưng tiến trình evolution bị nghẽn bởi stat gate, đặc biệt là `hunger`.
- Learning path checkpoint đang là nguồn pet EXP lớn nhất trong hệ thống hiện tại.
- Không có sleep oscillation lặp lại trong một lần offline dài, nhưng logic `sleep` thủ công có semantics khá lạ: không phải lúc nào cũng ép pet vào trạng thái ngủ.

## 1. Sleep Audit

### 1.1 Sleep trigger

Nguồn logic:
- [petDecayService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petDecayService.js)
- [petService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petService.js)

Các ngưỡng hiện tại:

| Rule | Value |
|---|---:|
| Auto sleep threshold | `energy <= 15` |
| Auto wake threshold | `energy >= 70` |
| Sleeping energy recovery | `+3 / giờ` |
| Awake energy decay | `-1 / giờ` |

Diễn giải logic:
- `resolveSleepingState()` trả về `true` khi energy rất thấp.
- `resolveSleepingState()` trả về `false` khi energy đạt ngưỡng wake.
- Ở vùng giữa `16..69`, trạng thái ngủ được giữ theo `isSleeping` cũ.

### 1.2 Sleep khi nào, thức khi nào

Trong runtime hiện tại:
- Nếu energy rơi xuống `<= 15`, pet bị set `isSleeping = true`.
- Nếu energy đạt `>= 70`, pet bị set `isSleeping = false`.
- Nếu energy nằm giữa 2 ngưỡng, state ngủ giữ nguyên.

### 1.3 Offline simulation

Offline decay bị cap bởi `petBalance.offline.capMinutes = 1440` trong [seed-pet-game-config.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/scripts/seed-pet-game-config.js), tức chỉ tối đa 24 giờ được áp dụng cho mỗi lần sync.

Kết quả mô phỏng từ code hiện tại:

| Offline | Hunger | Energy | Happiness | Health | Mood | isSleeping | Stage |
|---|---:|---:|---:|---:|---|---|---|
| 1 ngày | 76 | 76 | 94 | 100 | happy | false | baby |
| 3 ngày | 76 | 76 | 94 | 100 | happy | false | baby |
| 7 ngày | 76 | 76 | 94 | 100 | happy | false | baby |
| 14 ngày | 76 | 76 | 94 | 100 | happy | false | baby |
| 30 ngày | 76 | 76 | 94 | 100 | happy | false | baby |
| 60 ngày | 76 | 76 | 94 | 100 | happy | false | baby |
| 90 ngày | 76 | 76 | 94 | 100 | happy | false | baby |

Kết luận:
- 3/7/14/30/60/90 ngày offline đều cho kết quả y hệt 1 ngày offline.
- Không có decay tích lũy theo số ngày biến mất, vì cap 24 giờ chặn toàn bộ phần còn lại.

### 1.4 Sleep oscillation audit

Đánh giá:
- Không quan sát thấy chu kỳ `Sleep -> Wake -> Sleep -> Wake` lặp liên tục trong một lần offline dài.
- Lý do:
  - `applyPetDecay()` chỉ xử lý tối đa 24 giờ.
  - Khi pet đang ngủ, energy tăng dần.
  - Khi pet thức, energy giảm dần.
  - Không có cơ chế nào trong cùng một pass offline làm energy vừa tăng vừa giảm đủ để sinh oscillation nhiều vòng.

Nguy cơ thực tế:
- Có thể xảy ra **một** lần chuyển trạng thái, ví dụ từ ngủ sang thức khi energy chạm `>= 70`.
- Nhưng vì cap 24 giờ và energy recovery đơn điệu khi ngủ, một chuỗi oscillation lặp lại là không xảy ra theo logic hiện tại.

### 1.5 Extreme case

Mô phỏng 60 ngày và 90 ngày offline:
- Không có trạng thái bất thường.
- Pet vẫn giữ:
  - `hunger=76`
  - `energy=76`
  - `happiness=94`
  - `health=100`
  - `mood=happy`
  - `isSleeping=false`

Kết luận:
- Pet không bị kẹt.
- Pet cũng không thực sự “chịu hậu quả dài hạn” khi người chơi bỏ lâu ngày.

## 2. EXP Economy Audit

### 2.1 Level curve

Nguồn logic:
- [petMathService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petMathService.js)
- [seed-pet-game-config.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/scripts/seed-pet-game-config.js)

Current formula:

`requiredExp(level) = 80 + 35*(level-1) + 0.8*(level-1)^2`

Tổng EXP tích lũy để đạt level:

| Level | Cumulative EXP cần có |
|---|---:|
| 10 | 2140 |
| 20 | 9185 |
| 35 | 32365 |
| 50 | 75480 |
| 80 | 243115 |

### 2.2 Reward flow thực tế

Nguồn logic:
- [rewardService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/rewardService.js)
- [quizSubmitController.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/controllers/quizSubmitController.js)
- [assignmentController.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/controllers/assignmentController.js)
- [learningPathController.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/controllers/learningPathController.js)
- [learningPathEngine.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/learningPathEngine.js)

High score threshold đã tách theo nguồn:

| Helper | Threshold |
|---|---:|
| `isQuizHighScore()` | `score >= 90` |
| `isAssignmentHighScore()` | `score >= 9` |

Reward thực tế cho pet:

| Activity | Pet EXP | Pet Happiness | Notes |
|---|---:|---:|---|
| Daily login | 1 | 1 | từ `rewardDailyLogin()` |
| Lesson complete | 3 | 1 | từ `rewardLessonComplete()` |
| Quiz submit, không high score | 3 | 1 | quiz flow luôn gọi `rewardLessonComplete()` |
| Quiz high score | +5 | +3 bonus happiness | cộng thêm `rewardHighScore()` + bonus quiz |
| Assignment submit | 5 | 3 | từ `rewardAssignment()` |
| Assignment high score | +5 | +4 | từ `rewardHighScore()` |
| Learning path checkpoint | 100 | 6 bonus happiness + 5 bonus energy | `rewardLearningPath()` nhận `rewardOverride` từ engine |
| Learning path mountain | 250 | 6 bonus happiness + 5 bonus energy | cùng cơ chế override |

Điểm rất quan trọng:
- `learningPathController` truyền `event.reward` từ engine sang `rewardLearningPath()`.
- `learningPathEngine` hiện phát ra checkpoint reward mặc định `xu=50`, `exp=100`.
- Mountain reward mặc định `xu=200`, `exp=250`.
- Vì `normalizeRewardRule()` map `exp -> petExp`, checkpoint hiện cho pet `100 EXP`, không phải `10 EXP`.

### 2.3 EXP/ngày, tuần, tháng

#### LIGHT

Giả định:
- Daily login + 1 lesson/day.

| Metric | Pet EXP |
|---|---:|
| /ngày | 4 |
| /tuần | 28 |
| /tháng (30 ngày) | 120 |

#### MEDIUM

Giả định:
- Daily login + 1 lesson/day + 1 quiz/day.

Hai nhánh:

| Scenario | Pet EXP/ngày | Pet EXP/tuần | Pet EXP/tháng |
|---|---:|---:|---:|
| Quiz không high score | 7 | 49 | 210 |
| Quiz high score | 12 | 84 | 360 |

#### ACTIVE

Giả định:
- Daily login + 1 lesson/day + 1 quiz/day + 1 learning path checkpoint/day.

Hai nhánh:

| Scenario | Pet EXP/ngày | Pet EXP/tuần | Pet EXP/tháng |
|---|---:|---:|---:|
| Quiz không high score | 107 | 749 | 3210 |
| Quiz high score | 112 | 784 | 3360 |

### 2.4 Days to target level

#### LIGHT

| Target level | Days |
|---|---:|
| 10 | 535 |
| 20 | 2297 |
| 35 | 8092 |
| 50 | 18870 |
| 80 | 60779 |

#### MEDIUM

| Target level | Quiz non-high-score | Quiz high-score |
|---|---:|---:|
| 10 | 306 | 179 |
| 20 | 1313 | 766 |
| 35 | 4624 | 2698 |
| 50 | 10783 | 6290 |
| 80 | 34731 | 20260 |

#### ACTIVE

| Target level | Quiz non-high-score | Quiz high-score |
|---|---:|---:|
| 10 | 20 | 20 |
| 20 | 86 | 83 |
| 35 | 303 | 289 |
| 50 | 706 | 674 |
| 80 | 2273 | 2171 |

Kết luận EXP economy:
- Về mặt số học, level milestones là đạt được.
- Nhưng tiến trình evolution thực tế lại không đi theo EXP một cách thuần túy.

## 3. Evolution Audit

Nguồn logic:
- [seed-pet-game-config.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/scripts/seed-pet-game-config.js)
- [petMathService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petMathService.js)

Stage hiện có:

| Stage | Min level | Min health | Min happiness | Min hunger |
|---|---:|---:|---:|---:|
| baby | 1 | 0 | 0 | 0 |
| young | 10 | 60 | 50 | 40 |
| teen | 20 | 65 | 55 | 45 |
| hero | 35 | 70 | 60 | 50 |
| legend | 50 | 75 | 65 | 55 |
| mythic | 80 | 80 | 70 | 60 |

### 3.1 LIGHT user

Nếu chỉ daily login + lesson:
- EXP lên rất chậm.
- Hunger giảm 24 điểm sau mỗi 24 giờ offline hợp lệ.
- Chỉ sau 3 ngày, hunger đã xuống khoảng 28.

Kết luận:
- `young` đã bị nghẽn bởi hunger trước khi level 10 có cơ hội đạt được.

### 3.2 MEDIUM user

Nếu quiz không high score:
- EXP vẫn quá chậm để chạm level 10 sớm.
- Hunger vẫn rơi quá nhanh so với tốc độ lên level.

Nếu quiz high score:
- EXP nhanh hơn, nhưng vẫn không đủ để vượt qua gate hunger trước khi level milestone lớn hơn.

Kết luận:
- `young` vẫn gần như không thể đạt được trong thực tế.

### 3.3 ACTIVE user

Nếu có checkpoint mỗi ngày:
- EXP cực mạnh.
- Tuy nhiên checkpoint không bù hunger.
- Sau 2 ngày:
  - hunger còn khoảng 52
- Sau 3 ngày:
  - hunger rơi xuống khoảng 28

Kết luận:
- Về EXP, active user có thể chạm level 10 tương đối nhanh.
- Về evolution stage, vẫn bị chặn vì hunger gate.

### 3.4 Stage nào quá dễ, hợp lý, quá khó

Đánh giá hiện tại:

| Stage | Đánh giá | Lý do |
|---|---|---|
| baby | Quá dễ | default state gần như luôn ở baby |
| young | Quá khó / gần như không tới | hunger gate chặn trước khi đạt level 10 |
| teen | Quá khó | level + hunger cùng lúc gần như không khớp |
| hero | Quá khó | cần user chăm pet thường xuyên hơn rất nhiều |
| legend | Quá khó | mục tiêu dài hạn nhưng không có đường đi tự nhiên |
| mythic | Quá khó | gần như chỉ là mục tiêu lý thuyết |

Kết luận:
- Evolution hiện tại có “đường số học” nhưng không có “đường gameplay” hợp lý.

## 4. Survivability Audit

### 4.1 Pet có thể chết không?

- Không thấy cơ chế death state trong flow hiện tại của các service đã đọc.
- Health có thể giảm, nhưng với offline cap 24 giờ và decay hiện tại, pet không rơi vào vùng chết trong các mô phỏng dài ngày.

### 4.2 Pet có thể hồi phục hoàn toàn bằng gameplay hiện tại không?

- Có.
- Stat có thể hồi bằng food, item, sleep và reward flow.
- Không có trạng thái irrecoverable.

### 4.3 Có trạng thái nào gần như không thể cứu không?

- Không thấy.
- Tuy nhiên, có một trạng thái thiết kế rất lệch:
  - người chơi bỏ pet hoàn toàn nhưng pet vẫn gần như không xuống cấp dài hạn vì offline cap.

### 4.4 Người chơi quay lại sau 3 tháng có còn động lực chăm pet không?

Rủi ro:
- Pet không bị “phạt” đủ mạnh để tạo cảm giác gắn bó liên tục.
- Vì kết quả sau 90 ngày offline gần như giống 1 ngày offline, người chơi có thể cảm thấy pet không phản ứng tương xứng với sự vắng mặt.

Kết luận:
- Survivability theo kiểu “không thể cứu” thì không có.
- Survivability theo kiểu “quá khoan dung” thì có.

## 5. Risk Assessment

### HIGH

1. Offline cap 24 giờ làm mất hoàn toàn khác biệt giữa 1 ngày và 90 ngày biến mất.
   - Tác động: long-term neglect gần như vô nghĩa.
   - Bằng chứng: `capMinutes = 1440` trong seed config và `applyPetDecay()` cắt toàn bộ elapsed time lớn hơn cap.

2. Evolution bị khóa bởi hunger gate trong khi reward loop không bù hunger.
   - Tác động: stage progression gần như không đi được trong các profile học tập thông thường.
   - Bằng chứng: stage cần `minHunger` tăng dần, nhưng rewardService hiện không cấp hunger cho các learning rewards.

3. Learning path checkpoint là nguồn pet EXP quá lớn so với các nguồn còn lại.
   - Tác động: economy lệch mạnh về path completion.
   - Bằng chứng: checkpoint mặc định cho `100 petExp`, mountain `250 petExp`.

### MEDIUM

1. Logic sleep thủ công không phải lúc nào cũng ép trạng thái ngủ.
   - Tác động: semantic của action `sleep` khó hiểu.
   - Bằng chứng: `validateActionGate()` chỉ chặn khi energy quá cao, còn `resolveSleepingState()` vẫn quyết định cuối cùng theo energy và state cũ.

2. Offline simulation chỉ mang tính “một lần sync 24h”, không phản ánh hành vi dài hạn.
   - Tác động: người đọc dễ hiểu nhầm rằng hệ thống có decay dài hạn.

3. `happy` mood là derived state đúng hướng, nhưng vì stats ít biến động mạnh, mood rất ổn định.
   - Tác động: cảm xúc pet ít dao động, giảm độ “companion”.

### LOW

1. Pet không có death state.
   - Tác động: phù hợp mô hình nhẹ nhàng, nhưng giảm tính hậu quả.

2. Các mức reward quiz/assignment đã tách threshold riêng.
   - Tác động: tốt hơn trước, không phải vấn đề.

## 6. Recommendation

Không sửa code trong phase này, chỉ ghi nhận:

1. Nếu muốn pet thật sự là companion dài hạn, cần bỏ hoặc tăng đáng kể offline cap 24 giờ, hoặc chuyển sang cơ chế decay tích lũy theo thời gian thực thay vì chặn cứng.
2. Nếu muốn evolution có ý nghĩa, cần một nguồn bù hunger rõ ràng trong gameplay học tập hoặc nới threshold hunger theo stage.
3. Cần cân nhắc lại vai trò của learning path checkpoint vì hiện tại nó là nguồn pet EXP áp đảo.
4. Nên làm rõ semantics của action `sleep` để người chơi hiểu đây là “chuyển sang ngủ” chứ không chỉ là một lần hồi energy.
5. Nếu mục tiêu là ít áp lực đăng nhập, hệ thống hiện tại đã đạt được điều đó, nhưng đánh đổi bằng việc pet gần như không có hậu quả dài hạn.

## 7. Kết luận cuối

Hệ thống Pet hiện tại đang ở trạng thái:
- dễ sống,
- khó hỏng,
- khó xuống cấp dài hạn,
- nhưng cũng rất khó tạo cảm giác tiến hóa tự nhiên.

Vấn đề lớn nhất không nằm ở EXP curve đơn lẻ mà nằm ở sự lệch giữa:
- reward economy,
- hunger gate,
- offline cap,
- và evolution requirements.

Nếu không đổi gameplay ở các phase sau, pet sẽ tiếp tục nghiêng về mô hình “companion nhẹ nhàng” hơn là “pet progression system” đúng nghĩa.
