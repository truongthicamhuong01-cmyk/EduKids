# PET_PHASE195_EVOLUTION_REBALANCE_DESIGN_AUDIT.md

Thiết kế và audit cho Phase 1.95 dựa trên các phát hiện từ:
- Phase 1.8 Economy Audit
- Phase 1.85 Balance Pass
- Phase 1.86 Long-Term Audit
- Phase 1.9 Evolution Audit

Phạm vi:
- Không sửa code
- Không sửa database
- Không sửa API
- Không sửa frontend
- Chỉ đọc code, mô phỏng và đề xuất

## Files đã đọc

Core:
- [backend/src/services/petMathService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petMathService.js)
- [backend/src/services/petService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petService.js)
- [backend/src/services/petDecayService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petDecayService.js)
- [backend/src/services/petOfflineService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petOfflineService.js)
- [backend/src/services/rewardService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/rewardService.js)
- [backend/src/services/petItemEffectService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petItemEffectService.js)

Config:
- [backend/scripts/seed-pet-game-config.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/scripts/seed-pet-game-config.js)

Frontend read-only:
- [frontend/src/pet/renderers/renderPet.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/frontend/src/pet/renderers/renderPet.js)
- [frontend/src/pet/utils/assetResolver.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/frontend/src/pet/utils/assetResolver.js)

## Executive Summary

Kết luận ngắn:
- Current evolution design là `Level + Stats`.
- Trong gameplay thực tế, `hunger` đang là hard gate quá mạnh.
- `health` hiện chủ yếu là hệ quả của hunger, không phải một gate độc lập đáng giữ ở mức hiện tại.
- Evolution stage có tác động tới hiển thị frontend qua `stage -> asset resolver`, nhưng không đem lại reward gameplay đủ mạnh.
- Nếu mục tiêu là “pet companion” cho học sinh tiểu học, mô hình hiện tại cần chuyển từ hard gate sang soft gate hoặc care-based gate.

## 1. Current Evolution Audit

### 1.1 Current stages

Nguồn thực tế:
- [seed-pet-game-config.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/scripts/seed-pet-game-config.js)
- [petMathService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petMathService.js)

Seed hiện tại cho tất cả pet type `horse`, `elephant`, `cat`, `dog` là giống nhau.

| Stage | Min Level | Min Health | Min Happiness | Min Hunger | Notes |
|---|---:|---:|---:|---:|---|
| `baby` | 1 | 0 | 0 | 0 | default stage |
| `young` | 10 | 60 | 50 | 40 | stage đầu sau baby |
| `teen` | 20 | 65 | 55 | 45 | mid progression |
| `hero` | 35 | 70 | 60 | 50 | late mid-game |
| `legend` | 50 | 75 | 65 | 55 | late-game |
| `mythic` | 80 | 80 | 70 | 60 | end-game |

### 1.2 Override theo pet type

Trong seed:
- `evolutionConfig.byPetType` tồn tại cho `horse`, `elephant`, `cat`, `dog`.
- Mỗi pet type đang dùng cùng bộ stage.
- Không thấy bất kỳ pet type nào có threshold riêng.

### 1.3 Runtime normalize có thay đổi gì không

`normalizeStageRules()` trong [petMathService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petMathService.js):
- chỉ map `id`, `minLevel`, `minHealth`, `minHappiness`, `minHunger`, `requiresAchievement`
- sort theo `minLevel`
- không thêm logic mới

Quan trọng:
- `requiresAchievement` được parse nhưng hiện không được dùng trong `calculateEvolutionStage()`.
- Vì vậy stage hiện chỉ phụ thuộc 4 điều kiện: level, health, happiness, hunger.

## 2. Evolution Reachability Audit

### 2.1 Current reality

Từ các audit trước:
- `LIGHT` user gần như không chạm `young`
- `MEDIUM` user chạm `level 10` rất muộn và vẫn fail stage vì hunger/health
- `ACTIVE` user lên level nhanh hơn, nhưng hunger vẫn sập sớm và stage vẫn kẹt ở `baby`

Kết luận thực tế:
- `Young` không đạt được ổn định trong gameplay thường ngày nếu không bù hunger thường xuyên.
- `Teen` gần như không đạt trong normal play.
- `Hero`, `Legend`, `Mythic` là mục tiêu lý thuyết nhiều hơn là thực tế.

### 2.2 Why this happens

Từ [petDecayService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petDecayService.js):
- hunger giảm `1 / giờ`
- energy giảm `1 / giờ` khi awake
- health giảm `0.5 / giờ` khi `hunger < 20` hoặc `energy < 20`

Từ [rewardService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/rewardService.js):
- học tập có reward EXP tốt hơn trước, nhưng không bù hunger theo cùng nhịp
- learning path checkpoint là nguồn EXP lớn, nhưng vẫn không tạo đủ “care buffer” cho evolution stage hiện tại

Vấn đề cốt lõi:
- progression level đi lên theo reward loop
- nhưng evolution stage bị khóa bởi survival stats
- hai hệ thống này đang chạy lệch nhịp

## 3. Hunger Gate Audit

### 3.1 Vai trò hiện tại

Hunger hiện đang đóng 3 vai:
- progression gate
- maintenance mechanic
- punishment mechanic

Trong thực tế:
- vai trò punishment đang lấn át hoàn toàn
- vai trò maintenance chỉ còn ý nghĩa nếu người chơi login và feed đều
- vai trò progression gate đang quá mạnh

### 3.2 Tác động thực tế

Hunger khóa mạnh nhất:
- `young` trước tiên
- sau đó là toàn bộ stage cao hơn

Hunger không tạo “thú vị” nhiều bằng “cản trở”:
- người chơi không cảm thấy mình đang nuôi pet lớn lên
- người chơi chỉ thấy pet tụt stat nếu không chăm đều
- điều này hợp với mô hình hard-core, nhưng không hợp với học sinh tiểu học nếu mục tiêu là companion nhẹ nhàng

### 3.3 Recommendation cho hunger gate

So sánh 4 phương án:

#### A. Giữ nguyên hunger gate
- Ưu:
  - dễ hiểu
  - giữ tính “chăm sóc”
  - không cần thiết kế lại nhiều
- Nhược:
  - current economy không đủ để đạt stage cao
  - progression bị nghẽn rất sớm
  - khiến pet khó trở thành companion
- Phù hợp học sinh tiểu học: thấp

#### B. Giảm threshold hunger
- Ưu:
  - giữ được ý nghĩa chăm sóc
  - dễ cân bằng hơn
  - không phá hoàn toàn design cũ
- Nhược:
  - nếu chỉ giảm nhẹ, vẫn có thể nghẽn ở stage cao
  - phải cân bằng từng stage
- Phù hợp học sinh tiểu học: cao

#### C. Chỉ dùng hunger ở stage đầu
- Ưu:
  - stage đầu còn mang tính chăm pet
  - stage sau bớt áp lực
  - phù hợp “vài tuần đầu học cách nuôi pet”
- Nhược:
  - late-game cần thêm gate khác
  - nếu không có care score, stage sau có thể quá dễ
- Phù hợp học sinh tiểu học: rất cao

#### D. Loại bỏ hunger khỏi evolution
- Ưu:
  - progress rõ ràng theo level
  - dễ đạt stage
  - giảm frustration
- Nhược:
  - mất cảm giác pet companion
  - hunger chỉ còn là stat trang trí / punishment
  - dễ biến evolution thành level grind thuần túy
- Phù hợp học sinh tiểu học: trung bình, nhưng không tối ưu nếu muốn “chăm sóc”

### 3.4 Kết luận về hunger gate

Khuyến nghị:
- không giữ hunger là hard gate cho toàn bộ evolution
- nên dùng hunger như soft maintenance mechanic
- nếu cần gate, chỉ giữ ở `baby -> young` hoặc `baby -> teen`

## 4. Health Gate Audit

### 4.1 Health có hợp lý không

Hiện tại health:
- không giảm trực tiếp theo thời gian nếu stats ổn
- giảm khi hunger/energy thấp
- vì vậy health đang là hệ quả của hunger và energy, không phải một trục gameplay độc lập đủ mạnh

### 4.2 Có nên giữ health cho evolution không

Nếu giữ health như hard gate:
- evolution sẽ càng khó đạt
- người chơi phải vừa nuôi hunger vừa nuôi health
- trong economy hiện tại, điều này tạo thêm một lớp “fail” chứ không tạo thêm chiều sâu

### 4.3 Recommendation về health gate

Đề xuất:
- giữ health như **soft gate** cho early/mid game
- bỏ health khỏi gate của stage đầu
- chỉ giữ health cho stage cuối nếu muốn Mythic có ý nghĩa đặc biệt

Lý do:
- health hiện không tạo quyết định chiến thuật thú vị
- health đang chỉ phản ánh việc người chơi đã để hunger/energy tụt quá lâu
- giữ health làm hard gate sẽ nhân đôi cùng một lỗi thiết kế

## 5. Alternative Evolution Designs

### Model A - Current Style

`Level + Stats`

#### Ưu điểm
- rõ ràng
- ít thay đổi code logic nhất
- dễ giải thích

#### Nhược điểm
- đang fail trong thực tế
- hunger/health làm stage cao gần như unreachable
- có nhiều stat gate trùng vai

#### Phù hợp học sinh tiểu học
- thấp

#### Độ phức tạp triển khai
- thấp nhất

### Model B - Level Focused

`Level` là chính, stats chỉ hỗ trợ nhẹ

#### Ưu điểm
- progression rõ ràng
- stage dễ đạt hơn
- ít frustrate người chơi

#### Nhược điểm
- nếu bỏ quá nhiều stat gate, pet thành leveling toy
- hunger/health mất vai trò

#### Phù hợp học sinh tiểu học
- cao

#### Độ phức tạp triển khai
- thấp đến trung bình

### Model C - Companion Style

`Level + Care Score`

Care Score là derived progression score, lấy từ:
- giữ hunger/energy/health trong vùng an toàn
- chăm sóc đều
- học tập đều
- tương tác với pet

#### Ưu điểm
- đúng tinh thần companion
- không phụ thuộc quá nặng vào hunger hiện tại
- có thể reward người chơi chăm đều mà không ép login hằng ngày
- dễ cân bằng hơn level + stat cứng

#### Nhược điểm
- cần định nghĩa thêm score
- cần tuning reward loop
- triển khai phức tạp hơn

#### Phù hợp học sinh tiểu học
- rất cao

#### Độ phức tạp triển khai
- trung bình

### 5.1 Recommendation

Khuyến nghị chọn:
- **Model C**

Lý do:
- mục tiêu sản phẩm là pet companion, không phải pet survival hard-core
- hiện tại user học đều nhưng không spam item vẫn bị khóa stage
- care score có thể giữ cảm giác chăm sóc mà không bắt user phải “nuôi stat hoàn hảo” liên tục

## 6. Recommended Evolution Thresholds

### 6.1 Design principle

Mục tiêu thiết kế:
- Young đạt được trong vài tuần
- Teen đạt được trong vài tháng
- Hero là mục tiêu trung hạn
- Legend/Mythic là mục tiêu dài hạn

Với economy hiện tại, nếu giữ hard stat gate như cũ thì không đạt mục tiêu trên.
Do đó recommended thresholds phải đi cùng Model C:
- `Level` là cột mốc chính
- `Care Score` là điều kiện mềm hoặc điều kiện bổ trợ
- `Hunger` và `Health` chỉ nên là soft gate cho stage đầu hoặc stage cuối

### 6.2 Recommended threshold table

Đề xuất bảng mới cho Phase 2:

| Stage | Level | Care Score | Health | Happiness | Hunger |
|---|---:|---:|---:|---:|---:|
| `baby` | 1 | 0 | 0 | 0 | 0 |
| `young` | 3 | 20 | 20 | 20 | 20 |
| `teen` | 8 | 40 | 30 | 30 | 20 |
| `hero` | 15 | 60 | 40 | 40 | 15 |
| `legend` | 25 | 80 | 55 | 50 | 10 |
| `mythic` | 40 | 95 | 65 | 60 | 10 |

### 6.3 Why this table

- `young`:
  - dễ đạt trong vài tuần với user bình thường
  - vẫn cần một chút chăm sóc
- `teen`:
  - bắt đầu thể hiện progression rõ
  - không đòi stats hoàn hảo
- `hero`:
  - là mốc trung hạn
  - nên cần care score rõ ràng
- `legend`:
  - là mốc dài hạn
- `mythic`:
  - mục tiêu sưu tầm / endgame

### 6.4 Important caveat

Bảng trên là bảng thiết kế đề xuất.
Nếu vẫn giữ nguyên level curve hiện tại và reward economy hiện tại mà không thêm care score, thì các mốc `hero/legend/mythic` vẫn sẽ rất chậm.

Vì vậy Phase 2 phải đi cùng:
- reward loop cho care score
- hoặc flatten level curve nhẹ
- hoặc cả hai

## 7. Evolution Reward Audit

### 7.1 Current reward state

Hiện tại stage lên không có reward gameplay trực tiếp.

Code hiện tại:
- [petMathService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petMathService.js): chỉ tính stage
- [rewardService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/rewardService.js): reward pet theo activity, không theo stage
- [renderPet.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/frontend/src/pet/renderers/renderPet.js): render `stage` ra UI
- [assetResolver.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/frontend/src/pet/utils/assetResolver.js): dùng `stage`/`level` để resolve asset

Kết luận:
- stage hiện chủ yếu là visual/state progression
- không có “evolution reward” thực sự

### 7.2 Recommended reward types

Đề xuất reward theo stage:

| Stage | Reward type | Lý do |
|---|---|---|
| `young` | badge + small coin + cosmetic unlock | tạo cảm giác tiến bộ sớm |
| `teen` | title + background unlock | tăng nhận diện stage |
| `hero` | animation unlock + cosmetic frame | làm stage đáng nhớ |
| `legend` | badge + rare cosmetic + special pose | giữ động lực trung hạn |
| `mythic` | exclusive title + crown/effect + background | endgame prestige |

### 7.3 Reward type evaluation

#### Badge
- Ưu:
  - rẻ, dễ hiểu, thân thiện với học sinh
- Nhược:
  - không đủ mạnh nếu đứng một mình

#### Title
- Ưu:
  - tạo cảm giác thành tựu
- Nhược:
  - chủ yếu là meta reward

#### Coin
- Ưu:
  - kết nối với economy
- Nhược:
  - dễ gây inflation nếu thưởng quá nhiều

#### Pet cosmetic
- Ưu:
  - rất phù hợp companion game
  - không phá balance
- Nhược:
  - cần asset pipeline

#### Animation unlock
- Ưu:
  - rất mạnh về cảm giác progression
- Nhược:
  - cần frontend/assets

#### Background unlock
- Ưu:
  - mạnh về cảm nhận “lớn lên”
- Nhược:
  - cần asset map đầy đủ

### 7.4 Recommendation cho reward

Khuyến nghị:
- reward chính của evolution nên là cosmetic + badge + title
- coin chỉ nên là phụ, rất nhỏ
- không nên thưởng EXP lớn từ stage up, vì sẽ tạo vòng lặp dễ vỡ

## 8. Recommended Phase 2 Changes

### 8.1 Safe Changes

Có thể triển khai sớm, rủi ro thấp:
- giảm độ cứng của hunger gate ở early stage
- giữ stage data theo `Level + soft stats`
- thêm reward metadata cho stage-up
- cho stage ảnh hưởng tới UI asset rõ hơn
- thêm logging/telemetry cho stage progression

### 8.2 Medium Risk Changes

Cần test:
- chuyển sang `Level + Care Score`
- biến `hunger` và `health` thành derived maintenance factors thay vì hard gates
- thêm reward chain cho stage-up
- thay đổi cadence unlock asset theo stage

### 8.3 High Risk Changes

Có thể làm balance toàn hệ thống đổi hẳn:
- bỏ hoàn toàn hunger khỏi evolution
- flatten level curve mạnh
- thưởng progression lớn từ stage-up
- gắn reward mạnh vào stage để thay thế reward học tập

## 9. Final Recommendation

### 9.1 Recommended Evolution Model

Chọn:
- **Model C - Companion Style**

Lý do:
- phù hợp mục tiêu pet companion cho học sinh tiểu học
- giữ được cảm giác chăm sóc
- không ép user phải login hằng ngày quá gắt
- không làm pet xuống cấp quá nhanh
- có thể mở rộng reward loop tốt hơn

### 9.2 Recommended Threshold Table

Đề xuất cuối cùng:

| Stage | Level | Care Score | Health | Happiness | Hunger |
|---|---:|---:|---:|---:|---:|
| `baby` | 1 | 0 | 0 | 0 | 0 |
| `young` | 3 | 20 | 20 | 20 | 20 |
| `teen` | 8 | 40 | 30 | 30 | 20 |
| `hero` | 15 | 60 | 40 | 40 | 15 |
| `legend` | 25 | 80 | 55 | 50 | 10 |
| `mythic` | 40 | 95 | 65 | 60 | 10 |

### 9.3 Recommended Phase Order

Đề xuất triển khai theo thứ tự:

#### Phase 1.95A
- chuyển từ hard stat gate sang soft gate cho early evolution
- giữ level là cột mốc chính

#### Phase 1.95B
- giới thiệu care score derived từ hành vi chăm pet và học tập
- tune reward loop cho care score

#### Phase 2.0
- thêm evolution reward metadata
- badge/title/cosmetic unlock theo stage

#### Phase 2.1
- cân bằng lại reward economy sau khi progression mới đã hoạt động

## 10. Conclusion

Current evolution system:
- có cấu trúc tốt về mặt code
- nhưng balance hiện tại không đạt mục tiêu gameplay bình thường

Core issue:
- hunger và health đang là hard gate quá mạnh
- stage cao gần như không reachable trong normal play
- reward loop học tập chưa đủ để đẩy evolution theo nhịp mong muốn

Recommendation tổng:
- giữ evolution theo hướng companion
- dùng `Level + Care Score`
- giảm vai trò hard gate của hunger/health
- cho evolution có reward cosmetic rõ ràng
- để `Legend/Mythic` là mục tiêu dài hạn thực sự, không phải stage trên giấy
