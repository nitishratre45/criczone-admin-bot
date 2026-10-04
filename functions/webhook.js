export async function onRequest(context) {
  const { request, env } = context;

  // Browser test
  if (request.method === "GET") {
    return new Response("CRICZONE ADMIN BOT is running ✅");
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const update = await request.json();

    if (!update.message) {
      return new Response("OK");
    }

    const message = update.message;
    const chatId = message.chat.id;
    const text = (message.text || "").trim();

    // Remove @BotUsername from commands
    const command = text
      .split(" ")[0]
      .toLowerCase()
      .split("@")[0];

    // =========================
    // START
    // =========================
    if (command === "/start") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "🏏 Welcome to CRICZONE!\n\nUse /help to see all available commands."
      );
    }

    // =========================
    // HELP
    // =========================
    else if (command === "/help") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        `🤖 CRICZONE ADMIN BOT

📌 Available Commands:

/mention - Join CRICZONE HUB
/rules - View group rules
/live - Live match
/score - Live score
/schedule - Match schedule
/links - Important links
/channel - Main channel
/backup - Backup channel
/stream - Streaming link
/admin - Contact admin
/about - About CRICZONE`
      );
    }

    // =========================
    // MENTION
    // =========================
    else if (command === "/mention") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "📢 Join CRICZONE HUB 👇",
        buttons([
          ["🏏 CRICZONE HUB", env.GROUP_LINK]
        ])
      );
    }

    // =========================
    // RULES
    // =========================
    else if (command === "/rules") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        `📜 CRICZONE HUB — GROUP RULES

1️⃣ Respect everyone.
2️⃣ No spam.
3️⃣ No abuse or personal attacks.
4️⃣ No fake/scam links.
5️⃣ No unwanted promotion.
6️⃣ No NSFW content.
7️⃣ Keep discussions related to cricket.
8️⃣ Follow admin/moderator instructions.
9️⃣ 3 warnings = Permanent Ban 🚫
🔟 Admin decision will be final.

⚠️ Please follow the rules and keep the group clean.`
      );
    }

    // =========================
    // LIVE
    // =========================
    else if (command === "/live") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "🔴 LIVE MATCH\n\nWatch the match using the official link below 👇",
        buttons([
          ["▶️ Watch Live", env.LIVE_LINK]
        ])
      );
    }

    // =========================
    // SCORE
    // =========================
    else if (command === "/score") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "🏏 LIVE SCORE\n\nCheck the latest score here 👇",
        buttons([
          ["📊 Live Score", env.SCORE_LINK]
        ])
      );
    }

    // =========================
    // SCHEDULE
    // =========================
    else if (command === "/schedule") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "📅 MATCH SCHEDULE\n\nCheck the latest match schedule 👇",
        buttons([
          ["📅 View Schedule", env.SCHEDULE_LINK]
        ])
      );
    }

    // =========================
    // MAIN CHANNEL
    // =========================
    else if (command === "/channel") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "📢 CRICZONE MAIN CHANNEL 👇",
        buttons([
          ["📢 Main Channel", env.MAIN_CHANNEL_LINK]
        ])
      );
    }

    // =========================
    // BACKUP
    // =========================
    else if (command === "/backup") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "🔄 CRICZONE BACKUP CHANNEL 👇",
        buttons([
          ["🔗 Backup Channel", env.BACKUP_CHANNEL_LINK]
        ])
      );
    }

    // =========================
    // STREAM
    // =========================
    else if (command === "/stream") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "📺 STREAMING\n\nUse the authorized streaming link below 👇",
        buttons([
          ["▶️ Streaming", env.STREAM_LINK]
        ])
      );
    }

    // =========================
    // LINKS
    // =========================
    else if (command === "/links") {
      const rows = [];

      addButton(rows, "🏏 CRICZONE HUB", env.GROUP_LINK);
      addButton(rows, "📢 Main Channel", env.MAIN_CHANNEL_LINK);
      addButton(rows, "🔄 Backup Channel", env.BACKUP_CHANNEL_LINK);
      addButton(rows, "📺 Live", env.LIVE_LINK);
      addButton(rows, "📊 Score", env.SCORE_LINK);
      addButton(rows, "📅 Schedule", env.SCHEDULE_LINK);

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "🔗 CRICZONE IMPORTANT LINKS 👇",
        rows
      );
    }

    // =========================
    // ADMIN
    // =========================
    else if (command === "/admin") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "👨‍💻 CONTACT CRICZONE ADMIN 👇",
        buttons([
          ["💬 Contact Admin", env.ADMIN_LINK]
        ])
      );
    }

    // =========================
    // ABOUT
    // =========================
    else if (command === "/about") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        `🏏 CRICZONE

Your cricket community for:

• Live Updates
• Match Information
• Scores
• Schedules
• Important Links

❤️ Powered by CRICZONE`
      );
    }

    return new Response("OK");

  } catch (error) {
    console.error(error);
    return new Response("Error", { status: 500 });
  }
}


// =====================================
// SEND TELEGRAM MESSAGE
// =====================================

async function sendMessage(token, chatId, text, replyMarkup = null) {

  const url =
    `https://api.telegram.org/bot${token}/sendMessage`;

  const body = {
    chat_id: chatId,
    text: text
  };

  if (replyMarkup && replyMarkup.length > 0) {
    body.reply_markup = {
      inline_keyboard: replyMarkup
    };
  }

  await fetch(url, {
    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify(body)
  });
}


// =====================================
// BUTTON HELPER
// =====================================

function buttons(list) {
  return list
    .filter(item => item[1])
    .map(item => [
      {
        text: item[0],
        url: item[1]
      }
    ]);
}


// =====================================
// MULTIPLE LINK BUTTONS
// =====================================

function addButton(rows, text, url) {
  if (url) {
    rows.push([
      {
        text: text,
        url: url
      }
    ]);
  }
    }
