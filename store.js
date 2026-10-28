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

/* ---------- Надёжный запрос: таймаут + повторы ---------- */
/* Без этого «Отправка...» могла висеть вечно, а кнопки — молчать. */
async function sbFetch(url, opts = {}, attempts = 6) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    // 4 с: зависшее соединение обрывается быстро, повтор идёт по новому
    const timer = setTimeout(() => ctrl.abort(), 4000);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) return res;
      // 5xx и 429 — временные, повторяем; 4xx — нет
      if (res.status >= 500 && i < attempts - 1) {
        lastErr = new Error("Сервер ответил ошибкой " + res.status);
        await new Promise((r) => setTimeout(r, Math.min(1200, 300 * (i + 1))));
        continue;
      }
      throw new Error("Сервер ответил ошибкой " + res.status);
    } catch (err) {
      clearTimeout(timer);
      if (err && err.message && /Сервер ответил ошибкой 4\d\d/.test(err.message)) throw err;
      lastErr = err && err.name === "AbortError"
        ? new Error("База отвечает медленно — попробуй ещё раз")
        : (err || new Error("Нет связи с базой"));
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, Math.min(1200, 300 * (i + 1))));
        continue;
      }
    }
  }
  throw lastErr || new Error("Нет связи с базой");
}

/* Преобразование строки БД → привычный объект заявки */
function rowToApp(r) {
  // Защита: Supabase может вернуть [] на вставке (например, RLS) —
  // тогда destructuring даёт undefined и далее упал бы на чтении r.id
  if (!r || typeof r !== "object") {
    throw new Error("Supabase не вернул созданную заявку (пустой ответ)");
  }
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

/* ---------- Перенос старых локальных анкет в облако ---------- */
/* Раньше заявки лежали в localStorage — после подключения Supabase
   они «пропадали». Переносим их один раз за сессию, ничего не теряя. */
let _migrated = false;
async function migrateLocalToCloud(cloudApps) {
  if (_migrated || !SB_READY()) return cloudApps;
  _migrated = true;
  let local = [];
  try { local = lsList(); } catch { return cloudApps; }
  if (!local.length) return cloudApps;

  const have = new Set(cloudApps.map((a) => String(a.ticket || "")));
  let out = cloudApps;
  for (const a of local) {
    if (!a || have.has(String(a.ticket || ""))) continue;
    try {
      const res = await sbFetch(sbUrl("?on_conflict=ticket"), {
        method: "POST",
        headers: {
          ...sbHeaders(true),
          Prefer: "return=representation,resolution=ignore-duplicates",
        },
        body: JSON.stringify(appToRow(a)),
      }, 2);
      let body = [];
      try { body = await res.json(); } catch { body = []; }
      const row = Array.isArray(body) ? body[0] : body;
      if (row && typeof row === "object") out = [rowToApp(row), ...out];
    } catch (err) {
      console.warn("Не перенеслась локальная анкета", a.ticket, err);
    }
  }
  if (out !== cloudApps) {
    // Перенесли — помечаем, но локальную копию не стираем (пусть будет бэкапом)
    try { localStorage.setItem("rp_migrated_v1", "1"); } catch {}
  }
  return out;
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
      const res = await sbFetch(sbUrl("?select=*&order=created_at.desc"), {
        headers: sbHeaders(),
      });
      const apps = (await res.json()).map(rowToApp);
      return await migrateLocalToCloud(apps);
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
      /* on_conflict=ticket + ignore-duplicates: если первый запрос дошёл до
         базы, а ответ потерялся — повтор НЕ создаст дубликат анкеты. */
      const res = await sbFetch(sbUrl("?on_conflict=ticket"), {
        method: "POST",
        headers: {
          ...sbHeaders(true),
          Prefer: "return=representation,resolution=ignore-duplicates",
        },
        body: JSON.stringify(appToRow(record)),
      }, 3);
      let body = [];
      try { body = await res.json(); } catch { body = []; }
      const row = Array.isArray(body) ? body[0] : body;
      if (row && typeof row === "object") return rowToApp(row);

      // Пустой ответ — читаем строку по коду (вставилась ли она?)
      try {
        const chk = await fetch(sbUrl(`?ticket=eq.${encodeURIComponent(ticket)}`), {
          headers: sbHeaders(),
        });
        const rows = await chk.json();
        if (rows && rows[0]) return rowToApp(rows[0]);
      } catch { /* игнорируем — вернём локальный объект */ }
      return { ...record, id: record.ticket };
    }

    record.id = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    all.unshift(record);
    lsSave(all);
    return record;
  },

  /* --- обновить заявку (повторы и таймаут — внутри sbFetch) --- */
  async update(id, patch) {
    if (SB_READY()) {
      const row = { ...patch };
      if ("answerDate" in patch) { row.answer_date = patch.answerDate; delete row.answerDate; }
      await sbFetch(sbUrl(`?id=eq.${encodeURIComponent(id)}`), {
        method: "PATCH",
        headers: sbHeaders(),
        body: JSON.stringify(row),
      });
      return;
    }

    const all = lsList();
    const i = all.findIndex((a) => a.id === id);
    if (i !== -1) { all[i] = { ...all[i], ...patch }; lsSave(all); }
  },

  /* --- удалить заявку --- */
  async remove(id) {
    if (SB_READY()) {
      await sbFetch(sbUrl(`?id=eq.${encodeURIComponent(id)}`), {
        method: "DELETE",
        headers: sbHeaders(),
      });
      return;
    }
    lsSave(lsList().filter((a) => a.id !== id));
  },

  /* --- очистить все заявки --- */
  async clear() {
    if (SB_READY()) {
      await sbFetch(sbUrl("?id=neq.00000000-0000-0000-0000-000000000000"), {
        method: "DELETE", headers: sbHeaders(),
      });
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
        const res = await sbFetch(
          `${window.SUPABASE_URL}/rest/v1/settings?key=eq.admin_pass_hash&select=value`,
          { headers: sbHeaders() }, 2
        );
        const rows = await res.json();
        if (rows.length) return rows[0].value === hash;
        // хэша ещё нет — сохраняем пароль по умолчанию
        await sbFetch(`${window.SUPABASE_URL}/rest/v1/settings`, {
          method: "POST",
          headers: sbHeaders(),
          body: JSON.stringify({ key: "admin_pass_hash", value: hash }),
        }, 2);
        return pass === (window.DEFAULT_ADMIN_PASS || "admin123");
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
      // Сначала пробуем обновить существующую строку (с таймаутом 4 с)
      let patchedOk = false, cnt = 0;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);
        const patched = await fetch(
          `${window.SUPABASE_URL}/rest/v1/settings?key=eq.admin_pass_hash`,
          { method: "PATCH", headers: sbHeaders(), body: JSON.stringify({ value: hash }), signal: ctrl.signal }
        );
        clearTimeout(timer);
        cnt = parseInt(patched.headers.get("content-range") || "0", 10);
        patchedOk = patched.ok;
      } catch { /* подвисло — вставим строку заново */ }
      // Если строк не нашлось (0 записей) — вставляем новую
      if (!patchedOk || !cnt) {
        await sbFetch(`${window.SUPABASE_URL}/rest/v1/settings?on_conflict=key`, {
          method: "POST",
          headers: {
            ...sbHeaders(true),
            Prefer: "return=representation,resolution=ignore-duplicates",
          },
          body: JSON.stringify({ key: "admin_pass_hash", value: hash }),
        }, 3);
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
