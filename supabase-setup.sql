-- ============================================================
-- РРП 3.0 — настройка базы данных Supabase
-- ------------------------------------------------------------
-- КАК ИСПОЛЬЗОВАТЬ:
-- 1. Зайди в свой проект Supabase
-- 2. Слева выбери "SQL Editor" → "New query"
-- 3. Скопируй ВЕСЬ этот файл и нажми "Run"
-- 4. После выполнения заявки будут общими для всех игроков
-- ============================================================

-- Таблица заявок (анкеты)
create table if not exists public.applications (
  id          uuid primary key default gen_random_uuid(),
  ticket      text unique not null,              -- код заявки, напр. K7-42XF
  type        text not null,                     -- moderator | admin
  roblox      text not null,                     -- ник в Roblox
  age         int,
  discord     text,
  tz          text,
  hours       text,
  answers     jsonb default '[]'::jsonb,         -- ответы на вопросы анкеты
  status      text default 'new',                -- new | ok | no
  answer      text default '',                   -- ответ администрации
  answer_date text default '',                   -- дата ответа
  date        text default '',                   -- дата отправки (человекочитаемая)
  created_at  timestamptz default now()
);

-- Таблица настроек (хранит хэш пароля администратора)
create table if not exists public.settings (
  key   text primary key,
  value text
);

-- Включаем Row Level Security
alter table public.applications enable row level security;
alter table public.settings     enable row level security;

-- Разрешаем анонимный доступ (сайт работает без входа игроков).
-- Для публичного RP-проекта этого достаточно.
drop policy if exists "anon_all_applications" on public.applications;
create policy "anon_all_applications"
  on public.applications for all
  using (true) with check (true);

drop policy if exists "anon_all_settings" on public.settings;
create policy "anon_all_settings"
  on public.settings for all
  using (true) with check (true);

-- Индекс для быстрого поиска по коду
create index if not exists idx_applications_ticket on public.applications (ticket);
create index if not exists idx_applications_nick   on public.applications (roblox);

-- Готово! Теперь открой сайт и заполни SUPABASE_URL / SUPABASE_ANON_KEY
-- в файле supabase-config.js
