export async function onRequest(context) {
  const { request, env } = context;

  const cors = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const adminKey = request.headers.get("X-Admin-Key");

  if (!env.ADMIN_KEY || adminKey !== env.ADMIN_KEY) {
    return json({ ok: false, error: "Unauthorized" }, 401, cors);
  }

  try {
    if (request.method === "GET") {
      const url = new URL(request.url);
      const view = url.searchParams.get("view") || "dashboard";
      const search = (url.searchParams.get("q") || "").trim().toLowerCase();

      if (view === "history") {
        const historyKeys = await listAllKeys(env.BOT_KV, "broadcast:");
        const history = [];

        for (const key of historyKeys.slice(-50).reverse()) {
          const raw = await env.BOT_KV.get(key.name);
          try {
            history.push(raw ? JSON.parse(raw) : {});
          } catch {}
        }

        return json({ ok: true, history }, 200, cors);
      }

      if (view === "users") {
        const users = await listAllKeys(env.BOT_KV, "users:");
        const result = [];

        for (const key of users) {
          if (result.length >= 100) break;

          const raw = await env.BOT_KV.get(key.name);
          let user = {};

          try {
            user = raw ? JSON.parse(raw) : {};
          } catch {}

          const haystack = [
            user.first_name || "",
            user.username || "",
            user.user_id || key.name.replace("users:", "")
          ].join(" ").toLowerCase();

          if (!search || haystack.includes(search)) {
            result.push({
              user_id: user.user_id || key.name.replace("users:", ""),
              first_name: user.first_name || "Unknown",
              username: user.username || "",
              joined_at: user.joined_at || ""
            });
          }
        }

        return json({
          ok: true,
          users: result,
          total: users.length
        }, 200, cors);
      }

      const config = {};
      const linkKeys = [
        "ADMIN_LINK",
        "BACKUP_CHANNEL_LINK",
        "GROUP_LINK",
        "LIVE_LINK",
        "MAIN_CHANNEL_LINK",
        "SCORE_LINK",
        "SCHEDULE_LINK",
        "STREAM_LINK",
        "VS_MATCH_LINK"
      ];

      for (const key of linkKeys) {
        const value = env.BOT_KV
          ? await env.BOT_KV.get(`config:${key}`)
          : null;
        config[key] = value || env[key] || "";
      }

      const settings = {
        WELCOME_MESSAGE: await getKV(env.BOT_KV, "settings:WELCOME_MESSAGE", "🏏 Welcome to CRICZONE!\n\nUse /help to see all commands."),
        RULES_MESSAGE: await getKV(env.BOT_KV, "settings:RULES_MESSAGE", "📜 CRICZONE HUB — RULES\n\n1️⃣ Respect everyone.\n2️⃣ No spam.\n3️⃣ No abuse or personal attacks.\n4️⃣ No fake/scam links.\n5️⃣ No unwanted promotion.\n6️⃣ No NSFW content.\n7️⃣ Keep discussion related to cricket.\n8️⃣ Follow admin instructions.\n9️⃣ 3 warnings = Permanent Ban 🚫"),
        ABOUT_MESSAGE: await getKV(env.BOT_KV, "settings:ABOUT_MESSAGE", "🏏 CRICZONE\n\nYour cricket community for match updates, live scores, schedules and cricket news.")
      };

      const users = env.BOT_KV
        ? await listAllKeys(env.BOT_KV, "users:")
        : [];

      return json({
        ok: true,
        bot: { status: "online" },
        users: users.length,
        config,
        settings
      }, 200, cors);
    }

    if (request.method === "POST") {
      const body = await request.json();

      if (body.action === "save_config") {
        if (!env.BOT_KV) {
          return json({ ok: false, error: "BOT_KV is not configured" }, 500, cors);
        }

        const allowed = [
          "ADMIN_LINK",
          "BACKUP_CHANNEL_LINK",
          "GROUP_LINK",
          "LIVE_LINK",
          "MAIN_CHANNEL_LINK",
          "SCORE_LINK",
          "SCHEDULE_LINK",
          "STREAM_LINK",
          "VS_MATCH_LINK"
        ];

        for (const key of allowed) {
          if (typeof body.config?.[key] === "string") {
            await env.BOT_KV.put(`config:${key}`, body.config[key].trim());
          }
        }

        return json({ ok: true, message: "Configuration saved successfully" }, 200, cors);
      }

      if (body.action === "save_settings") {
        if (!env.BOT_KV) {
          return json({ ok: false, error: "BOT_KV is not configured" }, 500, cors);
        }

        const allowed = [
          "WELCOME_MESSAGE",
          "RULES_MESSAGE",
          "ABOUT_MESSAGE"
        ];

        for (const key of allowed) {
          if (typeof body.settings?.[key] === "string") {
            await env.BOT_KV.put(`settings:${key}`, body.settings[key].trim());
          }
        }

        return json({ ok: true, message: "Bot settings saved successfully" }, 200, cors);
      }

      if (body.action === "broadcast") {
        const message = String(body.message || "").trim();

        if (!message) {
          return json({ ok: false, error: "Message is required" }, 400, cors);
        }

        if (!env.BOT_KV) {
          return json({ ok: false, error: "BOT_KV is not configured" }, 500, cors);
        }

        const users = await listAllKeys(env.BOT_KV, "users:");
        let sent = 0;
        let failed = 0;

        for (const key of users) {
          const userId = key.name.replace("users:", "");

          try {
            const result = await telegramMethod(
              env.BOT_TOKEN,
              "sendMessage",
              { chat_id: userId, text: message }
            );

            if (result.ok) sent++;
            else failed++;
          } catch {
            failed++;
          }
        }

        const historyRecord = {
          id: Date.now().toString(),
          created_at: new Date().toISOString(),
          sent,
          failed,
          total: users.length,
          preview: message.slice(0, 160)
        };

        try {
          await env.BOT_KV.put(
            `broadcast:${historyRecord.id}`,
            JSON.stringify(historyRecord),
            { expirationTtl: 60 * 60 * 24 * 30 }
          );
        } catch {}

        return json({
          ok: true,
          sent,
          failed,
          total: users.length
        }, 200, cors);
      }

      if (body.action === "delete_user") {
        const userId = String(body.user_id || "").trim();

        if (!userId || !/^\d+$/.test(userId)) {
          return json({ ok: false, error: "Valid user ID is required" }, 400, cors);
        }

        if (!env.BOT_KV) {
          return json({ ok: false, error: "BOT_KV is not configured" }, 500, cors);
        }

        await env.BOT_KV.delete(`users:${userId}`);

        return json({
          ok: true,
          message: "User removed from registered users"
        }, 200, cors);
      }

      if (body.action === "reset_config") {
        const keys = [
          "ADMIN_LINK",
          "BACKUP_CHANNEL_LINK",
          "GROUP_LINK",
          "LIVE_LINK",
          "MAIN_CHANNEL_LINK",
          "SCORE_LINK",
          "SCHEDULE_LINK",
          "STREAM_LINK",
          "VS_MATCH_LINK"
        ];

        if (env.BOT_KV) {
          for (const key of keys) {
            await env.BOT_KV.delete(`config:${key}`);
          }
        }

        return json({ ok: true, message: "Configuration reset" }, 200, cors);
      }
    }

    return json({ ok: false, error: "Method not allowed" }, 405, cors);
  } catch (error) {
    console.error("Admin API error:", error);
    return json({ ok: false, error: "Internal server error" }, 500, cors);
  }
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

async function getKV(kv, key, fallback) {
  if (!kv) return fallback;
  try {
    return (await kv.get(key)) || fallback;
  } catch {
    return fallback;
  }
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers });
}

async function telegramMethod(token, method, payload) {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  return response.json();
}
