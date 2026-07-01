import { renderProfileAppInfoFooter } from "../../components/profileAppInfoFooter.js";
import "./landingPage.css";

const landingState = {
  bound: false,
  root: null,
  navigateTo: null,
  clickHandler: null,
};

function createLandingMarkup() {
  return `
    <div class="landing-shell" data-landing-shell>
      <header class="landing-navbar" data-landing-navbar>
        <button type="button" class="landing-brand" data-landing-route="/">
          <img src="/assets/brand.png" alt="EduKids" class="landing-brand-image" />
        </button>

        <nav class="landing-navbar-actions" aria-label="Điều hướng">
          <button type="button" class="landing-nav-link" data-landing-route="/login">
            Đăng nhập
          </button>
          <button type="button" class="landing-nav-link is-accent" data-landing-route="/register">
            Đăng ký
          </button>
        </nav>
      </header>

      <main class="landing-main">
        <section class="landing-section landing-hero" aria-labelledby="landing-hero-title">
          <div class="landing-hero__media">
            <img
              src="/assets/landing-page/1.png"
              alt="EduKids"
              class="landing-hero__image"
              loading="eager"
              decoding="async"
            />
          </div>

          <div class="landing-section__copy">
            <h1 id="landing-hero-title">Biến việc học thành cuộc phiêu lưu kỳ thú ⛰️</h1>
            <button type="button" class="landing-cta" data-landing-route="/login">
              Bắt đầu hành trình 🚀
            </button>
          </div>
        </section>

        <section class="landing-section landing-pillars" aria-label="Four pillars">
          <img
            src="/assets/landing-page/2.png"
            alt="Bốn trụ cột tạo nên EduKids"
            class="landing-pillars__image"
            loading="lazy"
            decoding="async"
          />
        </section>

        <section class="profile-app-info-card" aria-label="Thông tin ứng dụng">
          ${renderProfileAppInfoFooter()}
        </section>
      </main>
    </div>
  `;
}

function handleLandingClick(event) {
  const trigger = event.target.closest("[data-landing-route]");

  if (!trigger) {
    return;
  }

  const route = String(trigger.dataset.landingRoute || "").trim();

  if (!route || typeof landingState.navigateTo !== "function") {
    return;
  }

  event.preventDefault();
  landingState.navigateTo(route);
}

export function renderLandingPage(root, options = {}) {
  if (!(root instanceof HTMLElement)) {
    return;
  }

  landingState.root = root;
  landingState.navigateTo =
    typeof options.navigateTo === "function" ? options.navigateTo : null;

  root.innerHTML = createLandingMarkup();

  if (!landingState.bound) {
    landingState.clickHandler = handleLandingClick;
    root.addEventListener("click", landingState.clickHandler);
    landingState.bound = true;
  }
}

export function clearLandingPage(root = landingState.root) {
  if (root instanceof HTMLElement) {
    root.innerHTML = "";
  }
}
