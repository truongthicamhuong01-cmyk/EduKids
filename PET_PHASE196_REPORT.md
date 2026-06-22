# PET_PHASE196_REPORT.md

Phase 1.96 - Evolution Reachability Fix

Mục tiêu:
- Chỉ rebalance evolution thresholds.
- Không đổi API, DB, frontend, hoặc gameplay systems khác.
- Không redesign evolution.

## 1. Code Changes

File đã sửa:
- [backend/scripts/seed-pet-game-config.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/scripts/seed-pet-game-config.js)

File đã đọc để xác minh logic:
- [backend/src/services/petMathService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petMathService.js)
- [PET_PHASE186_AUDIT.md](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/PET_PHASE186_AUDIT.md)
- [PET_PHASE19_EVOLUTION_AUDIT.md](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/PET_PHASE19_EVOLUTION_AUDIT.md)
- [PET_PHASE195_EVOLUTION_REBALANCE_DESIGN_AUDIT.md](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/PET_PHASE195_EVOLUTION_REBALANCE_DESIGN_AUDIT.md)

## 2. Verification

### 2.1 Evolution logic vẫn giữ nguyên

`calculateEvolutionStage()` trong [petMathService.js](C:/Users/ADMIN/Desktop/Code/Website/EduKidsV2/backend/src/services/petMathService.js):
- vẫn sort stage theo `minLevel`
- vẫn chọn highest eligible stage
- vẫn xét `level`, `health`, `happiness`, `hunger`
- không có thay đổi code runtime

Kết luận:
- logic chọn stage không bị regress
- chỉ thay đổi threshold data trong seed config

### 2.2 Backward compatibility

- Không có schema change.
- Không có migration change.
- Existing pet records vẫn load được vì runtime đọc threshold từ config, không từ pet record.
- Save data cũ vẫn hợp lệ.

## 3. Before / After Threshold Table

### 3.1 Current vs New

| Stage | Current Level | Current Health | Current Happiness | Current Hunger | New Level | New Health | New Happiness | New Hunger |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| baby | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| young | 10 | 60 | 50 | 40 | 5 | 30 | 40 | 20 |
| teen | 20 | 65 | 55 | 45 | 12 | 40 | 45 | 20 |
| hero | 35 | 70 | 60 | 50 | 20 | 50 | 50 | 15 |
| legend | 50 | 75 | 65 | 55 | 30 | 60 | 55 | 10 |
| mythic | 80 | 80 | 70 | 60 | 40 | 70 | 60 | 10 |

### 3.2 Pet type override

Đã cập nhật đồng nhất cho:
- horse
- elephant
- cat
- dog

Không có pet type nào bị bỏ sót.

## 4. Reachability Analysis

### 4.1 Mô phỏng sử dụng

Tôi kiểm tra theo 2 lớp:
- conservative learning-only
- normal care loop với food hiện có

Lý do:
- nếu chỉ nhìn reward học tập, hunger/health vẫn làm stage khó đạt
- nếu người chơi có care loop tối thiểu, ta mới thấy stage threshold mới thực sự hoạt động thế nào

### 4.2 Learning-only profiles

#### LIGHT
- Daily login + 1 lesson/day
- Kết quả: không đạt `young`
- Stage vẫn kẹt ở `baby`

#### MEDIUM
- Daily login + 1 lesson/day + 1 quiz/day
- Kết quả: không đạt `young`
- Stage vẫn kẹt ở `baby`

#### ACTIVE
- Daily login + 1 lesson/day + 1 quiz/day + learning path
- Kết quả: level tăng, nhưng stage vẫn không ổn định ở `young` nếu không có care loop
- hunger/health vẫn tụt quá nhanh khi không dùng food

### 4.3 Normal care loop với food hiện có

Tôi mô phỏng thêm với food hiện có để phản ánh gameplay thực tế hơn.

Kết quả:
- `LIGHT`: vẫn không đạt stage cao, dù level tăng dần.
- `MEDIUM`: vẫn không đạt `young` một cách ổn định.
- `ACTIVE`: có thể chạm `young` sớm hơn, khoảng ngày 6 trong mô phỏng có food hằng ngày.

Tuy nhiên:
- `teen`, `hero`, `legend`, `mythic` vẫn chưa trở thành mục tiêu ổn định trong mô phỏng bảo thủ.
- health vẫn là rủi ro chính nếu người chơi không chăm pet đủ thường xuyên.

### 4.4 Kết luận reachability

| Stage | Reachable sau 1.96? | Ghi chú |
|---|---|---|
| Young | Có, nhưng chủ yếu với ACTIVE + care loop | improved rõ rệt |
| Teen | Chưa ổn định | vẫn còn nặng |
| Hero | Chưa thực tế | cần thêm tuning sau |
| Legend | Chưa thực tế | long-term goal thôi |
| Mythic | Chưa thực tế | endgame-only |

## 5. Risk Assessment

### LOW

- Không có API change.
- Không có DB change.
- Không có frontend change.
- Không cần migration.
- Runtime stage logic không đổi.

### MEDIUM

- Balance mới có thể làm stage đến sớm hơn ở một số user active.
- Nếu asset/feedback layer chưa tối ưu, user có thể thấy pet “lớn nhanh” hơn kỳ vọng.
- `young` đã dễ hơn đáng kể, nên cần theo dõi xem progression có bị rút ngắn quá mức hay không.

### HIGH

- `hero`, `legend`, `mythic` vẫn chưa thật sự reachable trong mô phỏng bảo thủ nếu player chỉ chăm ở mức tối thiểu.
- Nếu mục tiêu là “reachability rộng cho normal students”, phase này chưa phải điểm kết thúc cuối cùng.

## 6. Final Verdict

### 6.1 Does evolution now work as a progression system?

Có, ở mức tốt hơn trước.

Lý do:
- stage không còn bị khóa quá muộn như bản cũ
- `young` có thể xuất hiện sớm hơn
- progression curve trở nên có ý nghĩa hơn

### 6.2 Is baby-stage lock largely solved?

Một phần.

Lý do:
- với ACTIVE + normal care loop, `young` đã reachable
- nhưng với LIGHT/MEDIUM hoặc playstyle không chăm pet đều, baby vẫn có thể kéo dài lâu

### 6.3 Are any stages still unrealistic?

Có.

Hiện tại:
- `teen`, `hero`, `legend`, `mythic` vẫn chưa đạt độ realistic mong muốn nếu chỉ dựa trên normal learning loop

### 6.4 Next logical phase after 1.96

Phase tiếp theo nên là:
- thêm một tuning pass nhỏ cho `health`/`hunger` pressure, hoặc
- tăng nhẹ độ bền của pet trong các ngày học đều, hoặc
- thêm một vòng care nhỏ chỉ bằng các stat hiện có, không cần hệ thống mới

Nếu không muốn đụng mechanic mới:
- ưu tiên monitor telemetry 1.96 trước
- sau đó làm một micro-balance pass cho `teen` và `hero`

## 7. Conclusion

Phase 1.96 đã làm đúng phạm vi:
- chỉ thay threshold evolution
- không đổi API / DB / frontend
- không thêm system mới

Tác động thực tế:
- `young` khả dĩ hơn nhiều
- baby-stage lock giảm rõ
- nhưng các stage sau vẫn còn cần thêm tuning nếu mục tiêu là progression thực sự dài hạn cho mọi profile
