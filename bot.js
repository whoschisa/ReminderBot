const TelegramBot = require("node-telegram-bot-api");
const schedule = require("node-schedule");
const fs = require("fs");
require("dotenv").config();

const token = process.env.TOKEN;

const bot = new TelegramBot(token, { polling: true });

let reminders = [];

/* ---------------- LOAD ---------------- */

if (fs.existsSync("reminders.json")) {
  try {
    reminders = JSON.parse(fs.readFileSync("reminders.json", "utf8"));
  } catch {
    reminders = [];
  }
}

// reschedule on restart
reminders.forEach(scheduleReminder);

/* ---------------- HELPERS ---------------- */

function saveReminders() {
  fs.writeFileSync("reminders.json", JSON.stringify(reminders, null, 2));
}

function scheduleReminder(reminder) {
  const runAt = new Date(reminder.time);

  if (isNaN(runAt.getTime())) return;

  schedule.scheduleJob(runAt, () => {
    bot.sendMessage(
      reminder.chatId,
      `🔔 Reminder!\n\n📝 ${reminder.task}`
    );
  });
}

/* ---------------- START ---------------- */

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    `👋 Welcome to Reminder Bot!

Here are your commands:

➕ /add task | YYYY-MM-DD HH:MM
→ Add a new reminder

📋 /list
→ View all your saved reminders

Example:
/add drink water | 2026-05-31 18:30`
  );
});

/* ---------------- ADD ---------------- */

bot.onText(/\/add (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const input = match[1];

  const [taskPart, timePart] = input.split("|");

  if (!taskPart || !timePart) {
    return bot.sendMessage(
      chatId,
      "❌ Format wrong.\nUse:\n/add task | YYYY-MM-DD HH:MM"
    );
  }

  const task = taskPart.trim();
  const [date, time] = timePart.trim().split(" ");

  if (!date || !time) {
    return bot.sendMessage(chatId, "❌ Invalid date format.");
  }

  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);

  const finalTime = new Date(y, m - 1, d, h, min, 0);

  if (isNaN(finalTime.getTime())) {
    return bot.sendMessage(chatId, "❌ Invalid date/time.");
  }

  const reminder = {
    chatId,
    task,
    time: finalTime.toISOString(),
  };

  reminders.push(reminder);
  saveReminders();
  scheduleReminder(reminder);

  return bot.sendMessage(
    chatId,
    `✅ Reminder set!\n\n📝 ${task}\n⏰ ${finalTime.toLocaleString()}`
  );
});

/* ---------------- LIST ---------------- */

bot.onText(/\/list/, (msg) => {
  const chatId = msg.chat.id;

  const userReminders = reminders.filter(r => r.chatId === chatId);

  if (userReminders.length === 0) {
    return bot.sendMessage(chatId, "📭 No reminders yet.");
  }

  let text = "📋 Your reminders:\n\n";

  userReminders.forEach((r, i) => {
    text += `${i + 1}. 📝 ${r.task}\n⏰ ${new Date(r.time).toLocaleString()}\n\n`;
  });

  bot.sendMessage(chatId, text);
});
