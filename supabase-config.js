/* ============================================================
   РРП 3.0 — НАСТРОЙКИ ПРОЕКТА
   ------------------------------------------------------------
   ⚠️ ЗАПОЛНИ ЭТИ 2 ПОЛЯ, ЧТОБЫ ЗАЯВКИ БЫЛИ ОБЩИЕ ДЛЯ ВСЕХ
   (иначе сайт работает в режиме localStorage — заявки видны
   только с того устройства, где они были отправлены)

   Как получить:
   1. Зайди на https://supabase.com → создай бесплатный проект
   2. В разделе Project Settings → API скопируй:
      - Project URL  → вставь в SUPABASE_URL
      - anon public key → вставь в SUPABASE_ANON_KEY
   3. В SQL Editor выполни файл supabase-setup.sql
   ============================================================ */

window.SUPABASE_URL = "https://vedgmvzwlmqixvrinocr.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZGdtdnp3bG1xaXh2cmlub2NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNTI5MTksImV4cCI6MjEwODYyODkxOX0.p54wRs16mmapd7cncrQxMIaZ0RnVe1Sw4qzhkggAfT0"

/* ---------- Остальные настройки проекта ---------- */
window.PROJECT_NAME    = "РРП 3.0";              // название проекта
window.PROJECT_TAGLINE = "Ролевой проект в Roblox"; // подзаголовок

// Дата открытия сервера для обратного отсчёта на главной
// Формат: ГОД-МЕС-ДЕНЬTЧАС:МИНУТ:СЕКУНД (пусто = отсчёт выключен)
window.SERVER_OPEN_DATE = "";

// Ссылка на Discord (пусто = кнопка скрыта)
window.DISCORD_INVITE = "";

// Пароль администратора по умолчанию (сменить можно в самой панели)
window.DEFAULT_ADMIN_PASS = "admin123";
