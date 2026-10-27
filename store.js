/* ============================================================
   РРП 3.0 — ЕДИНЫЙ СЛОЙ ДАННЫХ
   ------------------------------------------------------------
   Если Supabase настроен  → заявки хранятся в общей облачной БД
   (видны всем игрокам и админам с любых устройств).
   Если не настроен       → работает на localStorage (локально).
   ============================================================ */

const SB_READY = () =>
  !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY);

const TABLE = "applications";

/* ---------- HTTP-запросы к Supabase REST ---------- */
function sbHeaders(rep = false) {
  const h = {
    apikey: window.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${window.SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
  if (rep) h.Prefer = "return=representation";
  return h;
}

const sbUrl = (params = "") =>
  `${window.SUPABASE_URL}/rest/v1/${TABLE}${params}`;

/* Преобразование строки БД → привычный объект заявки */
function rowToApp(r) {
  return {
    id: r.id,
    ticket: r.ticket,
    type: r.type,
    roblox: r.roblox,
    age: r.age,
    discord: r.discord,
    tz: r.tz,
    hours: r.hours,
    answers: Array.isArray(r.answers) ? r.answers : [],
    status: r.status || "new",
    answer: r.answer || "",
    answerDate: r.answer_date || "",
    date: r.date || "",
  };
}

/* Преобразование объекта заявки → строка БД */
function appToRow(a) {
  return {
    ticket: a.ticket,
    type: a.type,
    roblox: a.roblox,
    age: a.age ?? null,
    discord: a.discord || "",
    tz: a.tz || "",
    hours: a.hours || "",
    answers: a.answers || [],
    status: a.status || "new",
    answer: a.answer || "",
    answer_date: a.answerDate || "",
    date: a.date || "",
  };
}

/* ---------- Локальное хранилище (fallback) ---------- */
const LS_KEY = "rp_applications_v1";
const LS_PASS = "rp_admin_pass_v1";

function lsList() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { return []; }
}
function lsSave(list) { localStorage.setItem(LS_KEY, JSON.stringify(list)); }

/* ---------- Генерация кода заявки ---------- */
function generateTicket(existing = []) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = (n) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  let t;
  do { t = part(2) + "-" + part(4); }
  while (existing.includes(t));
  return t;
}

/* ---------- Хэш пароля ---------- */
async function sha256(text) {
  try {
    const buf = await crypto.subtle.digest(
      "SHA-256", new TextEncoder().encode(text)
    );
    return [...new Uint8Array(buf)]
      .map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // crypto.subtle недоступен (file://) — возвращаем plaintext-маркер
    return "plain:" + text;
  }
}

/* ============================================================
   ПУБЛИЧНОЕ API — все методы асинхронные (await)
   ============================================================ */
const Store = {

  /* --- режим хранения --- */
  mode() { return SB_READY() ? "cloud" : "local"; },

  /* --- список всех заявок --- */
  async list() {
    if (SB_READY()) {
      const res = await fetch(sbUrl("?select=*&order=created_at.desc"), {
        headers: sbHeaders(),
      });
      if (!res.ok) throw new Error("Supabase: " + res.status);
      return (await res.json()).map(rowToApp);
    }
    return lsList();
  },

  /* --- создать заявку --- */
  async create(app) {
    const all = await this.list();
    const ticket = generateTicket(all.map((a) => a.ticket));

    const record = {
      ...app,
      ticket,
      status: "new",
      answer: "",
      answerDate: "",
      date: nowStr(),
    };

    if (SB_READY()) {
      const res = await fetch(sbUrl(), {
        method: "POST",
        headers: sbHeaders(true),
        body: JSON.stringify(appToRow(record)),
      });
      if (!res.ok) throw new Error("Supabase: " + res.status);
      const [row] = await res.json();
      return rowToApp(row);
    }

    record.id = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    all.unshift(record);
    lsSave(all);
    return record;
  },

  /* --- обновить заявку --- */
  async update(id, patch) {
    if (SB_READY()) {
      const row = { ...patch };
      if ("answerDate" in patch) { row.answer_date = patch.answerDate; delete row.answerDate; }
      const res = await fetch(sbUrl(`?id=eq.${encodeURIComponent(id)}`), {
        method: "PATCH",
        headers: sbHeaders(),
        body: JSON.stringify(row),
      });
      if (!res.ok) throw new Error("Supabase: " + res.status);
      return;
    }
    const all = lsList();
    const i = all.findIndex((a) => a.id === id);
    if (i !== -1) { all[i] = { ...all[i], ...patch }; lsSave(all); }
  },

  /* --- удалить заявку --- */
  async remove(id) {
    if (SB_READY()) {
      const res = await fetch(sbUrl(`?id=eq.${encodeURIComponent(id)}`), {
        method: "DELETE",
        headers: sbHeaders(),
      });
      if (!res.ok) throw new Error("Supabase: " + res.status);
      return;
    }
    lsSave(lsList().filter((a) => a.id !== id));
  },

  /* --- очистить все заявки --- */
  async clear() {
    if (SB_READY()) {
      const res = await fetch(sbUrl("?id=neq.00000000-0000-0000-0000-000000000000"), {
        method: "DELETE", headers: sbHeaders(),
      });
      if (!res.ok) throw new Error("Supabase: " + res.status);
      return;
    }
    lsSave([]);
  },

  /* --- найти по коду --- */
  async findByTicket(ticket) {
    const q = String(ticket || "").trim().toUpperCase();
    return (await this.list()).filter(
      (a) => String(a.ticket || "").toUpperCase() === q
    );
  },

  /* --- найти по нику --- */
  async findByNick(nick) {
    const q = String(nick || "").trim().toLowerCase();
    return (await this.list()).filter(
      (a) => String(a.roblox || "").toLowerCase() === q
    );
  },

  /* ============================================================
     АВТОРИЗАЦИЯ АДМИНИСТРАТОРА
     ============================================================ */

  /* Проверить пароль. Для Supabase сравниваем SHA-256,
     хранящийся в таблице settings (пароль не хранится открытым). */
  async checkPass(pass) {
    const hash = await sha256(pass);

    if (SB_READY()) {
      try {
        const res = await fetch(
          `${window.SUPABASE_URL}/rest/v1/settings?key=eq.admin_pass_hash&select=value`,
          { headers: sbHeaders() }
        );
        if (res.ok) {
          const rows = await res.json();
          if (rows.length) return rows[0].value === hash;
          // хэша ещё нет — сохраняем пароль по умолчанию
          await fetch(`${window.SUPABASE_URL}/rest/v1/settings`, {
            method: "POST",
            headers: sbHeaders(),
            body: JSON.stringify({ key: "admin_pass_hash", value: hash }),
          });
          return pass === (window.DEFAULT_ADMIN_PASS || "admin123");
        }
      } catch { /* падаем в локальную проверку */ }
    }

    const stored = localStorage.getItem(LS_PASS);
    if (!stored) return pass === (window.DEFAULT_ADMIN_PASS || "admin123");
    return stored === hash;
  },

  /* Сменить пароль администратора */
  async setPass(pass) {
    const hash = await sha256(pass);

    if (SB_READY()) {
      // Сначала пробуем обновить существующую строку
      const patched = await fetch(
        `${window.SUPABASE_URL}/rest/v1/settings?key=eq.admin_pass_hash`,
        { method: "PATCH", headers: sbHeaders(), body: JSON.stringify({ value: hash }) }
      );
      // Если строк не нашлось (0 записей) — вставляем новую
      const cnt = parseInt(patched.headers.get("content-range") || "0", 10);
      if (!patched.ok || !cnt) {
        await fetch(`${window.SUPABASE_URL}/rest/v1/settings`, {
          method: "POST",
          headers: sbHeaders(true),
          body: JSON.stringify({ key: "admin_pass_hash", value: hash }),
        });
      }
      return;
    }
    localStorage.setItem(LS_PASS, hash);
  },

  /* --- сессия (только для этого вкладки) --- */
  isLogged()  { return sessionStorage.getItem("rp_admin_session") === "1"; },
  login()     { sessionStorage.setItem("rp_admin_session", "1"); },
  logout()    { sessionStorage.removeItem("rp_admin_session"); },
};
