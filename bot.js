const TelegramBot = require("node-telegram-bot-api");
const schedule = require("node-schedule");
const fs = require("fs");
require("dotenv").config();

const token = process.env.token;

const bot = new TelegramBot(token, {
  polling: true,
});

let reminders = [];
let userStates = {};
let tempReminders = {};

// Load reminders
if (fs.existsSync("reminders.json")) {
  reminders = JSON.parse(fs.readFileSync("reminders.json"));
}

// Re-schedule existing reminders
reminders.forEach(scheduleReminder);

function saveReminders() {
  fs.writeFileSync("reminders.json", JSON.stringify(reminders, null, 2));
}

function scheduleReminder(reminder) {
  schedule.scheduleJob(new Date(reminder.time), () => {
    bot.sendMessage(
      reminder.chatId,
      `🔔 Reminder!\n\n📝 ${reminder.task}`
    );
  });
}

// START MENU
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, "👋 Welcome to Reminder Bot!", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "➕ Add Reminder", callback_data: "add" }],
        [{ text: "📋 List Reminders", callback_data: "list" }],
      ],
    },
  });
});

// BUTTON HANDLER
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  bot.answerCallbackQuery(query.id);

  // ADD FLOW
  if (data === "add") {
    userStates[chatId] = "awaiting_task";
    tempReminders[chatId] = {};

    return bot.sendMessage(chatId, "📝 What should I remind you about?");
  }

  // LIST
  if (data === "list") {
    const userReminders = reminders.filter(r => r.chatId === chatId);

    if (userReminders.length === 0) {
      return bot.sendMessage(chatId, "No reminders yet.");
    }

    let text = "📋 Your reminders:\n\n";

    userReminders.forEach((r, i) => {
      text += `${i + 1}. 📝 ${r.task}\n⏰ ${new Date(r.time).toLocaleString()}\n\n`;
    });

    return bot.sendMessage(chatId, text);
  }

  // TIME OPTIONS
  if (data.startsWith("t_")) {
    const task = tempReminders[chatId]?.task;

    if (!task) {
      return bot.sendMessage(chatId, "Something went wrong. Try again.");
    }

    let time = new Date();

    if (data === "t_10") {
      time = new Date(Date.now() + 10 * 60000);
    }

    if (data === "t_60") {
      time = new Date(Date.now() + 60 * 60000);
    }

    if (data === "t_tomorrow") {
      time.setDate(time.getDate() + 1);
      time.setHours(9, 0, 0, 0);
    }

    const reminder = {
      chatId,
      task,
      time: time.toISOString(),
    };

    reminders.push(reminder);
    saveReminders();
    scheduleReminder(reminder);

    delete userStates[chatId];
    delete tempReminders[chatId];

    return bot.sendMessage(
      chatId,
      `✅ Reminder set!\n\n📝 ${task}\n⏰ ${time.toLocaleString()}`
    );
  }
});

// MESSAGE FLOW (TASK INPUT)
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!userStates[chatId]) return;
  if (!text || text.startsWith("/")) return;

  // STEP 1: TASK
  if (userStates[chatId] === "awaiting_task") {
    tempReminders[chatId].task = text;
    userStates[chatId] = "awaiting_time";

    return bot.sendMessage(chatId, "⏰ When should I remind you?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "⏱ In 10 min", callback_data: "t_10" }],
          [{ text: "⏱ In 1 hour", callback_data: "t_60" }],
          [{ text: "📅 Tomorrow 9AM", callback_data: "t_tomorrow" }],
        ],
      },
    });
  }
});