export async function onRequest(context) {
  const { request, env } = context;

  // ==================================================
  // BASIC CHECK
  // ==================================================

  if (request.method === "GET") {
    return new Response("CRICZONE ADMIN BOT is running ✅");
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const update = await request.json();

    // ==================================================
    // CHANNEL POST
    // IGNORE CHANNEL POSTS
    // ==================================================
    // Posts made in the Telegram channel must stay in the
    // channel and must NOT be copied into bot chats.

    if (update.channel_post) {
      return new Response("OK");
    }

    // ==================================================
    // INLINE MENU / CALLBACK NAVIGATION
    // ==================================================

    if (update.callback_query) {
      const query = update.callback_query;
      const callbackChatId = query.message?.chat?.id;
      const callbackMessageId = query.message?.message_id;
      const data = query.data || "";
      await trackEvent(env, "callback:" + data.split(":")[0]);

      await answerCallbackQuery(env.BOT_TOKEN, query.id);

      if (!callbackChatId || !callbackMessageId) {
        return new Response("OK");
      }

      if (data === "notifications") {
        if (String(callbackChatId).startsWith("-")) {
          await editMessageText(env.BOT_TOKEN, callbackChatId, callbackMessageId, "🔔 Notification settings are available in your private chat with the bot.", {inline_keyboard:[[{"text":"🏠 Home","callback_data":"menu"}]]});
          return new Response("OK");
        }
        let user={};
        try { const raw=await env.BOT_KV?.get("users:"+callbackChatId); user=raw?JSON.parse(raw):{}; } catch {}
        const p=Object.assign({match_alerts:true,live_updates:true,news:true,promotions:false},user.notification_prefs||{});
        const yn=v=>v?"🟢 ON":"🔕 OFF";
        const buttons=[
          [{text:"🏏 Match Alerts "+yn(p.match_alerts),callback_data:"pref:match_alerts"}],
          [{text:"🔴 Live Updates "+yn(p.live_updates),callback_data:"pref:live_updates"}],
          [{text:"📢 News "+yn(p.news),callback_data:"pref:news"}],
          [{text:"🎁 Promotions "+yn(p.promotions),callback_data:"pref:promotions"}],
          [{text:"🏠 Home",callback_data:"menu"}]
        ];
        await editMessageText(env.BOT_TOKEN,callbackChatId,callbackMessageId,"<b>🔔 NOTIFICATION PREFERENCES</b>\n\nManage your CRICZONE alerts by category.",{inline_keyboard:buttons},"HTML");
        return new Response("OK");
      }

      if (data === "notify_off" || data === "notify_on") {
        if (String(callbackChatId).startsWith("-")) {
          await editMessageText(env.BOT_TOKEN, callbackChatId, callbackMessageId,
            "⚠️ Notification settings can only be changed in your private chat with the bot.",
            { inline_keyboard: [[{ text: "🏠 Home", callback_data: "menu" }]] });
          return new Response("OK");
        }

        const enabled = data === "notify_on";
        let user = {};
        try {
          const raw = await env.BOT_KV?.get("users:" + callbackChatId);
          user = raw ? JSON.parse(raw) : {};
        } catch {}
        user.user_id = callbackChatId;
        user.channel_notifications = enabled ? "on" : "off";
        user.last_active_at = new Date().toISOString();
        user.status = "active";
        if (env.BOT_KV) await env.BOT_KV.put("users:" + callbackChatId, JSON.stringify(user));

        await editMessageText(
          env.BOT_TOKEN, callbackChatId, callbackMessageId,
          enabled ? "🔔 Channel notifications are ON." : "🔕 Channel notifications are OFF.",
          await buildMainMenu(env)
        );
        return new Response("OK");
      }

      if (data === "profile") {
        if (String(callbackChatId).startsWith("-")) {
          await editMessageText(env.BOT_TOKEN, callbackChatId, callbackMessageId,
            "👤 Profile is available in your private chat with the bot.",
            { inline_keyboard: [[{ text: "🏠 Home", callback_data: "menu" }]] });
          return new Response("OK");
        }

        let user = {};
        try {
          const raw = await env.BOT_KV?.get("users:" + callbackChatId);
          user = raw ? JSON.parse(raw) : {};
        } catch {}

        const name = escapeText(user.first_name || query.from?.first_name || "User");
        const username = user.username || query.from?.username;
        const joined = user.joined_at ? new Date(user.joined_at).toLocaleDateString() : "—";
        const notifications = String(user.channel_notifications || "on").toLowerCase() === "off" ? "🔕 OFF" : "🔔 ON";

        await editMessageText(
          env.BOT_TOKEN, callbackChatId, callbackMessageId,
          "<b>👤 MY PROFILE</b>\n\n━━━━━━━━━━━━━━\n<b>Name:</b> " + name
            + "\n<b>Username:</b> " + (username ? "@" + escapeText(username) : "—")
            + "\n<b>User ID:</b> <code>" + callbackChatId + "</code>"
            + "\n<b>Joined:</b> " + joined
            + "\n<b>Notifications:</b> " + notifications
            + "\n━━━━━━━━━━━━━━",
          { inline_keyboard: [
            [{ text: "🔔 Notifications", callback_data: "notifications" }],
            [{ text: "🏠 Home", callback_data: "menu" }]
          ] }, "HTML"
        );
        return new Response("OK");
      }

      if (data === "resume_notifications") {
        if (env.BOT_KV) {
          const raw = await env.BOT_KV.get("users:" + callbackChatId);
          let user = {};
          try { user = raw ? JSON.parse(raw) : {}; } catch {}
          user.user_id = callbackChatId;
          user.channel_notifications = "on";
          user.last_active_at = new Date().toISOString();
          user.status = "active";
          await env.BOT_KV.put("users:" + callbackChatId, JSON.stringify(user));
        }
        await editMessageText(env.BOT_TOKEN, callbackChatId, callbackMessageId, "🔔 Channel notifications are ON again!", await buildMainMenu(env));
        return new Response("OK");
      }

      if (data === "menu") {
        const welcome = await getBotSetting(
          env.BOT_KV,
          "WELCOME_MESSAGE",
          "<b>🏏 WELCOME TO CRICZONE</b>\n\n🔥 Your all-in-one cricket hub\n\n📢 <b>Channels</b>  •  🔴 <b>Live</b>\n📊 <b>Score</b>  •  📅 <b>Schedule</b>\n\n━━━━━━━━━━━━━━\n👇 <b>Choose what you need</b>"
        );

        await editMessageText(
          env.BOT_TOKEN,
          callbackChatId,
          callbackMessageId,
          welcome,
          await buildMainMenu(env),
          "HTML"
        );

        return new Response("OK");
      }

      if (data === "live_match") {
        let match = {};
        try {
          const raw = await env.BOT_KV?.get("settings:LIVE_MATCH");
          match = raw ? JSON.parse(raw) : {};
        } catch {}
        const status = String(match.status || "Not configured");
        const icon = /live/i.test(status) ? "🔴" : /finished|complete/i.test(status) ? "✅" : "🟢";
        const lines = match.team_a && match.team_b
          ? "<b>🏏 LIVE MATCH CENTER</b>\n\n"
            + "<b>" + escapeText(match.team_a) + "</b>  🆚  <b>" + escapeText(match.team_b) + "</b>\n\n"
            + "━━━━━━━━━━━━━━\n"
            + icon + " <b>" + escapeText(status) + "</b>\n"
            + "📊 <b>Score:</b> " + escapeText(match.score || "—") + "\n"
            + "⏱️ <b>Overs:</b> " + escapeText(match.overs || "—") + "\n"
            + "🏏 <b>Batting:</b> " + escapeText(match.batting || "—") + "\n"
            + "🎯 <b>Bowling:</b> " + escapeText(match.bowling || "—") + "\n"
            + (match.note ? "📝 <b>Note:</b> " + escapeText(match.note) + "\n" : "")
            + "━━━━━━━━━━━━━━"
          : "<b>🏏 LIVE MATCH CENTER</b>\n\nNo live match is configured right now.\n\nCheck back when the next match starts!";

        const buttons = [];
        if (match.link) buttons.push([{text:"📺 Watch / Match Link",url:match.link}]);
        buttons.push([{text:"🔄 Refresh",callback_data:"live_match"},{text:"🏠 Home",callback_data:"menu"}]);
        await editMessageText(env.BOT_TOKEN, callbackChatId, callbackMessageId, lines, {inline_keyboard:buttons}, "HTML");
        return new Response("OK");
      }

      if (data === "open:VS_MATCH_LINK") {
        let match = {};
        try {
          const raw = await env.BOT_KV?.get("settings:VS_MATCH");
          match = raw ? JSON.parse(raw) : {};
        } catch {}
        const status = String(match.status || "Upcoming");
        const statusIcon = /live/i.test(status) ? "🔴" : /complete|finished/i.test(status) ? "✅" : "🟢";
        const displayDate = (() => {
          const raw = String(match.date || "").trim();
          const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          return m ? `${m[3]}/${m[2]}/${m[1]}` : (raw || "TBA");
        })();
        const displayTime = (() => {
          const raw = String(match.time || "").trim();
          const m = raw.match(/^(\d{1,2}):(\d{2})$/);
          if (!m) return raw || "TBA";
          let h = Number(m[1]), min = m[2];
          const ap = h >= 12 ? "PM" : "AM";
          h = h % 12 || 12;
          return `${h}:${min} ${ap}`;
        })();
        const text = match.team_a && match.team_b
          ? `<b>⚔️ VS MATCH</b>\n\n🏏 <b>${escapeText(match.team_a)}</b>  🆚  <b>${escapeText(match.team_b)}</b>\n\n━━━━━━━━━━━━━━\n📅 <b>${escapeText(displayDate)}</b>\n⏰ <b>${escapeText(displayTime)}</b>\n📍 <b>${escapeText(match.venue || "TBA")}</b>\n${statusIcon} <b>Status:</b> ${escapeText(status)}\n━━━━━━━━━━━━━━`
          : "⚔️ VS MATCH\n\nNo match has been configured yet.\n\nCheck back soon!";
        const buttons = [];
        const link = match.link || await getLink(env,"VS_MATCH_LINK",env.VS_MATCH_LINK);
        if (link) buttons.push([{text:"🏏 Open Match Link",url:link}]);
        buttons.push([{text:"⬅️ Back",callback_data:"menu"}]);
        await editMessageText(env.BOT_TOKEN,callbackChatId,callbackMessageId,text,{inline_keyboard:buttons});
        return new Response("OK");
      }

      if (data.startsWith("open:")) {
        const key = data.slice(5);

        const labels = {
          GROUP_LINK: "🏏 Join Hub",
          MAIN_CHANNEL_LINK: "📢 Main Channel",
          BACKUP_CHANNEL_LINK: "🔄 Backup Channel",
          VS_MATCH_LINK: "⚔️ VS MATCH",
          LIVE_LINK: "🔴 Live Match",
          SCORE_LINK: "📊 Live Score",
          SCHEDULE_LINK: "📅 Match Schedule",
          STREAM_LINK: "📺 Stream",
          ADMIN_LINK: "👨‍💻 Contact Admin"
        };

        const titles = {
          GROUP_LINK: "🏏 CRICZONE HUB",
          MAIN_CHANNEL_LINK: "📢 CRICZONE MAIN CHANNEL",
          BACKUP_CHANNEL_LINK: "🔄 CRICZONE BACKUP CHANNEL",
          VS_MATCH_LINK: "⚔️ VS MATCH",
          LIVE_LINK: "🔴 LIVE MATCH",
          SCORE_LINK: "📊 LIVE SCORE",
          SCHEDULE_LINK: "📅 MATCH SCHEDULE",
          STREAM_LINK: "📺 STREAMING LINK",
          ADMIN_LINK: "👨‍💻 CONTACT CRICZONE ADMIN"
        };

        const fallback =
          env[key] || "";

        const link = await getLink(
          env,
          key,
          fallback
        );

        if (link) {
          await editMessageText(
            env.BOT_TOKEN,
            callbackChatId,
            callbackMessageId,
            `${titles[key] || "CRICZONE"} 👇`,
            {
              inline_keyboard: [
                [
                  {
                    text: labels[key] || "🔗 Open",
                    url: link
                  }
                ],
                [
                  {
                    text: "⬅️ Back",
                    callback_data: "menu"
                  }
                ]
              ]
            }
          );
        } else {
          await editMessageText(
            env.BOT_TOKEN,
            callbackChatId,
            callbackMessageId,
            "⚠️ Link unavailable\n\nThis destination has not been configured yet.",
            {
              inline_keyboard: [
                [
                  {
                    text: "⬅️ Back",
                    callback_data: "menu"
                  }
                ]
              ]
            }
          );
        }

        return new Response("OK");
      }

      if (data === "all_links") {
        const buttons = [];
        const all = [
          ["🏏 CRICZONE HUB", "GROUP_LINK"],
          ["📢 Main Channel", "MAIN_CHANNEL_LINK"],
          ["🔄 Backup Channel", "BACKUP_CHANNEL_LINK"],
          ["⚔️ VS MATCH", "VS_MATCH_LINK"],
          ["🔴 Live", "LIVE_LINK"],
          ["📊 Score", "SCORE_LINK"],
          ["📅 Schedule", "SCHEDULE_LINK"],
          ["📺 Stream", "STREAM_LINK"]
        ];

        for (const [label, key] of all) {
          const link = await getLink(env, key, env[key]);
          if (link) {
            buttons.push([
              { text: label, callback_data: "open:" + key }
            ]);
          }
        }

        buttons.push([
          { text: "🏠 Home", callback_data: "menu" }
        ]);

        await editMessageText(
          env.BOT_TOKEN,
          callbackChatId,
          callbackMessageId,
          "🔗 CRICZONE IMPORTANT LINKS\n\nChoose a destination below 👇",
          { inline_keyboard: buttons }
        );

        return new Response("OK");
      }

      if (data === "rules") {
        const rules = await getBotSetting(
          env.BOT_KV,
          "RULES_MESSAGE",
          "📜 CRICZONE RULES"
        );

        await editMessageText(
          env.BOT_TOKEN,
          callbackChatId,
          callbackMessageId,
          rules,
          {
            inline_keyboard: [
              [{ text: "🏠 Home", callback_data: "menu" }]
            ]
          }
        );

        return new Response("OK");
      }

      if (data === "about") {
        const about = await getBotSetting(
          env.BOT_KV,
          "ABOUT_MESSAGE",
          "🏏 CRICZONE"
        );

        await editMessageText(
          env.BOT_TOKEN,
          callbackChatId,
          callbackMessageId,
          about,
          {
            inline_keyboard: [
              [{ text: "⬅️ Back", callback_data: "menu" }]
            ]
          }
        );

        return new Response("OK");
      }

      return new Response("OK");
    }

    // ==================================================
    // MESSAGE CHECK
    // ==================================================

    if (!update.message) {
      return new Response("OK");
    }

    const msg = update.message;
    const chatId = msg.chat.id;

    if (chatTypeIsPrivate(msg) && env.BOT_KV && msg.from?.id) {
      const userKey = `users:${msg.from.id}`;
      try {
        const raw = await env.BOT_KV.get(userKey);
        if (raw) {
          const user = JSON.parse(raw);
          user.last_active_at = new Date().toISOString();
          user.status = "active";
          await env.BOT_KV.put(userKey, JSON.stringify(user));
        }
      } catch {}
    }
    const chatType = msg.chat.type;
    const text = (msg.text || "").trim();

    // ==================================================
    // NEW MEMBER
    // ==================================================

    if (
      msg.new_chat_members &&
      msg.new_chat_members.length > 0
    ) {
      const welcomeEnabled = await getBotSetting(env.BOT_KV, "WELCOME_NEW_MEMBERS", "true");
      if (/^(false|0|off|no)$/i.test(String(welcomeEnabled).trim())) return new Response("OK");
      for (const user of msg.new_chat_members) {
        const name = escapeText(
          user.first_name ||
          user.username ||
          "Friend"
        );

        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          `🎉 Welcome to CRICZONE HUB, ${name}! 🏏\n\n❤️ Glad to have you here!\n🔥 Enjoy the cricket community!`
        );
      }

      return new Response("OK");
    }

    // ==================================================
    // MEMBER LEFT
    // ==================================================

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

    // ==================================================
    // NO TEXT
    // ==================================================

    if (!text) {
      return new Response("OK");
    }

    // ==================================================
    // COMMAND
    // ==================================================

    const command = text
      .split(/\s+/)[0]
      .toLowerCase()
      .split("@")[0];

    // ==================================================
    // START
    // ==================================================

    if (command === "/start") {

      if (
        chatType === "private" &&
        env.BOT_KV
      ) {
        await env.BOT_KV.put(
          `users:${chatId}`,
          JSON.stringify({
            user_id: chatId,
            first_name:
              msg.from?.first_name || "",
            username:
              msg.from?.username || "",
            joined_at:
              (await env.BOT_KV.get(`users:${chatId}`).then(raw => { try { return JSON.parse(raw)?.joined_at || new Date().toISOString(); } catch { return new Date().toISOString(); } }).catch(() => new Date().toISOString())),
            last_active_at:
              new Date().toISOString(),
            status: "active",
            notification_prefs: (() => { try { return JSON.parse(oldUserRaw || "{}").notification_prefs || {match_alerts:true,live_updates:true,news:true,promotions:false}; } catch { return {match_alerts:true,live_updates:true,news:true,promotions:false}; } })(),
            channel_notifications: (() => { try { return JSON.parse(oldUserRaw || "{}").channel_notifications || "on"; } catch { return "on"; } })()
          })
        );
      }

      // Keep the bot UI button-based; remove the slash-command menu.
      try {
        await telegramMethod(
          env.BOT_TOKEN,
          "deleteMyCommands",
          {}
        );
      } catch {}

      let welcome = await getBotSetting(
        env.BOT_KV,
        "WELCOME_MESSAGE",
        `🏏 Welcome to CRICZONE!\n\nChoose an option below 👇`
      );

      // Remove the old command-list instruction from saved welcome text.
      welcome = welcome.replace(
        /Use \/help[^\\n]*/gi,
        "👇 Choose an option below"
      );

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        welcome,
        await buildMainMenu(env)
      );

      return new Response("OK");
    }

    // ==================================================
    // NOTIFICATION CONTROLS
    // ==================================================

    if (command === "/stop") {
      if (chatType === "private" && env.BOT_KV) {
        const raw = await env.BOT_KV.get("users:" + chatId);
        let user = {};
        try { user = raw ? JSON.parse(raw) : {}; } catch {}
        user.user_id = chatId;
        user.channel_notifications = "off";
        user.last_active_at = new Date().toISOString();
        user.status = "active";
        await env.BOT_KV.put("users:" + chatId, JSON.stringify(user));
      }
      await sendMessage(env.BOT_TOKEN, chatId, "🔕 Channel notifications paused.\n\nUse /resume anytime to receive CRICZONE channel updates again.", {inline_keyboard:[[ {text:"🔔 Resume Notifications",callback_data:"resume_notifications"} ],[ {text:"🏠 Home",callback_data:"menu"} ]]});
      return new Response("OK");
    }

    if (command === "/resume") {
      if (chatType === "private" && env.BOT_KV) {
        const raw = await env.BOT_KV.get("users:" + chatId);
        let user = {};
        try { user = raw ? JSON.parse(raw) : {}; } catch {}
        user.user_id = chatId;
        user.channel_notifications = "on";
        user.last_active_at = new Date().toISOString();
        user.status = "active";
        await env.BOT_KV.put("users:" + chatId, JSON.stringify(user));
      }
      await sendMessage(env.BOT_TOKEN, chatId, "🔔 Channel notifications are ON again!", await buildMainMenu(env));
      return new Response("OK");
    }

    // ==================================================
    // ==================================================
    // PROFILE / NOTIFICATIONS
    // ==================================================

    if (command === "/profile") {
      if (chatType !== "private") {
        await sendMessage(env.BOT_TOKEN, chatId, "👤 Open the bot in private chat to view your profile.");
        return new Response("OK");
      }
      await sendMessage(env.BOT_TOKEN, chatId,
        "👤 MY PROFILE\n\nTap below to open your profile and notification settings.",
        { inline_keyboard: [
          [{ text: "👤 Open Profile", callback_data: "profile" }],
          [{ text: "🏠 Home", callback_data: "menu" }]
        ] }
      );
      return new Response("OK");
    }

    if (command === "/notifications") {
      if (chatType !== "private") {
        await sendMessage(env.BOT_TOKEN, chatId, "🔔 Open the bot in private chat to manage notifications.");
        return new Response("OK");
      }
      await sendMessage(env.BOT_TOKEN, chatId, "🔔 NOTIFICATION SETTINGS",
        { inline_keyboard: [
          [{ text: "⚙️ Manage Notifications", callback_data: "notifications" }],
          [{ text: "🏠 Home", callback_data: "menu" }]
        ] }
      );
      return new Response("OK");
    }

    // HELP
    // ==================================================

    if (command === "/help") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "<b>🏏 CRICZONE MENU</b>\n\n🔥 Fast access to everything\n\n━━━━━━━━━━━━━━\n👇 <b>Select an option below</b>",
        await buildMainMenu(env)
      );

      return new Response("OK");
    }

    // ==================================================
    // RULES
    // ==================================================

    if (command === "/rules") {
      const rules = await getBotSetting(
        env.BOT_KV,
        "RULES_MESSAGE",
        `📜 CRICZONE HUB — RULES\\n\\n1️⃣ Respect everyone.\\n2️⃣ No spam.\\n3️⃣ No abuse.\\n4️⃣ No fake/scam links.\\n5️⃣ No unwanted promotion.\\n6️⃣ No NSFW.\\n7️⃣ Follow admin instructions.\\n8️⃣ 3 warnings = Permanent Ban 🚫`
      );

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        rules
      );

      return new Response("OK");
    }

    // ==================================================
    // ABOUT
    // ==================================================

    if (command === "/about") {

      const about = await getBotSetting(
        env.BOT_KV,
        "ABOUT_MESSAGE",
        `🏏 CRICZONE\n\nYour cricket community for match updates, live scores, schedules and cricket news.\n\n🔥 Powered by CRICZONE`
      );

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        about
      );

      return new Response("OK");
    }

    // ==================================================
    // GET LINK
    // DASHBOARD VALUE > CLOUDFLARE VARIABLE
    // ==================================================

    // Link helper is declared below as a function so callbacks can use it.


    // ==================================================
    // CHANNEL
    // ==================================================

    if (command === "/channel") {

      const link = await getLink(
        env,
        "MAIN_CHANNEL_LINK",
        env.MAIN_CHANNEL_LINK
      );

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "📢 CRICZONE MAIN CHANNEL 👇",
        singleButton(
          "📢 Main Channel",
          link
        )
      );

      return new Response("OK");
    }

    // ==================================================
    // BACKUP
    // ==================================================

    if (command === "/backup") {

      const link = await getLink(
        env,
        "BACKUP_CHANNEL_LINK",
        env.BACKUP_CHANNEL_LINK
      );

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "🔄 CRICZONE BACKUP CHANNEL 👇",
        singleButton(
          "🔗 Backup Channel",
          link
        )
      );

      return new Response("OK");
    }

    // ==================================================
    // LIVE
    // ==================================================

    if (command === "/live") {

      const link = await getLink(
        env,
        "LIVE_LINK",
        env.LIVE_LINK
      );

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        `🔴 LIVE MATCH

Watch the live match below 👇`,
        singleButton(
          "▶️ WATCH LIVE",
          link
        )
      );

      return new Response("OK");
    }

    // ==================================================
    // SCORE
    // ==================================================

    if (command === "/score") {

      const link = await getLink(
        env,
        "SCORE_LINK",
        env.SCORE_LINK
      );

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "📊 LIVE SCORE 👇",
        singleButton(
          "🏏 CHECK SCORE",
          link
        )
      );

      return new Response("OK");
    }

    // ==================================================
    // SCHEDULE
    // ==================================================

    if (command === "/schedule") {

      const link = await getLink(
        env,
        "SCHEDULE_LINK",
        env.SCHEDULE_LINK
      );

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "📅 MATCH SCHEDULE 👇",
        singleButton(
          "📅 VIEW SCHEDULE",
          link
        )
      );

      return new Response("OK");
    }

    // ==================================================
    // STREAM
    // ==================================================

    if (command === "/stream") {

      const link = await getLink(
        env,
        "STREAM_LINK",
        env.STREAM_LINK
      );

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "📺 STREAMING LINK 👇",
        singleButton(
          "▶️ OPEN STREAM",
          link
        )
      );

      return new Response("OK");
    }

    // ==================================================
    // ALL LINKS
    // ==================================================

    if (command === "/links") {

      const group =
        await getLink(
          env,
          "GROUP_LINK",
          env.GROUP_LINK
        );

      const main =
        await getLink(
          env,
          "MAIN_CHANNEL_LINK",
          env.MAIN_CHANNEL_LINK
        );

      const backup =
        await getLink(
          env,
          "BACKUP_CHANNEL_LINK",
          env.BACKUP_CHANNEL_LINK
        );

      const live =
        await getLink(
          env,
          "LIVE_LINK",
          env.LIVE_LINK
        );

      const score =
        await getLink(
          env,
          "SCORE_LINK",
          env.SCORE_LINK
        );

      const schedule =
        await getLink(
          env,
          "SCHEDULE_LINK",
          env.SCHEDULE_LINK
        );

      const stream =
        await getLink(
          env,
          "STREAM_LINK",
          env.STREAM_LINK
        );

      const buttons = [];

      addButton(
        buttons,
        "🏏 CRICZONE HUB",
        group
      );

      addButton(
        buttons,
        "📢 Main Channel",
        main
      );

      addButton(
        buttons,
        "🔄 Backup Channel",
        backup
      );

      addButton(
        buttons,
        "🔴 Live",
        live
      );

      addButton(
        buttons,
        "📊 Score",
        score
      );

      addButton(
        buttons,
        "📅 Schedule",
        schedule
      );

      addButton(
        buttons,
        "📺 Stream",
        stream
      );

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "🔗 CRICZONE IMPORTANT LINKS 👇",
        {
          inline_keyboard: buttons
        }
      );

      return new Response("OK");
    }

    // ==================================================
    // ADMIN
    // ==================================================

    if (command === "/admin") {

      const link =
        await getLink(
          env,
          "ADMIN_LINK",
          env.ADMIN_LINK
        );

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "👨‍💻 CONTACT CRICZONE ADMIN 👇",
        singleButton(
          "💬 Contact Admin",
          link
        )
      );

      return new Response("OK");
    }

    // ==================================================
    // MENTION
    // ==================================================

    if (command === "/mention") {

      const link =
        await getLink(
          env,
          "GROUP_LINK",
          env.GROUP_LINK
        );

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "📢 JOIN CRICZONE HUB 👇",
        singleButton(
          "🏏 CRICZONE HUB",
          link
        )
      );

      return new Response("OK");
    }

    // ==================================================
    // ID
    // ==================================================

    if (command === "/id") {

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        `🆔 CHAT INFORMATION

Chat ID:
${chatId}

Chat Type:
${chatType}`
      );

      return new Response("OK");
    }

    // ==================================================
    // INFO
    // ==================================================

    if (command === "/info") {

      const user =
        msg.from || {};

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        `👤 USER INFORMATION

Name:
${user.first_name || "N/A"}

Username:
${
  user.username
    ? "@" + user.username
    : "N/A"
}

User ID:
${user.id || "N/A"}`
      );

      return new Response("OK");
    }

    // ==================================================
    // EXTRA BOT COMMANDS
    // ==================================================

    if (command === "/ping") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "🏏 CRICZONE BOT\n\n🟢 Pong! Bot is online."
      );
      return new Response("OK");
    }

    if (command === "/stats") {
      if (!env.BOT_KV) {
        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          "📊 User statistics are unavailable."
        );
        return new Response("OK");
      }

      const userKeys = await listAllKeys(env.BOT_KV, "users:");

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        `📊 CRICZONE BOT STATS\n\n👥 Registered Users: ${userKeys.length}\n🟢 Bot Status: Online\n💾 Storage: Cloudflare KV`
      );

      return new Response("OK");
    }

    if (command === "/menu") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "🏏 CRICZONE MENU\n\nChoose an option below 👇",
        await buildMainMenu(env)
      );

      return new Response("OK");
    }

        // ==================================================
    // MODERATION COMMANDS
    // ==================================================

    const moderationCommands = [
      "/warn",
      "/warnings",
      "/ban",
      "/unban",
      "/mute",
      "/unmute",
      "/kick",
      "/del"
    ];

    if (
      moderationCommands.includes(command)
    ) {

      if (chatType === "private") {

        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          "⚠️ This command can only be used in a group."
        );

        return new Response("OK");
      }

      const admin =
        await isAdmin(
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

      const targetMessage =
        msg.reply_to_message;

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

      const target =
        targetMessage.from;

      const targetId =
        target.id;

      const targetName =
        target.first_name ||
        target.username ||
        "User";

      // ==============================================
      // DON'T MODERATE ADMINS
      // ==============================================

      const targetIsAdmin =
        await isAdmin(
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

      // ==============================================
      // DELETE
      // ==============================================

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

      // ==============================================
      // WARN
      // ==============================================

      if (command === "/warn") {

        if (!env.BOT_KV) {
          return new Response("OK");
        }

        const key =
          `warnings:${chatId}:${targetId}`;

        let warnings =
          Number(
            await env.BOT_KV.get(key)
          ) || 0;

        warnings++;

        if (warnings >= 3) {

          await banUser(
            env.BOT_TOKEN,
            chatId,
            targetId
          );

          await env.BOT_KV.delete(
            key
          );

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
            `⚠️ WARNING ${warnings}/3

👤 ${targetName}

Please follow the group rules.`
          );
        }

        return new Response("OK");
      }

      // ==============================================
      // WARNINGS
      // ==============================================

      if (command === "/warnings") {

        const key =
          `warnings:${chatId}:${targetId}`;

        const warnings =
          Number(
            await env.BOT_KV.get(key)
          ) || 0;

        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          `⚠️ WARNINGS

👤 ${targetName}

📊 ${warnings}/3`
        );

        return new Response("OK");
      }

      // ==============================================
      // BAN
      // ==============================================

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

      // ==============================================
      // UNBAN
      // ==============================================

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

      // ==============================================
      // MUTE
      // ==============================================

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

      // ==============================================
      // UNMUTE
      // ==============================================

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

      // ==============================================
      // KICK
      // ==============================================

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

    // ==================================================
    // AUTO REPLIES
    // ==================================================

    if (!text.startsWith("/")) {

      const lower = text.toLowerCase();

      if (["hi", "hello", "hey"].includes(lower)) {
        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          "<b>🏏 HELLO & WELCOME TO CRICZONE</b> 🔥\n\nYour cricket hub is ready.\n\n━━━━━━━━━━━━━━\n👇 <b>Tap Menu to explore</b>"
        );
        return new Response("OK");
      }

      if (lower === "stats" || lower === "users") {
        const userKeys = env.BOT_KV
          ? await listAllKeys(env.BOT_KV, "users:")
          : [];

        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          `📊 CRICZONE Users: ${userKeys.length}`
        );
        return new Response("OK");
      }

      // LIVE
      if (
        lower.includes("match link") ||
        lower.includes("live link") ||
        lower.includes("match kaha milega") ||
        lower === "live"
      ) {

        const link =
          await getLink(
            env,
            "LIVE_LINK",
            env.LIVE_LINK
          );

        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          "🔴 LIVE MATCH LINKS 👇",
          singleButton(
            "🏏 WATCH LIVE",
            link
          )
        );

        return new Response("OK");
      }

      // BACKUP
      if (
        lower.includes("backup channel") ||
        lower.includes("backup link")
      ) {

        const link =
          await getLink(
            env,
            "BACKUP_CHANNEL_LINK",
            env.BACKUP_CHANNEL_LINK
          );

        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          "🔄 BACKUP CHANNEL 👇",
          singleButton(
            "🔗 JOIN BACKUP",
            link
          )
        );

        return new Response("OK");
      }

      // RULES
      if (
        lower === "rules" ||
        lower.includes("group rules") ||
        lower.includes("rules kya hai")
      ) {

        const rules = await getBotSetting(
          env.BOT_KV,
          "RULES_MESSAGE",
          `📜 CRICZONE RULES\n\n1️⃣ Respect everyone.\n2️⃣ No spam.\n3️⃣ No abuse.\n4️⃣ No fake/scam links.\n5️⃣ No unwanted promotion.\n6️⃣ No NSFW.\n7️⃣ Follow admin instructions.\n8️⃣ 3 warnings = Permanent Ban 🚫`
        );

        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          rules
        );

        return new Response("OK");
      }
    }

    return new Response("OK");

  } catch (error) {

    console.error(
      "Webhook Error:",
      error
    );

    return new Response(
      "Error",
      { status: 500 }
    );
  }
}


// ==================================================
// MAIN INLINE MENU
// ==================================================

async function trackEvent(env, name) {
  try {
    if (!env.BOT_KV) return;
    const key = "metrics:event:" + String(name).slice(0,120).replace(/[^a-zA-Z0-9:_-]/g,"_");
    const current = Number(await env.BOT_KV.get(key)) || 0;
    await env.BOT_KV.put(key, String(current + 1), {expirationTtl: 60*60*24*180});
  } catch {}
}


async function buildMainMenu(env) {
  const defaults = [
    ["🏏 Hub","GROUP_LINK"],["📢 Main","MAIN_CHANNEL_LINK"],
    ["🔴 Live","LIVE_LINK"],["🏏 Live Match","LIVE_MATCH"],["📊 Score","SCORE_LINK"],
    ["⚔️ VS Match","VS_MATCH_LINK"],["📅 Schedule","SCHEDULE_LINK"],
    ["📺 Stream","STREAM_LINK"],["🔄 Backup","BACKUP_CHANNEL_LINK"],
    ["🔗 All Links","ALL_LINKS"],["🔔 Notifications","NOTIFICATIONS"],
    ["👤 My Profile","PROFILE"],["📜 Rules","RULES"],
    ["ℹ️ About","ABOUT"],["👨‍💻 Admin","ADMIN_LINK"]
  ];
  let items = defaults;
  try {
    const raw = await env.BOT_KV?.get("settings:MENU_CONFIG");
    const saved = raw ? JSON.parse(raw) : [];
    if (Array.isArray(saved) && saved.length) {
      items = saved.filter(x => x && x.visible !== false && x.label && x.key)
        .sort((a,b) => Number(a.order||0)-Number(b.order||0))
        .map(x => [String(x.label),String(x.key)]);

      const existingKeys = new Set(items.map(x => x[1]));
      if (!existingKeys.has("LIVE_MATCH")) items.push(["🏏 Live Match", "LIVE_MATCH"]);
      if (!existingKeys.has("NOTIFICATIONS")) items.push(["🔔 Notifications", "NOTIFICATIONS"]);
      if (!existingKeys.has("PROFILE")) items.push(["👤 My Profile", "PROFILE"]);
    }
  } catch {}

  const rows = [];
  let row = [];
  for (const [label,key] of items) {
    const callback = key === "ALL_LINKS" ? "all_links" :
      key === "LIVE_MATCH" ? "live_match" :
      key === "RULES" ? "rules" :
      key === "ABOUT" ? "about" :
      key === "NOTIFICATIONS" ? "notifications" :
      key === "PROFILE" ? "profile" :
      key === "HOME" ? "menu" : "open:" + key;
    row.push({text:label,callback_data:callback});
    if (row.length === 2) { rows.push(row); row=[]; }
  }
  if (row.length) rows.push(row);
  return {inline_keyboard:rows};
}

function chatTypeIsPrivate(msg) {
  return msg?.chat?.type === "private";
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getLink(env, key, fallback) {
  if (!env.BOT_KV) return fallback || "";

  try {
    return (await env.BOT_KV.get("config:" + key)) ||
      fallback ||
      "";
  } catch {
    return fallback || "";
  }
}

async function editMessageText(token, chatId, messageId, text, replyMarkup, parseMode = null) {
  const payload = { chat_id: chatId, message_id: messageId, text, reply_markup: replyMarkup };
  if (parseMode) payload.parse_mode = parseMode;
  return telegramMethod(token, "editMessageText", payload);
}

async function answerCallbackQuery(token, callbackQueryId) {
  return telegramMethod(token, "answerCallbackQuery", {
    callback_query_id: callbackQueryId
  });
}

// ==================================================
// SEND MESSAGE
// ==================================================

async function sendMessage(
  token,
  chatId,
  text,
  replyMarkup = null
) {

  const body = {
    chat_id: chatId,
    text: text
  };

  if (replyMarkup) {
    body.reply_markup =
      replyMarkup;
  }

  return telegramMethod(
    token,
    "sendMessage",
    body
  );
}


// ==================================================
// SINGLE BUTTON
// ==================================================

function singleButton(
  text,
  url
) {

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

function addButton(
  rows,
  text,
  url
) {

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
    .replace(
      /[<>&]/g,
      ""
    );
}


// ==================================================
// CHECK ADMIN
// ==================================================

async function isAdmin(
  token,
  chatId,
  userId
) {

  const response =
    await telegramMethod(
      token,
      "getChatMember",
      {
        chat_id: chatId,
        user_id: userId
      }
    );

  if (!response.ok) {
    return false;
  }

  return (
    response.result.status ===
      "administrator" ||
    response.result.status ===
      "creator"
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

  return telegramMethod(
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
    Math.floor(
      Date.now() / 1000
    ) + 3600;

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


async function listAllKeys(kv, prefix) {
  if (!kv) return [];

  const keys = [];
  let cursor = undefined;

  do {
    const options = { prefix };
    if (cursor) options.cursor = cursor;

    const page = await kv.list(options);
    keys.push(...page.keys);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return keys;
}

async function getBotSetting(kv, key, fallback) {
  if (!kv) return fallback;

  try {
    return (await kv.get(`settings:${key}`)) || fallback;
  } catch {
    return fallback;
  }
}

// ==================================================
// TELEGRAM API
// ==================================================
// Build-safe: only one getLink helper is defined above.

async function telegramMethod(
  token,
  method,
  payload
) {

  const url =
    `https://api.telegram.org/bot${token}/${method}`;

  const response =
    await fetch(
      url,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(payload)
      }
    );

  return response.json();
}
