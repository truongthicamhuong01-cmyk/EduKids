const PROFILE_APP_INFO_FOOTER_HTML = `
  <div class="profile-app-info-grid">
    <div class="profile-app-info-brand">
      <div class="profile-app-info-logo" aria-hidden="true">
        <img src="/assets/edukids-icon-192.png" alt="" />
      </div>

      <div class="profile-app-info-copy">
        <strong class="profile-app-info-brand-name">
          <span class="profile-app-info-brand-edu">Edu</span><span class="profile-app-info-brand-kids">Kids</span>
        </strong>
        <p>
          Nền tảng học tập trò chơi hóa\nứng dụng trí tuệ nhân tạo (AI)
        </p>
      </div>
    </div>

    <div class="profile-app-info-column">
      <span>Phiên bản</span>
      <strong>EduKids v1.0.0</strong>

      <span>Ngày phát hành</span>
      <strong>17/06/2026</strong>
    </div>

    <div class="profile-app-info-column">
      <span>Phát triển bởi</span>
      <p class="profile-app-info-author">
        <span>Phạm Trương Anh Vỹ &amp;</span>
        <span>Nguyễn Hồng Minh Khang</span>
      </p>
      <p>Dự thi Tin học trẻ khu vực D2 năm 2026</p>
    </div>

    <div class="profile-app-info-column">
      <span>Liên hệ</span>
      <p>
        Email:
        <a href="mailto:truongthicamhuong01@gmail.com">truongthicamhuong01@gmail.com</a>
      </p>
      <p>
        Zalo:
        <a href="https://zalo.me/0359587847" target="_blank" rel="noreferrer">zalo.me/0359587847</a>
      </p>
      <p>
        Github Repo:
        <a href="https://github.com/truongthicamhuong01-cmyk/EduKids" target="_blank" rel="noreferrer">github.com/EduKids</a>
      </p>
    </div>
  </div>

  <div class="profile-app-info-footer">
    <div class="profile-app-info-divider"></div>
    <p>© 2026 EduKids. All rights reserved.</p>
  </div>
`;

export function renderProfileAppInfoFooter() {
  return PROFILE_APP_INFO_FOOTER_HTML;
}

export function hydrateProfileAppInfoFooters(root = document) {
  root
    .querySelectorAll("[data-shared-profile-app-info-footer]")
    .forEach((slot) => {
      slot.innerHTML = PROFILE_APP_INFO_FOOTER_HTML;
    });
}
