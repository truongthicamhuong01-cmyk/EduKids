```
push code lên github:
git add .
git commit -m "commit's name"
git push

deploy code lên firebase hosting:
cd frontend
npm run build
firebase deploy --only hosting

todo:

Sửa Quiz Boss Battle:

- boss-battle-sidebar__speech lên trên lớp boss-battle-sidebar__card
- Font size của đề bài -2 size, đáp án -2 size
- Boss đang mất animation

Sửa Tạo bài tập giáo viên:
- Khi chuyển trang khác vào lại thì vẫn giữ nguyên dữ liệu trên trang chứ không reset

Sửa Thống kê giáo viên:
- Khi chuyển trang khác vào lại thì vẫn giữ nguyên dữ liệu trên trang chứ không reset rồi lại đọc lại (rất tốn thời gian)
- Thẻ học sinh nổi bật là chỉ hiện các học sinh điểm cao nhất && điểm >= 6
- Thẻ học sinh cần theo dõi là chỉ hiện các học sinh điểm thấp nhất && điểm < 6

Fix lỗi Responsive
```
