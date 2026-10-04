export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("CRICZONE BOT OK");
  }

  try {
    const update = req.body;

    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const text = message.text || "";

      if (text === "/start") {
        await sendMessage(
          chatId,
          "🏏 Welcome to CRICZONE!\n\nUse /mention to get the group link."
        );
      }

      if (text === "/mention") {
        await sendMessage(
          chatId,
          "📢 Join CRICZONE HUB 👇",
          {
            inline_keyboard: [
              [
                {
                  text: "🏏 CRICZONE HUB",
                  url: process.env.GROUP_LINK
                }
              ]
            ]
          }
        );
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(200).json({ ok: false });
  }
}

async function sendMessage(chatId, text, reply_markup = null) {
  const url =
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`;

  const body = {
    chat_id: chatId,
    text: text
  };

  if (reply_markup) {
    body.reply_markup = reply_markup;
  }

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}
