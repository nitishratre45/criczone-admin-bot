export default {
  async fetch(request, env) {

    // Normal browser test
    if (request.method === "GET") {
      return new Response("CRICZONE ADMIN BOT is running ✅");
    }

    // Telegram webhook
    if (request.method === "POST") {
      try {
        const update = await request.json();

        if (update.message) {
          const chatId = update.message.chat.id;
          const text = update.message.text || "";

          // /start
          if (text === "/start") {
            await sendMessage(
              env.BOT_TOKEN,
              chatId,
              "🏏 Welcome to CRICZONE!\n\nUse /mention to get the group link.."
            );
          }

          // /mention
          if (text === "/mention") {
            await sendMessage(
              env.BOT_TOKEN,
              chatId,
              "📢 Join CRICZONE HUB 👇",
              {
                inline_keyboard: [
                  [
                    {
                      text: "🏏 CRICZONE HUB",
                      url: env.GROUP_LINK
                    }
                  ]
                ]
              }
            );
          }
        }

        return new Response("OK");
      } catch (error) {
        return new Response("Error", { status: 500 });
      }
    }

    return new Response("Method not allowed", { status: 405 });
  }
};


async function sendMessage(token, chatId, text, replyMarkup = null) {

  const url =
    `https://api.telegram.org/bot${token}/sendMessage`;

  const body = {
    chat_id: chatId,
    text: text
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}
