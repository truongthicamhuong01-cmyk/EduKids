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

- Đang đánh boss mà chuyển trang khác quay lại vẫn còn cửa sổ đánh boss, khi nào ấn thoát thì mới ra mục chọn topic
- Khung chat thú cưng di chuyển xuống 20-30px
- Nguyên cụm boss-battle-board lên trên cách top khoảng 20px thôi
- Font size của đề bài -2 size, đáp án -2 size
- Boss đang mất animation

Fix lỗi Responsive
