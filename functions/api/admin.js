export async function onRequest(context) {
  const { request, env } = context;

  const cors = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key"
  };

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

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
        const keys = await listAllKeys(env.BOT_KV, "broadcast:");
        const history = [];
        for (const key of keys.slice(-100).reverse()) {
          const raw = await env.BOT_KV.get(key.name);
          try { if (raw) history.push(JSON.parse(raw)); } catch {}
        }
        return json({ ok: true, history }, 200, cors);
      }

      if (view === "analytics") {
        const users = await listAllKeys(env.BOT_KV, "users:");
        const broadcasts = await listAllKeys(env.BOT_KV, "broadcast:");
        const activity = await listAllKeys(env.BOT_KV, "activity:");
        const now = Date.now();
        const day = 86400000;
        const growth = { today: 0, last7: 0, last30: 0 };
        let active24h = 0;
        let delivered = 0;
        let failed = 0;
        for (const key of users) {
          const raw = await env.BOT_KV.get(key.name);
          try {
            const u = raw ? JSON.parse(raw) : {};
            const t = Date.parse(u.joined_at || "");
            if (!Number.isNaN(t)) {
              if (now - t < day) growth.today++;
              if (now - t < 7 * day) growth.last7++;
              if (now - t < 30 * day) growth.last30++;
            }
            const active = Date.parse(u.last_active_at || "");
            if (!Number.isNaN(active) && now - active < day) active24h++;
          } catch {}
        }
        for (const key of broadcasts) {
          const raw = await env.BOT_KV.get(key.name);
          try {
            const b = raw ? JSON.parse(raw) : {};
            delivered += Number(b.sent || 0);
            failed += Number(b.failed || 0);
          } catch {}
        }
        return json({ ok: true, users: users.length, broadcasts: broadcasts.length, activity: activity.length, growth, active24h, delivered, failed }, 200, cors);
      }

      if (view === "activity") {
        const keys = await listAllKeys(env.BOT_KV, "activity:");
        const logs = [];
        for (const key of keys.slice(-150).reverse()) {
          const raw = await env.BOT_KV.get(key.name);
          try { if (raw) logs.push(JSON.parse(raw)); } catch {}
        }
        return json({ ok: true, logs }, 200, cors);
      }

      if (view === "schedules") {
        const keys = await listAllKeys(env.BOT_KV, "schedule:");
        const schedules = [];
        for (const key of keys) {
          const raw = await env.BOT_KV.get(key.name);
          try { if (raw) schedules.push(JSON.parse(raw)); } catch {}
        }
        schedules.sort((a,b) => String(a.run_at || "").localeCompare(String(b.run_at || "")));
        return json({ ok: true, schedules }, 200, cors);
      }

      if (view === "users") {
        const keys = await listAllKeys(env.BOT_KV, "users:");
        const result = [];
        for (const key of keys) {
          if (result.length >= 250) break;
          const raw = await env.BOT_KV.get(key.name);
          let user = {};
          try { user = raw ? JSON.parse(raw) : {}; } catch {}
          const userId = user.user_id || key.name.replace("users:", "");
          const haystack = [user.first_name || "", user.username || "", userId].join(" ").toLowerCase();
          if (!search || haystack.includes(search)) {
            result.push({
              user_id: userId,
              first_name: user.first_name || "Unknown",
              username: user.username || "",
              joined_at: user.joined_at || "",
              last_active_at: user.last_active_at || "",
              status: user.status || "registered"
            });
          }
        }
        return json({ ok: true, users: result, total: keys.length }, 200, cors);
      }

      if (view === "config") {
        return json(await getDashboardData(env), 200, cors);
      }

      const data = await getDashboardData(env);
      return json(data, 200, cors);
    }

    if (request.method === "POST") {
      let body = {};
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("multipart/form-data")) {
        const form = await request.formData();
        const uploadAction = String(form.get("action") || "");
        if (uploadAction === "upload_media") {
          const file = form.get("file");
          const type = String(form.get("type") || "");
          const chatId = String(env.MEDIA_CHAT_ID || "-1004315653584").trim();
          if (!(file instanceof File)) return json({ok:false,error:"Media file is required"},400,cors);
          if (!["photo","video"].includes(type)) return json({ok:false,error:"Upload type must be photo or video"},400,cors);
          if (!chatId) return json({ok:false,error:"MEDIA_CHAT_ID is not configured in Cloudflare Pages"},500,cors);
          const maxBytes = type === "photo" ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
          if (file.size > maxBytes) return json({ok:false,error:(type === "photo" ? "Photo" : "Video") + " is too large. Max " + (type === "photo" ? "10 MB" : "50 MB")},400,cors);
          const tgForm = new FormData();
          tgForm.append("chat_id", chatId);
          tgForm.append(type, file, file.name || ("criczone-" + type));
          tgForm.append("caption", "CRICZONE Admin Media Upload");
          const method = type === "photo" ? "sendPhoto" : "sendVideo";
          const tg = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/" + method, {method:"POST",body:tgForm});
          const result = await tg.json();
          if (!result.ok) return json({ok:false,error:result.description || "Telegram upload failed"},400,cors);
          const media = type === "photo" ? result.result?.photo?.[result.result.photo.length - 1] : result.result?.video;
          const fileId = media?.file_id || "";
          if (!fileId) return json({ok:false,error:"Telegram did not return a file_id"},500,cors);
          await env.BOT_KV.put("settings:MEDIA_CHAT_ID", chatId);
          try { await telegramMethod(env.BOT_TOKEN, "deleteMessage", {chat_id:chatId, message_id:result.result.message_id}); } catch {}
          await logActivity(env, "media", "Uploaded " + type + " media");
          return json({ok:true,type,file_id:fileId,file_name:file.name || "",size:file.size},200,cors);
        }
        return json({ok:false,error:"Invalid multipart action"},400,cors);
      } else {
        body = await request.json();
      }
      const action = body.action;

      if (!env.BOT_KV && !["health"].includes(action)) {
        return json({ ok: false, error: "BOT_KV is not configured" }, 500, cors);
      }

      if (action === "save_media_chat") {
        const chatId = String(body.chat_id || "").trim();
        if (!chatId) return json({ok:false,error:"Telegram Media Chat ID is required"},400,cors);
        await env.BOT_KV.put("settings:MEDIA_CHAT_ID", chatId);
        await logActivity(env, "media", "Media chat ID updated");
        return json({ok:true,chat_id:chatId},200,cors);
      }

      if (action === "save_config") {
        for (const key of LINK_KEYS) {
          if (typeof body.config?.[key] === "string") await env.BOT_KV.put("config:" + key, body.config[key].trim());
        }
        await logActivity(env, "config", "Links updated");
        return json({ ok: true, message: "Configuration saved successfully" }, 200, cors);
      }

      if (action === "reset_config") {
        for (const key of LINK_KEYS) await env.BOT_KV.delete("config:" + key);
        await logActivity(env, "config", "Links reset");
        return json({ ok: true, message: "Configuration reset" }, 200, cors);
      }

      if (action === "save_settings") {
        for (const key of SETTING_KEYS) {
          if (typeof body.settings?.[key] === "string") await env.BOT_KV.put("settings:" + key, body.settings[key].trim());
        }
        await logActivity(env, "settings", "Bot messages updated");
        return json({ ok: true, message: "Bot settings saved successfully" }, 200, cors);
      }

      if (action === "save_menu") {
        const menu = Array.isArray(body.menu) ? body.menu.slice(0, 30).map((x, i) => ({
          label: String(x.label || "").slice(0, 50),
          key: String(x.key || "").slice(0, 60),
          visible: x.visible !== false,
          order: Number.isFinite(Number(x.order)) ? Number(x.order) : i
        })).filter(x => x.label && x.key) : [];
        await env.BOT_KV.put("settings:MENU_CONFIG", JSON.stringify(menu));
        await logActivity(env, "menu", "User menu updated");
        return json({ ok: true, menu }, 200, cors);
      }

      if (action === "save_vs_match") {
        const match = {
          team_a: String(body.match?.team_a || "").slice(0, 80),
          team_b: String(body.match?.team_b || "").slice(0, 80),
          date: String(body.match?.date || "").slice(0, 40),
          time: String(body.match?.time || "").slice(0, 20),
          venue: String(body.match?.venue || "").slice(0, 120),
          status: String(body.match?.status || "Upcoming").slice(0, 30),
          link: String(body.match?.link || "").trim()
        };
        await env.BOT_KV.put("settings:VS_MATCH", JSON.stringify(match));
        if (match.link) await env.BOT_KV.put("config:VS_MATCH_LINK", match.link);
        await logActivity(env, "vs_match", match.team_a + " vs " + match.team_b);
        return json({ ok: true, match }, 200, cors);
      }

      if (action === "broadcast") {
        return await handleBroadcast(env, body, cors);
      }

      if (action === "save_schedule") {
        const schedule = {
          id: String(body.schedule?.id || Date.now()),
          enabled: body.schedule?.enabled !== false,
          run_at: String(body.schedule?.run_at || ""),
          type: ["text","photo","video"].includes(String(body.schedule?.type)) ? String(body.schedule.type) : "text",
          message: String(body.schedule?.message || "").slice(0, 4000),
          media: String(body.schedule?.media || "").trim().slice(0, 1000),
          button_text: String(body.schedule?.button_text || "").slice(0, 80),
          button_url: String(body.schedule?.button_url || "").trim().slice(0, 2000)
        };
        const runAtMs = Date.parse(schedule.run_at);
        if (!schedule.run_at || !Number.isFinite(runAtMs)) {
          return json({ ok:false, error:"Valid run_at date/time is required" }, 400, cors);
        }
        if (runAtMs <= Date.now()) {
          return json({ ok:false, error:"Scheduled time must be in the future" }, 400, cors);
        }
        if (schedule.button_url && !/^https?:\\/\\//i.test(schedule.button_url)) {
          return json({ ok:false, error:"Button URL must start with http:// or https://" }, 400, cors);
        }
        if ((schedule.type === "photo" || schedule.type === "video") && !schedule.media) {
          return json({ ok:false, error:"Media URL/file_id is required for photo/video" }, 400, cors);
        }
        await env.BOT_KV.put("schedule:" + schedule.id, JSON.stringify(schedule));
        await logActivity(env, "schedule", "Scheduled broadcast saved");
        return json({ ok: true, schedule }, 200, cors);
      }

      if (action === "delete_schedule") {
        const id = String(body.id || "");
        if (id) await env.BOT_KV.delete("schedule:" + id);
        return json({ ok: true }, 200, cors);
      }

      if (action === "delete_user") {
        const userId = String(body.user_id || "").trim();
        if (!/^\d+$/.test(userId)) return json({ ok: false, error: "Valid user ID is required" }, 400, cors);
        await env.BOT_KV.delete("users:" + userId);
        await logActivity(env, "user", "Removed user " + userId);
        return json({ ok: true, message: "User removed" }, 200, cors);
      }

      if (action === "moderate") {
        const chatId = String(body.chat_id || "").trim();
        const userId = String(body.user_id || "").trim();
        const operation = String(body.operation || "");
        if (!chatId || !userId || !["ban","unban","mute","unmute","kick","warn"].includes(operation)) {
          return json({ ok: false, error: "chat_id, user_id and a valid operation are required" }, 400, cors);
        }
        if (operation === "warn") {
          const key = "warnings:" + chatId + ":" + userId;
          const count = (Number(await env.BOT_KV.get(key)) || 0) + 1;
          if (count >= 3) {
            await telegramMethod(env.BOT_TOKEN, "banChatMember", { chat_id: chatId, user_id: userId });
            await env.BOT_KV.delete(key);
          } else {
            await env.BOT_KV.put(key, String(count));
          }
        } else if (operation === "ban" || operation === "kick") {
          await telegramMethod(env.BOT_TOKEN, "banChatMember", { chat_id: chatId, user_id: userId });
          if (operation === "kick") await telegramMethod(env.BOT_TOKEN, "unbanChatMember", { chat_id: chatId, user_id: userId, only_if_banned: true });
        } else if (operation === "unban") {
          await telegramMethod(env.BOT_TOKEN, "unbanChatMember", { chat_id: chatId, user_id: userId, only_if_banned: true });
        } else if (operation === "mute") {
          await telegramMethod(env.BOT_TOKEN, "restrictChatMember", {
            chat_id: chatId, user_id: userId, until_date: Math.floor(Date.now()/1000)+3600,
            permissions: { can_send_messages:false, can_send_audios:false, can_send_documents:false, can_send_photos:false, can_send_videos:false, can_send_video_notes:false, can_send_voice_notes:false, can_send_polls:false, can_send_other_messages:false, can_add_web_page_previews:false }
          });
        } else if (operation === "unmute") {
          await telegramMethod(env.BOT_TOKEN, "restrictChatMember", {
            chat_id: chatId, user_id: userId,
            permissions: { can_send_messages:true, can_send_audios:true, can_send_documents:true, can_send_photos:true, can_send_videos:true, can_send_video_notes:true, can_send_voice_notes:true, can_send_polls:true, can_send_other_messages:true, can_add_web_page_previews:true }
          });
        }
        await logActivity(env, "moderation", operation + " user " + userId);
        return json({ ok: true, operation }, 200, cors);
      }

      if (action === "activity") {
        const keys = await listAllKeys(env.BOT_KV, "activity:");
        const logs = [];
        for (const key of keys.slice(-100).reverse()) {
          const raw = await env.BOT_KV.get(key.name);
          try { if (raw) logs.push(JSON.parse(raw)); } catch {}
        }
        return json({ ok: true, logs }, 200, cors);
      }
    }

    return json({ ok: false, error: "Method not allowed" }, 405, cors);
  } catch (error) {
    console.error("Admin API error:", error);
    return json({ ok: false, error: "Internal server error" }, 500, cors);
  }
}

const LINK_KEYS = [
  "ADMIN_LINK","BACKUP_CHANNEL_LINK","GROUP_LINK","LIVE_LINK","MAIN_CHANNEL_LINK",
  "SCORE_LINK","SCHEDULE_LINK","STREAM_LINK","VS_MATCH_LINK"
];
const SETTING_KEYS = ["WELCOME_MESSAGE","RULES_MESSAGE","ABOUT_MESSAGE","MENU_CONFIG","VS_MATCH","MEDIA_CHAT_ID"];

async function getDashboardData(env) {
  const config = {};
  for (const key of LINK_KEYS) {
    config[key] = await getKV(env.BOT_KV, "config:" + key, env[key] || "");
  }
  const settings = {};
  for (const key of SETTING_KEYS) {
    settings[key] = await getKV(env.BOT_KV, "settings:" + key, defaultSetting(key));
  }
  const users = await listAllKeys(env.BOT_KV, "users:");
  const broadcasts = await listAllKeys(env.BOT_KV, "broadcast:");
  const schedules = await listAllKeys(env.BOT_KV, "schedule:");
  const activity = await listAllKeys(env.BOT_KV, "activity:");
  return { ok:true, bot:{status:"online"}, users:users.length, broadcasts:broadcasts.length, schedules:schedules.length, activity:activity.length, config, settings };
}

function defaultSetting(key) {
  if (key === "WELCOME_MESSAGE") return "🏏 Welcome to CRICZONE!\n\nChoose an option below 👇";
  if (key === "RULES_MESSAGE") return "📜 CRICZONE HUB — RULES\n\n1️⃣ Respect everyone.\n2️⃣ No spam.\n3️⃣ No abuse or personal attacks.\n4️⃣ No fake/scam links.\n5️⃣ No unwanted promotion.\n6️⃣ No NSFW content.\n7️⃣ Keep discussion related to cricket.\n8️⃣ Follow admin instructions.\n9️⃣ 3 warnings = Permanent Ban 🚫";
  if (key === "ABOUT_MESSAGE") return "🏏 CRICZONE\n\nYour cricket community for match updates, live scores, schedules and cricket news.";
  if (key === "MENU_CONFIG") return JSON.stringify([]);
  if (key === "VS_MATCH") return JSON.stringify({team_a:"",team_b:"",date:"",time:"",venue:"",status:"Upcoming",link:""});
  if (key === "MEDIA_CHAT_ID") return "";
  return "";
}

async function handleBroadcast(env, body, cors) {
  const type = String(body.type || "text");
  const message = String(body.message || "").trim();
  if (!message && type === "text") return json({ok:false,error:"Message is required"},400,cors);
  const users = await listAllKeys(env.BOT_KV, "users:");
  let sent=0, failed=0;
  const reply_markup = body.button_url ? {inline_keyboard:[[{
    text:String(body.button_text||"Open").slice(0,80), url:String(body.button_url).trim()
  }]]} : undefined;

  for (const key of users) {
    const chat_id = key.name.replace("users:","");
    try {
      let result;
      if (type === "photo") {
        result = await telegramMethod(env.BOT_TOKEN,"sendPhoto",{chat_id,photo:String(body.media||"").trim(),caption:message||undefined,reply_markup});
      } else if (type === "video") {
        result = await telegramMethod(env.BOT_TOKEN,"sendVideo",{chat_id,video:String(body.media||"").trim(),caption:message||undefined,reply_markup});
      } else {
        result = await telegramMethod(env.BOT_TOKEN,"sendMessage",{chat_id,text:message,reply_markup});
      }
      if (result?.ok) {
        sent++;
      } else {
        failed++;
        if (result?.error_code === 400 && /chat not found|user is deactivated|bot was blocked|kicked/i.test(String(result?.description || ""))) {
          try { await env.BOT_KV.delete(key.name); } catch {}
        }
      }
    } catch (error) {
      failed++;
      if (/chat not found|user is deactivated|bot was blocked|kicked/i.test(String(error?.message || ""))) {
        try { await env.BOT_KV.delete(key.name); } catch {}
      }
    }
    await new Promise(resolve => setTimeout(resolve, 40));
  }

  const record = {
    id:Date.now().toString(), created_at:new Date().toISOString(), type,
    sent,failed,total:users.length,preview:(message||"").slice(0,160),
    media:type==="text" ? "" : String(body.media||"").slice(0,250),
    button_url:String(body.button_url||"")
  };
  try { await env.BOT_KV.put("broadcast:"+record.id,JSON.stringify(record),{expirationTtl:60*60*24*90}); } catch {}
  await logActivity(env,"broadcast","Sent "+type+" broadcast: "+sent+" delivered, "+failed+" failed");
  return json({ok:true,sent,failed,total:users.length},200,cors);
}

async function logActivity(env,type,message) {
  try {
    const record={id:Date.now().toString(),created_at:new Date().toISOString(),type,message};
    await env.BOT_KV.put("activity:"+record.id,JSON.stringify(record),{expirationTtl:60*60*24*90});
  } catch {}
}

async function listAllKeys(kv,prefix) {
  if(!kv) return [];
  const keys=[]; let cursor=undefined;
  do {
    const options={prefix}; if(cursor) options.cursor=cursor;
    const page=await kv.list(options); keys.push(...page.keys);
    cursor=page.list_complete?undefined:page.cursor;
  } while(cursor);
  return keys;
}
async function getKV(kv,key,fallback) {
  if(!kv) return fallback;
  try { return (await kv.get(key)) || fallback; } catch { return fallback; }
}
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers});}
async function telegramMethod(token,method,payload){
  const response=await fetch("https://api.telegram.org/bot"+token+"/"+method,{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)
  });
  return response.json();
}
