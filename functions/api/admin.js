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
      const userStatus = (url.searchParams.get("status") || "").trim().toLowerCase();
      const userNotify = (url.searchParams.get("notify") || "").trim().toLowerCase();

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
        const growthPct = {
          today: users.length ? Number(((growth.today / users.length) * 100).toFixed(1)) : 0,
          last7: users.length ? Number(((growth.last7 / users.length) * 100).toFixed(1)) : 0,
          last30: users.length ? Number(((growth.last30 / users.length) * 100).toFixed(1)) : 0
        };
        const eventKeys = await listAllKeys(env.BOT_KV, "metrics:event:");
        const eventUsage = [];
        for (const key of eventKeys) {
          const count = Number(await env.BOT_KV.get(key.name)) || 0;
          eventUsage.push({name:key.name.replace("metrics:event:",""),count});
        }
        eventUsage.sort((x,y)=>y.count-x.count);
        return json({ ok: true, users: users.length, broadcasts: broadcasts.length, activity: activity.length, growth, growthPct, active24h, delivered, failed, eventUsage:eventUsage.slice(0,20) }, 200, cors);
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

      if (view === "templates") {
        const keys = await listAllKeys(env.BOT_KV, "template:");
        const templates = [];
        for (const key of keys) {
          const raw = await env.BOT_KV.get(key.name);
          try { if (raw) templates.push(JSON.parse(raw)); } catch {}
        }
        templates.sort((x,y)=>String(x.name||"").localeCompare(String(y.name||"")));
        return json({ ok: true, templates }, 200, cors);
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
          const notifyState = user.channel_notifications === "off" ? "off" : "on";
          const statusState = String(user.status || "registered").toLowerCase();
          if ((!search || haystack.includes(search)) && (!userStatus || statusState === userStatus) && (!userNotify || notifyState === userNotify)) {
            result.push({
              user_id: userId,
              first_name: user.first_name || "Unknown",
              username: user.username || "",
              joined_at: user.joined_at || "",
              last_active_at: user.last_active_at || "",
              status: user.status || "registered",
              channel_notifications: user.channel_notifications === "off" ? "off" : "on"
            });
          }
        }
        return json({ ok: true, users: result, total: keys.length }, 200, cors);
      }

      if (view === "user_stats") {
        const keys = await listAllKeys(env.BOT_KV, "users:");
        const now = Date.now();
        let active24h = 0;
        let notifyOn = 0;
        for (const key of keys) {
          const raw = await env.BOT_KV.get(key.name);
          try {
            const u = raw ? JSON.parse(raw) : {};
            const last = Date.parse(u.last_active_at || "");
            if (!Number.isNaN(last) && now - last < 86400000) active24h++;
            if (u.channel_notifications !== "off") notifyOn++;
          } catch {}
        }
        return json({ ok:true, total:keys.length, active24h, notifyOn }, 200, cors);
      }

      if (view === "live_match") {
        const raw = await env.BOT_KV.get("settings:LIVE_MATCH");
        let match = {};
        try { match = raw ? JSON.parse(raw) : {}; } catch {}
        return json({ok:true,match},200,cors);
      }

      if (view === "moderation_stats") {
        const warningKeys=await listAllKeys(env.BOT_KV,"warnings:");
        const users=[];
        for(const key of warningKeys){
          const count=Number(await env.BOT_KV.get(key.name))||0;
          if(count>0) users.push({key:key.name.replace("warnings:",""),count});
        }
        users.sort((x,y)=>y.count-x.count);
        const logs=await listAllKeys(env.BOT_KV,"activity:");
        const recent=[];
        for(const key of logs.slice(-50).reverse()){
          const raw=await env.BOT_KV.get(key.name);
          try{const x=raw?JSON.parse(raw):{};if(x.type==="moderation")recent.push(x)}catch{}
        }
        return json({ok:true,warnings:users,totalWarnings:users.reduce((n,x)=>n+x.count,0),recent:recent.slice(0,20)},200,cors);
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

      if (action === "save_live_match") {
        const match = {
          team_a:String(body.match?.team_a||"").slice(0,80),
          team_b:String(body.match?.team_b||"").slice(0,80),
          score:String(body.match?.score||"").slice(0,120),
          overs:String(body.match?.overs||"").slice(0,40),
          batting:String(body.match?.batting||"").slice(0,120),
          bowling:String(body.match?.bowling||"").slice(0,120),
          status:String(body.match?.status||"Upcoming").slice(0,30),
          note:String(body.match?.note||"").slice(0,300),
          link:String(body.match?.link||"").trim().slice(0,2000),
          updated_at:new Date().toISOString()
        };
        if (!match.team_a || !match.team_b) return json({ok:false,error:"Both teams are required"},400,cors);
        await env.BOT_KV.put("settings:LIVE_MATCH",JSON.stringify(match));
        await logActivity(env,"live_match","Live match updated: "+match.team_a+" vs "+match.team_b+" • "+match.status);
        return json({ok:true,match},200,cors);
      }

      if (action === "clear_live_match") {
        await env.BOT_KV.delete("settings:LIVE_MATCH");
        await logActivity(env,"live_match","Live match cleared");
        return json({ok:true},200,cors);
      }

      if (action === "broadcast") {
        return await handleBroadcast(env, body, cors);
      }

      if (action === "save_template") {
        const t = {
          id: String(body.template?.id || Date.now()),
          name: String(body.template?.name || "").trim().slice(0, 80),
          type: ["text","photo","video"].includes(String(body.template?.type)) ? String(body.template.type) : "text",
          message: String(body.template?.message || "").slice(0, 4000),
          media: String(body.template?.media || "").trim().slice(0, 1000),
          button_text: String(body.template?.button_text || "🏏 Open").slice(0, 80),
          button_url: String(body.template?.button_url || "").trim().slice(0, 2000),
          category: String(body.template?.category || "General").trim().slice(0, 40),
          favorite: body.template?.favorite === true
        };
        if (!t.name) return json({ok:false,error:"Template name is required"},400,cors);
        if (!t.message && t.type === "text") return json({ok:false,error:"Template message is required"},400,cors);
        if ((t.type === "photo" || t.type === "video") && !t.media) return json({ok:false,error:"Media URL/file_id is required for photo/video"},400,cors);
        if (t.button_url && !(t.button_url.startsWith("http://") || t.button_url.startsWith("https://"))) return json({ok:false,error:"Button URL must start with http:// or https://"},400,cors);
        await env.BOT_KV.put("template:" + t.id, JSON.stringify(t));
        await logActivity(env, "template", "Broadcast template saved: " + t.name);
        return json({ok:true,template:t},200,cors);
      }

      if (action === "update_template") {
        const incoming = body.template || {};
        const id = String(incoming.id || "").trim();
        if (!id) return json({ok:false,error:"Template ID is required"},400,cors);
        const existingRaw = await env.BOT_KV.get("template:" + id);
        if (!existingRaw) return json({ok:false,error:"Template not found"},404,cors);
        let existing = {};
        try { existing = JSON.parse(existingRaw); } catch {}
        const t = {
          id,
          name: String(incoming.name || "").trim().slice(0, 80),
          type: ["text","photo","video"].includes(String(incoming.type)) ? String(incoming.type) : "text",
          message: String(incoming.message || "").slice(0, 4000),
          media: String(incoming.media || "").trim().slice(0, 1000),
          button_text: String(incoming.button_text || "🏏 Open").slice(0, 80),
          button_url: String(incoming.button_url || "").trim().slice(0, 2000),
          category: String(incoming.category || "General").trim().slice(0, 40),
          favorite: incoming.favorite === true || existing.favorite === true
        };
        if (!t.name) return json({ok:false,error:"Template name is required"},400,cors);
        if (!t.message && t.type === "text") return json({ok:false,error:"Template message is required"},400,cors);
        if ((t.type === "photo" || t.type === "video") && !t.media) return json({ok:false,error:"Media URL/file_id is required for photo/video"},400,cors);
        if (t.button_url && !(t.button_url.startsWith("http://") || t.button_url.startsWith("https://"))) return json({ok:false,error:"Button URL must start with http:// or https://"},400,cors);
        await env.BOT_KV.put("template:" + id, JSON.stringify(t));
        await logActivity(env, "template", "Broadcast template updated: " + t.name);
        return json({ok:true,template:t},200,cors);
      }

      if (action === "duplicate_template") {
        const id = String(body.id || "").trim();
        const raw = id ? await env.BOT_KV.get("template:" + id) : null;
        if (!raw) return json({ok:false,error:"Template not found"},404,cors);
        let t={}; try{t=JSON.parse(raw)}catch{}
        t.id=String(Date.now())+Math.floor(Math.random()*1000);
        t.name=String(t.name||"Template")+" Copy";
        await env.BOT_KV.put("template:"+t.id,JSON.stringify(t));
        await logActivity(env,"template","Template duplicated: "+t.name);
        return json({ok:true,template:t},200,cors);
      }

      if (action === "toggle_template_favorite") {
        const id=String(body.id||"").trim();
        const raw=id?await env.BOT_KV.get("template:"+id):null;
        if(!raw) return json({ok:false,error:"Template not found"},404,cors);
        let t={}; try{t=JSON.parse(raw)}catch{}
        t.favorite=t.favorite!==true;
        await env.BOT_KV.put("template:"+id,JSON.stringify(t));
        return json({ok:true,template:t},200,cors);
      }

      if (action === "delete_template") {
        const id = String(body.id || "").trim();
        if (id) await env.BOT_KV.delete("template:" + id);
        return json({ok:true},200,cors);
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
        await logActivity(env, "moderation", operation + " user " + userId + (operation === "warn" ? " • warnings handled" : ""));
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
const SETTING_KEYS = ["WELCOME_MESSAGE","RULES_MESSAGE","ABOUT_MESSAGE","MENU_CONFIG","VS_MATCH","MEDIA_CHAT_ID","CHANNEL_FANOUT_ENABLED","WELCOME_NEW_MEMBERS"];

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
  const activity = await listAllKeys(env.BOT_KV, "activity:");
  return { ok:true, bot:{status:"online"}, users:users.length, broadcasts:broadcasts.length, activity:activity.length, config, settings };
}

function defaultSetting(key) {
  if (key === "WELCOME_MESSAGE") return "🏏 Welcome to CRICZONE!\n\nChoose an option below 👇";
  if (key === "RULES_MESSAGE") return "📜 CRICZONE HUB — RULES\n\n1️⃣ Respect everyone.\n2️⃣ No spam.\n3️⃣ No abuse or personal attacks.\n4️⃣ No fake/scam links.\n5️⃣ No unwanted promotion.\n6️⃣ No NSFW content.\n7️⃣ Keep discussion related to cricket.\n8️⃣ Follow admin instructions.\n9️⃣ 3 warnings = Permanent Ban 🚫";
  if (key === "ABOUT_MESSAGE") return "🏏 CRICZONE\n\nYour cricket community for match updates, live scores, schedules and cricket news.";
  if (key === "MENU_CONFIG") return JSON.stringify([]);
  if (key === "VS_MATCH") return JSON.stringify({team_a:"",team_b:"",date:"",time:"",venue:"",status:"Upcoming",link:""});
  if (key === "MEDIA_CHAT_ID") return "";
  if (key === "CHANNEL_FANOUT_ENABLED") return "true";
  if (key === "WELCOME_NEW_MEMBERS") return "true";
  return "";
}

async function handleBroadcast(env, body, cors) {
  const type = ["text","photo","video"].includes(String(body.type)) ? String(body.type) : "text";
  const message = String(body.message || "").trim();
  const validAudiences = ["all","active24h","notify_on","selected"];
  const audience = validAudiences.includes(String(body.audience)) ? String(body.audience) : "all";
  if (!message && type === "text") return json({ok:false,error:"Message is required"},400,cors);

  const selectedIds = String(body.selected_ids || "").split(/[\s,]+/).map(x=>x.trim()).filter(x=>/^\d+$/.test(x)).slice(0,5000);
  if (audience === "selected" && !selectedIds.length) return json({ok:false,error:"Add at least one user ID for Selected Users"},400,cors);

  const userKeys = await listAllKeys(env.BOT_KV, "users:");
  const now = Date.now();
  const selectedSet = new Set(selectedIds);
  const users = [];
  for (const key of userKeys) {
    const raw = await env.BOT_KV.get(key.name);
    let u = {}; try { u = raw ? JSON.parse(raw) : {}; } catch {}
    const chat_id = key.name.replace("users:","");
    const last = Date.parse(u.last_active_at || "");
    const active = !Number.isNaN(last) && now - last < 86400000;
    const notifyOn = u.channel_notifications !== "off";
    if (audience === "active24h" && !active) continue;
    if (audience === "notify_on" && !notifyOn) continue;
    if (audience === "selected" && !selectedSet.has(chat_id)) continue;
    users.push({key,chat_id});
  }

  const buttons = [];
  const buttonTexts = Array.isArray(body.buttons) ? body.buttons : [];
  for (const b of buttonTexts.slice(0,3)) {
    const label=String(b?.text||"").trim().slice(0,80), url=String(b?.url||"").trim();
    if(label && /^https?:\/\//i.test(url)) buttons.push([{text:label,url}]);
  }
  if (!buttons.length && body.button_url) {
    const url=String(body.button_url).trim();
    if(/^https?:\/\//i.test(url)) buttons.push([{text:String(body.button_text||"Open").slice(0,80),url}]);
  }
  const reply_markup = buttons.length ? {inline_keyboard:buttons} : undefined;

  let sent=0,failed=0;
  for (const user of users) {
    try {
      let result;
      const common = {chat_id:user.chat_id, reply_markup};
      if(type==="photo") result=await telegramMethod(env.BOT_TOKEN,"sendPhoto",{...common,photo:String(body.media||"").trim(),caption:message||undefined});
      else if(type==="video") result=await telegramMethod(env.BOT_TOKEN,"sendVideo",{...common,video:String(body.media||"").trim(),caption:message||undefined});
      else result=await telegramMethod(env.BOT_TOKEN,"sendMessage",{...common,text:message});
      if(result?.ok) sent++;
      else {
        failed++;
        if(result?.error_code===400 && /chat not found|user is deactivated|bot was blocked|kicked/i.test(String(result?.description||""))) { try{await env.BOT_KV.delete(user.key.name)}catch{} }
      }
    } catch(error) {
      failed++;
      if(/chat not found|user is deactivated|bot was blocked|kicked/i.test(String(error?.message||""))) { try{await env.BOT_KV.delete(user.key.name)}catch{} }
    }
    await new Promise(resolve=>setTimeout(resolve,40));
  }
  const record={id:Date.now().toString(),created_at:new Date().toISOString(),type,audience,sent,failed,total:users.length,preview:(message||"").slice(0,160),media:type==="text"?"":String(body.media||"").slice(0,250),button_url:String(body.button_url||"")};
  try{await env.BOT_KV.put("broadcast:"+record.id,JSON.stringify(record),{expirationTtl:60*60*24*90})}catch{}
  await logActivity(env,"broadcast","Sent "+type+" broadcast to "+audience+": "+sent+" delivered, "+failed+" failed");
  return json({ok:true,sent,failed,total:users.length,audience},200,cors);
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
