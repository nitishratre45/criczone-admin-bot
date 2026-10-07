export async function onRequest(context) {

  const { request, env } = context;

  const cors = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods":
      "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, X-Admin-Key"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: cors
    });
  }

  const adminKey =
    request.headers.get("X-Admin-Key");

  if (
    !env.ADMIN_KEY ||
    adminKey !== env.ADMIN_KEY
  ) {
    return json(
      {
        ok: false,
        error: "Unauthorized"
      },
      401,
      cors
    );
  }

  try {

    // ============================================
    // GET DASHBOARD
    // ============================================

    if (request.method === "GET") {

      const config = {};

      const keys = [
        "ADMIN_LINK",
        "BACKUP_CHANNEL_LINK",
        "GROUP_LINK",
        "LIVE_LINK",
        "MAIN_CHANNEL_LINK",
        "SCORE_LINK",
        "SCHEDULE_LINK",
        "STREAM_LINK"
      ];

      for (const key of keys) {

        const value =
          await env.BOT_KV?.get(
            `config:${key}`
          );

        config[key] =
          value || env[key] || "";
      }

      let userCount = 0;

      if (env.BOT_KV) {

        const users =
          await env.BOT_KV.list({
            prefix: "users:"
          });

        userCount =
          users.keys.length;
      }

      return json(
        {
          ok: true,

          bot: {
            status: "online"
          },

          users: userCount,

          config
        },
        200,
        cors
      );
    }

    // ============================================
    // POST
    // ============================================

    if (request.method === "POST") {

      const body =
        await request.json();

      // ==========================================
      // SAVE LINKS
      // ==========================================

      if (
        body.action === "save_config"
      ) {

        if (!env.BOT_KV) {
          return json(
            {
              ok: false,
              error:
                "BOT_KV is not configured"
            },
            500,
            cors
          );
        }

        const allowed = [
          "ADMIN_LINK",
          "BACKUP_CHANNEL_LINK",
          "GROUP_LINK",
          "LIVE_LINK",
          "MAIN_CHANNEL_LINK",
          "SCORE_LINK",
          "SCHEDULE_LINK",
          "STREAM_LINK"
        ];

        for (
          const key of allowed
        ) {

          if (
            typeof body.config?.[key] ===
            "string"
          ) {

            await env.BOT_KV.put(
              `config:${key}`,
              body.config[key].trim()
            );
          }
        }

        return json(
          {
            ok: true,
            message:
              "Configuration saved successfully"
          },
          200,
          cors
        );
      }

      // ==========================================
      // BROADCAST
      // ==========================================

      if (
        body.action === "broadcast"
      ) {

        const message =
          String(
            body.message || ""
          ).trim();

        if (!message) {
          return json(
            {
              ok: false,
              error:
                "Message is required"
            },
            400,
            cors
          );
        }

        if (!env.BOT_KV) {
          return json(
            {
              ok: false,
              error:
                "BOT_KV is not configured"
            },
            500,
            cors
          );
        }

        const users =
          await env.BOT_KV.list({
            prefix: "users:"
          });

        let sent = 0;
        let failed = 0;

        for (
          const key of users.keys
        ) {

          const userId =
            key.name.replace(
              "users:",
              ""
            );

          try {

            const result =
              await telegramMethod(
                env.BOT_TOKEN,
                "sendMessage",
                {
                  chat_id: userId,
                  text: message
                }
              );

            if (result.ok) {
              sent++;
            } else {
              failed++;
            }

          } catch {
            failed++;
          }
        }

        return json(
          {
            ok: true,
            sent,
            failed,
            total:
              users.keys.length
          },
          200,
          cors
        );
      }

      // ==========================================
      // RESET CONFIG
      // ==========================================

      if (
        body.action === "reset_config"
      ) {

        const keys = [
          "ADMIN_LINK",
          "BACKUP_CHANNEL_LINK",
          "GROUP_LINK",
          "LIVE_LINK",
          "MAIN_CHANNEL_LINK",
          "SCORE_LINK",
          "SCHEDULE_LINK",
          "STREAM_LINK"
        ];

        for (
          const key of keys
        ) {

          if (env.BOT_KV) {
            await env.BOT_KV.delete(
              `config:${key}`
            );
          }
        }

        return json(
          {
            ok: true,
            message:
              "Configuration reset"
          },
          200,
          cors
        );
      }
    }

    return json(
      {
        ok: false,
        error: "Method not allowed"
      },
      405,
      cors
    );

  } catch (error) {

    console.error(
      "Admin API error:",
      error
    );

    return json(
      {
        ok: false,
        error: "Internal server error"
      },
      500,
      cors
    );
  }
}


// ==============================================
// JSON RESPONSE
// ==============================================

function json(
  data,
  status,
  headers
) {

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers
    }
  );
}


// ==============================================
// TELEGRAM
// ==============================================

async function telegramMethod(
  token,
  method,
  payload
) {

  const response =
    await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
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
