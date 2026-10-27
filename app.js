/* ============================================================
   РРП 3.0 — общие элементы интерфейса:
   анимированный фон, шапка, подвал, уведомления, утилиты
   ============================================================ */

/* ---------- Анимированный фон ---------- */
(function initBg() {
  const bg = document.createElement("div");
  bg.className = "bg-blobs";
  bg.innerHTML = "<span></span><span></span><span></span>";
  const add = () => document.body.prepend(bg);
  if (document.body) add();
  else document.addEventListener("DOMContentLoaded", add);
})();

/* ---------- Шапка и подвал ---------- */
const NAV_ITEMS = [
  { href: "index.html",   key: "index",   label: "Главная" },
  { href: "anketa.html",  key: "anketa",  label: "Анкеты" },
  { href: "status.html",  key: "status",  label: "Статус анкеты" },
  { href: "rules.html",   key: "rules",   label: "Правила" },
  { href: "updates.html", key: "updates", label: "Обновления" },
  { href: "admin.html",   key: "admin",   label: "Администрация" },
];

function mountLayout(activeKey) {
  const navHtml = NAV_ITEMS.map(
    (i) => `<a href="${i.href}"${i.key === activeKey ? ' class="active"' : ""}>${i.label}</a>`
  ).join("");

  const header = document.createElement("header");
  header.className = "header";
  header.innerHTML = `
    <div class="header__inner">
      <a class="logo" href="index.html">
        <span class="logo__mark">🎮</span>
        <span>${window.PROJECT_NAME || "РРП 3.0"}</span>
      </a>
      <nav class="nav">${navHtml}</nav>
    </div>`;

  const footer = document.createElement("footer");
  footer.className = "footer";
  footer.innerHTML = `© 2026 ${window.PROJECT_NAME || "РРП 3.0"} — ${window.PROJECT_TAGLINE || "Ролевой проект в Roblox"}. Все права защищены.`;

  document.body.prepend(header);
  document.body.append(footer);
}

/* ---------- Уведомление ---------- */
function toast(message, type = "ok") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = "toast toast--" + type;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 4200);
}

/* ---------- Валидация формы ---------- */
function validateForm(form) {
  let ok = true;
  form.querySelectorAll("[required]").forEach((field) => {
    const isCheckbox = field.type === "checkbox";
    const filled = isCheckbox ? field.checked : String(field.value).trim() !== "";
    field.style.borderColor = filled ? "" : "var(--red)";
    if (!filled) ok = false;
  });
  return ok;
}

/* ---------- Проверка Discord-ника ---------- */
function isDiscordTag(v) {
  return /^@?[\w.\-]{2,32}(#\d{4})?$/.test(v.trim());
}

/* ---------- Текущая дата/время строкой ---------- */
function nowStr() {
  return new Date().toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ---------- Экранирование HTML (защита от XSS) ---------- */
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ---------- Индикатор режима хранения ---------- */
function storageBadge() {
  if (typeof Store === "undefined") return "";
  return Store.mode() === "cloud"
    ? `☁️ Облачное хранилище подключено`
    : `⚠️ Локальный режим — заполни supabase-config.js`;
}
