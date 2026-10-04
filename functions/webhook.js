export async function onRequest(context) {
  const { request, env } = context;

  // =========================
  // BASIC CHECK
  // =========================

  if (request.method === "GET") {
    return new Response("CRICZONE ADMIN BOT is running ✅");
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const update = await request.json();

    // =========================
    // MESSAGE CHECK
    // =========================

    if (!update.message) {
      return new Response("OK");
    }

    const msg = update.message;
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const text = (msg.text || "").trim();

    // =========================
    // NEW MEMBER WELCOME
    // =========================

    if (msg.new_chat_members && msg.new_chat_members.length > 0) {
      for (const user of msg.new_chat_members) {
        const name = escapeText(
          user.first_name || user.username || "Friend"
        );

        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          `🎉 Welcome to CRICZONE HUB, ${name}! 🏏\n❤️ Glad to have you here! 🔥`
        );
      }

      return new Response("OK");
    }

    // =========================
    // MEMBER LEFT
    // =========================

    if (msg.left_chat_member) {
      const name = escapeText(
        msg.left_chat_member.first_name ||
        msg.left_chat_member.username ||
        "Member"
      );

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        `👋 ${name} left CRICZONE HUB.`
      );

      return new Response("OK");
    }

    if (!text) {
      return new Response("OK");
    }

    // =========================
    // COMMAND
    // =========================

    const command = text
      .split(/\s+/)[0]
      .toLowerCase()
      .split("@")[0];

    // =========================
    // START
    // =========================

    if (command === "/start") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "🏏 Welcome to CRICZONE!\n\nUse /help to see all commands."
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

🏏 GENERAL
/start
/help
/mention
/rules
/about
/id
/info

🔗 LINKS
/channel
/backup
/live
/score
/schedule
/stream
/links
/admin

🛡️ MODERATION
/warn
/warnings
/ban
/unban
/mute
/unmute
/kick
/del

⚠️ Moderation commands are for admins only.`
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
        singleButton(
          "🏏 CRICZONE HUB",
          env.GROUP_LINK
        )
      );
    }

    // =========================
    // RULES
    // =========================

    else if (command === "/rules") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        `📜 CRICZONE HUB — RULES

1️⃣ Respect everyone.
2️⃣ No spam.
3️⃣ No abuse or personal attacks.
4️⃣ No fake/scam links.
5️⃣ No unwanted promotion.
6️⃣ No NSFW content.
7️⃣ Keep discussion related to cricket.
8️⃣ Follow admin instructions.
9️⃣ 3 warnings = Permanent Ban 🚫
🔟 Admin decision will be final.

❤️ Keep CRICZONE clean and friendly.`
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

• Match Updates
• Live Scores
• Match Schedule
• Cricket News
• Important Links

❤️ Powered by CRICZONE`
      );
    }

    // =========================
    // CHANNEL
    // =========================

    else if (command === "/channel") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "📢 CRICZONE MAIN CHANNEL 👇",
        singleButton(
          "📢 Main Channel",
          env.MAIN_CHANNEL_LINK
        )
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
        singleButton(
          "🔗 Backup Channel",
          env.BACKUP_CHANNEL_LINK
        )
      );
    }

    // =========================
    // LIVE
    // =========================

    else if (command === "/live") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "🔴 LIVE MATCH\n\nCheck the available link below 👇",
        singleButton(
          "▶️ Watch Live",
          env.LIVE_LINK
        )
      );
    }

    // =========================
    // SCORE
    // =========================

    else if (command === "/score") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "🏏 LIVE SCORE 👇",
        singleButton(
          "📊 Check Score",
          env.SCORE_LINK
        )
      );
    }

    // =========================
    // SCHEDULE
    // =========================

    else if (command === "/schedule") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "📅 MATCH SCHEDULE 👇",
        singleButton(
          "📅 View Schedule",
          env.SCHEDULE_LINK
        )
      );
    }

    // =========================
    // STREAM
    // =========================

    else if (command === "/stream") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "📺 STREAMING LINK 👇",
        singleButton(
          "▶️ Open Stream",
          env.STREAM_LINK
        )
      );
    }

    // =========================
    // LINKS
    // =========================

    else if (command === "/links") {
      const buttons = [];

      addButton(buttons, "🏏 CRICZONE HUB", env.GROUP_LINK);
      addButton(buttons, "📢 Main Channel", env.MAIN_CHANNEL_LINK);
      addButton(buttons, "🔄 Backup Channel", env.BACKUP_CHANNEL_LINK);
      addButton(buttons, "🔴 Live", env.LIVE_LINK);
      addButton(buttons, "📊 Score", env.SCORE_LINK);
      addButton(buttons, "📅 Schedule", env.SCHEDULE_LINK);
      addButton(buttons, "📺 Stream", env.STREAM_LINK);

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "🔗 CRICZONE IMPORTANT LINKS 👇",
        {
          inline_keyboard: buttons
        }
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
        singleButton(
          "💬 Contact Admin",
          env.ADMIN_LINK
        )
      );
    }

    // =========================
    // ID
    // =========================

    else if (command === "/id") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        `🆔 Chat ID:

${chatId}`
      );
    }

    // =========================
    // INFO
    // =========================

    else if (command === "/info") {
      const user = msg.from;

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        `👤 USER INFO

Name: ${user.first_name || "N/A"}
Username: ${user.username ? "@" + user.username : "N/A"}
User ID: ${user.id}`
      );
    }

    // =========================
    // MODERATION
    // =========================

    else if (
      ["/warn", "/warnings", "/ban", "/unban",
       "/mute", "/unmute", "/kick", "/del"]
      .includes(command)
    ) {

      if (chatType === "private") {
        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          "⚠️ This command can only be used in a group."
        );

        return new Response("OK");
      }

      const admin = await isAdmin(
        env.BOT_TOKEN,
        chatId,
        msg.from.id
      );

      if (!admin) {
        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          "🚫 Only group admins can use this command."
        );

        return new Response("OK");
      }

      // =====================
      // TARGET USER
      // =====================

      const targetMessage = msg.reply_to_message;

      if (
        !targetMessage ||
        !targetMessage.from
      ) {
        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          "↩️ Reply to the user's message and use the command."
        );

        return new Response("OK");
      }

      const target = targetMessage.from;
      const targetId = target.id;
      const targetName =
        target.first_name ||
        target.username ||
        "User";

      // Don't moderate admins
      const targetIsAdmin = await isAdmin(
        env.BOT_TOKEN,
        chatId,
        targetId
      );

      if (targetIsAdmin) {
        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          "🛡️ This user is an admin. I won't moderate an admin."
        );

        return new Response("OK");
      }

      // =====================
      // DELETE
      // =====================

      if (command === "/del") {
        await deleteMessage(
          env.BOT_TOKEN,
          chatId,
          targetMessage.message_id
        );

        await deleteMessage(
          env.BOT_TOKEN,
          chatId,
          msg.message_id
        );

        return new Response("OK");
      }

      // =====================
      // WARNINGS
      // =====================

      if (command === "/warn") {

        if (!env.BOT_KV) {
          await sendMessage(
            env.BOT_TOKEN,
            chatId,
            "⚠️ BOT_KV is not configured. Warning system needs Cloudflare KV."
          );

          return new Response("OK");
        }

        const key = `warnings:${chatId}:${targetId}`;

        let warnings =
          Number(await env.BOT_KV.get(key)) || 0;

        warnings++;

        if (warnings >= 3) {

          await banUser(
            env.BOT_TOKEN,
            chatId,
            targetId
          );

          await env.BOT_KV.delete(key);

          await sendMessage(
            env.BOT_TOKEN,
            chatId,
            `🚫 ${targetName} has been permanently banned.

Reason: 3 warnings reached.`
          );

        } else {

          await env.BOT_KV.put(
            key,
            String(warnings)
          );

          await sendMessage(
            env.BOT_TOKEN,
            chatId,
            `⚠️ Warning ${warnings}/3

👤 ${targetName}

Please follow the group rules.`
          );
        }

        return new Response("OK");
      }

      // =====================
      // WARNINGS COUNT
      // =====================

      if (command === "/warnings") {

        if (!env.BOT_KV) {
          await sendMessage(
            env.BOT_TOKEN,
            chatId,
            "⚠️ BOT_KV is not configured."
          );

          return new Response("OK");
        }

        const key =
          `warnings:${chatId}:${targetId}`;

        const warnings =
          Number(await env.BOT_KV.get(key)) || 0;

        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          `⚠️ Warnings

👤 ${targetName}
📊 ${warnings}/3`
        );

        return new Response("OK");
      }

      // =====================
      // BAN
      // =====================

      if (command === "/ban") {

        await banUser(
          env.BOT_TOKEN,
          chatId,
          targetId
        );

        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          `🚫 ${targetName} has been banned.`
        );

        return new Response("OK");
      }

      // =====================
      // UNBAN
      // =====================

      if (command === "/unban") {

        await unbanUser(
          env.BOT_TOKEN,
          chatId,
          targetId
        );

        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          `✅ ${targetName} has been unbanned.`
        );

        return new Response("OK");
      }

      // =====================
      // MUTE
      // =====================

      if (command === "/mute") {

        await muteUser(
          env.BOT_TOKEN,
          chatId,
          targetId
        );

        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          `🔇 ${targetName} has been muted for 1 hour.`
        );

        return new Response("OK");
      }

      // =====================
      // UNMUTE
      // =====================

      if (command === "/unmute") {

        await unmuteUser(
          env.BOT_TOKEN,
          chatId,
          targetId
        );

        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          `🔊 ${targetName} has been unmuted.`
        );

        return new Response("OK");
      }

      // =====================
      // KICK
      // =====================

      if (command === "/kick") {

        await banUser(
          env.BOT_TOKEN,
          chatId,
          targetId
        );

        await unbanUser(
          env.BOT_TOKEN,
          chatId,
          targetId
        );

        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          `👢 ${targetName} has been removed from the group.`
        );

        return new Response("OK");
      }
    }

    // =========================
    // AUTO REPLIES
    // =========================

    if (!text.startsWith("/")) {

      const lower = text.toLowerCase();

      if (
        lower.includes("match link") ||
        lower.includes("live link") ||
        lower.includes("match kaha milega")
      ) {

        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          "🔴 LIVE LINKS HERE 👇",
          singleButton(
            "🏏 Watch Live",
            env.LIVE_LINK
          )
        );
      }

      else if (
        lower.includes("backup channel") ||
        lower.includes("backup link")
      ) {

        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          "🔄 BACKUP CHANNEL 👇",
          singleButton(
            "🔗 Join Backup",
            env.BACKUP_CHANNEL_LINK
          )
        );
      }

      else if (
        lower === "rules" ||
        lower.includes("group rules") ||
        lower.includes("rules kya hai")
      ) {

        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          `📜 CRICZONE RULES

1️⃣ Respect everyone.
2️⃣ No spam.
3️⃣ No abuse.
4️⃣ No fake/scam links.
5️⃣ No unwanted promotion.
6️⃣ No NSFW.
7️⃣ Follow admin instructions.
8️⃣ 3 warnings = Permanent Ban 🚫`
        );
      }
    }

    return new Response("OK");

  } catch (error) {

    console.error(error);

    return new Response(
      "Error",
      { status: 500 }
    );
  }
}


// ==================================================
// TELEGRAM SEND MESSAGE
// ==================================================

async function sendMessage(
  token,
  chatId,
  text,
  replyMarkup = null
) {

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


// ==================================================
// SINGLE BUTTON
// ==================================================

function singleButton(text, url) {

  if (!url) {
    return null;
  }

  return {
    inline_keyboard: [
      [
        {
          text,
          url
        }
      ]
    ]
  };
}


// ==================================================
// ADD BUTTON
// ==================================================

function addButton(rows, text, url) {

  if (!url) {
    return;
  }

  rows.push([
    {
      text,
      url
    }
  ]);
}


// ==================================================
// ESCAPE TEXT
// ==================================================

function escapeText(text) {

  return String(text)
    .replace(/[<>&]/g, "");
}


// ==================================================
// CHECK ADMIN
// ==================================================

async function isAdmin(
  token,
  chatId,
  userId
) {

  const url =
    `https://api.telegram.org/bot${token}/getChatMember` +
    `?chat_id=${encodeURIComponent(chatId)}` +
    `&user_id=${encodeURIComponent(userId)}`;

  const response =
    await fetch(url);

  const data =
    await response.json();

  if (!data.ok) {
    return false;
  }

  return (
    data.result.status === "administrator" ||
    data.result.status === "creator"
  );
}


// ==================================================
// DELETE MESSAGE
// ==================================================

async function deleteMessage(
  token,
  chatId,
  messageId
) {

  await telegramMethod(
    token,
    "deleteMessage",
    {
      chat_id: chatId,
      message_id: messageId
    }
  );
}


// ==================================================
// BAN
// ==================================================

async function banUser(
  token,
  chatId,
  userId
) {

  return telegramMethod(
    token,
    "banChatMember",
    {
      chat_id: chatId,
      user_id: userId
    }
  );
}


// ==================================================
// UNBAN
// ==================================================

async function unbanUser(
  token,
  chatId,
  userId
) {

  return telegramMethod(
    token,
    "unbanChatMember",
    {
      chat_id: chatId,
      user_id: userId,
      only_if_banned: true
    }
  );
}


// ==================================================
// MUTE 1 HOUR
// ==================================================

async function muteUser(
  token,
  chatId,
  userId
) {

  const until =
    Math.floor(Date.now() / 1000) + 3600;

  return telegramMethod(
    token,
    "restrictChatMember",
    {
      chat_id: chatId,
      user_id: userId,

      permissions: {
        can_send_messages: false,
        can_send_audios: false,
        can_send_documents: false,
        can_send_photos: false,
        can_send_videos: false,
        can_send_video_notes: false,
        can_send_voice_notes: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false,
        can_manage_topics: false
      },

      until_date: until
    }
  );
}


// ==================================================
// UNMUTE
// ==================================================

async function unmuteUser(
  token,
  chatId,
  userId
) {

  return telegramMethod(
    token,
    "restrictChatMember",
    {
      chat_id: chatId,
      user_id: userId,

      permissions: {
        can_send_messages: true,
        can_send_audios: true,
        can_send_documents: true,
        can_send_photos: true,
        can_send_videos: true,
        can_send_video_notes: true,
        can_send_voice_notes: true,
        can_send_polls: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true
      }
    }
  );
}


// ==================================================
// TELEGRAM API METHOD
// ==================================================

async function telegramMethod(
  token,
  method,
  payload
) {

  const url =
    `https://api.telegram.org/bot${token}/${method}`;

  const response =
    await fetch(url, {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(payload)
    });

  return response.json();
        }
