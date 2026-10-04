export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "GET") {
    return new Response("CRICZONE ADMIN BOT is running ✅");
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const update = await request.json();

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || "";

      if (text === "/start") {
        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          "🏏 Welcome to CRICZONE!\n\nUse /mention to get the group link."
        );
      }

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
    console.error(error);
    return new Response("Error", { status: 500 });
  }
}

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
