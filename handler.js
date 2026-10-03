import config from './config.js';
import db from './lib/database.js';
import { smsg, cleanJid, formatNumber, resolveJid, updateLidCacheFromMetadata, findParticipant, isParticipantAdmin } from './lib/simple.js';
import { plugins, logger } from './lib/plugins.js';
import chalk from 'chalk';

// Cache metadata grup untuk mempercepat respon dan mencegah connection closed
const groupMetadataCache = new Map();

/**
 * Helper mengambil metadata grup secara aman dengan cache fallback
 */
async function getSafeGroupMetadata(vynaa, chatId, forceRefresh = false) {
  let cached = groupMetadataCache.get(chatId);
  const now = Date.now();

  // Jika tidak dipaksa refresh dan cache masih segar (< 30 detik), pakai langsung
  if (!forceRefresh && cached && (now - (cached._time || 0)) < 30000) {
    return cached;
  }

  try {
    const fresh = await vynaa.groupMetadata(chatId);
    if (fresh) {
      fresh._time = now;
      groupMetadataCache.set(chatId, fresh);
      return fresh;
    }
  } catch (err) {
    // Jika fetch gagal (misal koneksi sedang jitter), pakai cache lama jika ada
    if (cached) return cached;
  }

  return cached || null;
}

// Cache memori untuk fitur antidelete (menyimpan pesan terakhir untuk mendeteksi penarikan pesan)
const messageStore = new Map();

function saveToMessageStore(m) {
  if (!m || !m.id || !m.chat || !m.isGroup) return;
  if (messageStore.size > 1500) {
    const oldestKey = messageStore.keys().next().value;
    messageStore.delete(oldestKey);
  }
  messageStore.set(m.id, {
    id: m.id,
    chat: m.chat,
    fromMe: m.fromMe,
    sender: m.sender,
    senderNumber: m.senderNumber,
    pushName: m.pushName,
    type: m.type,
    text: m.text,
    msg: m.msg,
    raw: m.raw,
    download: m.download,
    time: Date.now()
  });
}

// Cache anti-spam agar tidak berulang kali mengirim vCard jika user mengetik pesan beruntun di chat pribadi
const privateChatNoticeCache = new Map();

/**
 * Mengirim kartu kontak resmi Owner beserta pesan sewa bot saat ada yang chat di pesan pribadi
 */
async function sendPrivateChatNotice(vynaa, m, config, db) {
  const now = Date.now();
  const lastNotice = privateChatNoticeCache.get(m.chat) || 0;
  // Cooldown 10 detik per pengguna
  if (now - lastNotice < 10000) return;
  privateChatNoticeCache.set(m.chat, now);

  const dbOwners = typeof db.getOwners === 'function' ? db.getOwners() : [];
  const rawOwners = Array.from(new Set([...(config.owner || []), ...dbOwners]));
  const owners = rawOwners.length > 0 ? rawOwners : ['6283872659753'];

  // 1. Buat vCard kartu kontak WhatsApp untuk setiap owner
  const contacts = owners.map((num) => {
    const cleanNum = String(num).replace(/\D/g, '');
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:Owner ${config.botName}\nORG:${config.botName};\nTEL;type=CELL;type=VOICE;waid=${cleanNum}:+${cleanNum}\nEND:VCARD`;
    return {
      displayName: `Owner ${config.botName}`,
      vcard
    };
  });

  try {
    // 2. Kirim kartu kontak WhatsApp (Native Contact Card)
    await vynaa.sendMessage(m.chat, {
      contacts: {
        displayName: `Owner ${config.botName}`,
        contacts
      }
    }, { quoted: m.raw });

    // 3. Kirim pesan informasi sewa bot
    const replyText = 'Halo bro, bot ini cuma aktif di dalam grup ya. Mau sewa silakan chat owner di kontak atas.';
    await vynaa.sendMessage(m.chat, {
      text: replyText
    }, { quoted: m.raw });
  } catch (err) {
    if (typeof logger?.error === 'function') {
      logger.error('PrivateChatNoticeError', err.message || String(err));
    } else {
      console.error('[PrivateChatNoticeError]', err);
    }
  }
}

/**
 * Handler utama untuk setiap pesan yang masuk
 */
export async function messageHandler(vynaa, chatUpdate) {
  try {
    const rawMsg = chatUpdate.messages[0];
    if (!rawMsg || !rawMsg.message) return;

    // Abaikan status WhatsApp
    if (rawMsg.key.remoteJid === 'status@broadcast') return;

    // Auto Read (Tandai pesan dibaca / centang biru otomatis jika diaktifkan oleh Owner)
    if (db.data?.settings?.autoread && rawMsg.key && !rawMsg.key.fromMe) {
      try {
        await vynaa.readMessages([rawMsg.key]);
      } catch {}
    }

    // Cek jika pesan adalah penarikan pesan (Revoke / Delete for Everyone) untuk fitur Antidelete
    const proto = rawMsg.message.protocolMessage;
    if (proto && (proto.type === 0 || proto.type === 'REVOKE')) {
      const deletedId = proto.key?.id;
      const targetChat = cleanJid(proto.key?.remoteJid || rawMsg.key.remoteJid);
      const chatData = db.getChat(targetChat);

      if (chatData?.antidelete && deletedId) {
        const cached = messageStore.get(deletedId);
        if (cached && !cached.fromMe) {
          let timeStr = '';
          try {
            timeStr = new Intl.DateTimeFormat('id-ID', {
              timeZone: 'Asia/Jakarta',
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }).format(new Date(cached.time || Date.now())) + ' WIB';
          } catch {
            timeStr = new Date().toLocaleTimeString('id-ID') + ' WIB';
          }

          const captionText = `⚠️ *PESAN DITARIK TERDETEKSI*\n\n` +
            `• Pengirim : @${cached.senderNumber}${cached.pushName ? ` (${cached.pushName})` : ''}\n` +
            `• Waktu    : ${timeStr}\n` +
            `• Tipe     : ${cached.type || 'Pesan'}\n` +
            `• Isi Pesan:\n${cached.text || '_(Media / Tanpa teks)_'}`;

          // Jika pesan berupa media (gambar, video, stiker)
          if (cached.download && cached.type && cached.type !== 'conversation' && cached.type !== 'extendedTextMessage') {
            try {
              const buffer = await cached.download();
              if (buffer && buffer.length > 0) {
                if (cached.type === 'imageMessage') {
                  await vynaa.sendMessage(targetChat, { image: buffer, caption: captionText, mentions: [cached.sender] });
                  return;
                }
                if (cached.type === 'videoMessage') {
                  await vynaa.sendMessage(targetChat, { video: buffer, caption: captionText, mentions: [cached.sender] });
                  return;
                }
                if (cached.type === 'stickerMessage') {
                  await vynaa.sendMessage(targetChat, { text: captionText, mentions: [cached.sender] });
                  await vynaa.sendMessage(targetChat, { sticker: buffer });
                  return;
                }
              }
            } catch {}
          }

          // Pesan teks
          await vynaa.sendMessage(targetChat, {
            text: captionText,
            mentions: [cached.sender]
          });
        }
      }
      return;
    }

    if (rawMsg.key.id?.startsWith('BAE5') && rawMsg.key.id.length === 16) return;

    // Serialisasi pesan
    const m = smsg(vynaa, rawMsg);
    if (!m) return;

    // Simpan pesan ke memory store untuk keperluan antidelete
    saveToMessageStore(m);

    const isGroup = m.isGroup;
    let groupMetadata = null;
    let participants = [];
    let isBotAdmin = false;
    let isAdmin = false;

    // Bot ID & Number (mendukung Phone JID dan LID)
    const botJid = cleanJid(vynaa.user?.id);
    const botLid = cleanJid(vynaa.user?.lid);
    const botNumber = formatNumber(botJid);

    // Bot ini dikhususkan untuk Grup
    if (isGroup) {
      groupMetadata = await getSafeGroupMetadata(vynaa, m.chat);

      if (groupMetadata) {
        participants = groupMetadata.participants || [];
        updateLidCacheFromMetadata(groupMetadata);

        // Resolve sender JID dari LID jika diperlukan
        m.sender = resolveJid(m.sender, participants);
        m.senderNumber = formatNumber(m.sender);

        // Cek bot admin dengan multi-field matcher (mendukung LID, JID & nomor)
        let botParticipant = (botLid && findParticipant(participants, botLid)) ||
                             (botJid && findParticipant(participants, botJid)) ||
                             (botNumber && findParticipant(participants, botNumber));
        isBotAdmin = isParticipantAdmin(botParticipant);

        // Jika belum admin di cache lama, force refresh metadata untuk antisipasi bot baru di-promote
        if (!isBotAdmin) {
          const freshMetadata = await getSafeGroupMetadata(vynaa, m.chat, true);
          if (freshMetadata) {
            groupMetadata = freshMetadata;
            participants = groupMetadata.participants || [];
            updateLidCacheFromMetadata(groupMetadata);
            botParticipant = (botLid && findParticipant(participants, botLid)) ||
                             (botJid && findParticipant(participants, botJid)) ||
                             (botNumber && findParticipant(participants, botNumber));
            isBotAdmin = isParticipantAdmin(botParticipant);
          }
        }

        // Cek sender admin dengan multi-field matcher (mendukung LID & JID)
        const senderParticipant = findParticipant(participants, m.rawSender) || findParticipant(participants, m.sender);
        isAdmin = isParticipantAdmin(senderParticipant);
      } else {
        m.senderNumber = formatNumber(m.sender);
      }
    } else {
      m.senderNumber = formatNumber(m.sender);
    }

    // Owner check (mendukung config.js dan database dinamis)
    const dbOwners = typeof db.getOwners === 'function' ? db.getOwners() : [];
    const isOwner = (config.owner || []).includes(m.senderNumber) || dbOwners.includes(m.senderNumber) || m.fromMe;
    if (isOwner) {
      isAdmin = true; // Owner selalu dianggap admin
    }

    const chatData = db.getChat(m.chat);
    const userData = db.getUser(m.sender);

    // ==========================================
    // EKSEKUSI BEFORE HOOKS DARI FITUR (Contoh: Antilink)
    // ==========================================
    for (const [, plugin] of plugins) {
      if (typeof plugin.before === 'function') {
        try {
          const shouldStop = await plugin.before({
            vynaa,
            m,
            chat: chatData,
            user: userData,
            isGroup,
            isAdmin,
            isBotAdmin,
            isOwner,
            groupMetadata,
            participants,
            db,
            config
          });
          if (shouldStop) return;
        } catch (err) {
          // Tangani silent agar tidak crash
        }
      }
    }

    // ==========================================
    // PARSING FLEKSIBEL: DENGAN PREFIX, TANPA PREFIX, ATAU PANGGIL BOT
    // ==========================================
    const rawBody = (m.body || '').trim();
    if (!rawBody) return;

    // ==========================================
    // BLOKIR AKSES DI CHAT PRIBADI (KECUALI OWNER)
    // ==========================================
    if (!isGroup && !isOwner) {
      await sendPrivateChatNotice(vynaa, m, config, db);
      return;
    }

    let prefix = '.';
    let command = '';
    let args = [];
    let text = '';

    // 1. Tangani evaluasi cepat owner: "> " atau "$ "
    if (rawBody.startsWith('> ') || rawBody.startsWith('$ ')) {
      command = rawBody.slice(0, 1);
      text = rawBody.slice(2).trim();
      args = text.split(/\s+/);
    } else {
      let cleanedText = rawBody;

      // 2. Cek jika pesan diawali tag bot (misal: @628xxx ping)
      const botTagRegex = new RegExp(`^@${botNumber}\\s*`, 'i');
      if (botTagRegex.test(cleanedText)) {
        cleanedText = cleanedText.replace(botTagRegex, '').trim();
        // Jika cuma ngetag bot doang
        if (!cleanedText) {
          return m.reply(`Halo @${m.senderNumber}, ada yang bisa dibantu?\nKetik "menu" atau ".menu" untuk melihat daftar perintah.`, {
            mentions: [m.sender]
          }).catch(() => {});
        }
      }

      // 3. Cek jika diawali kata "bot " atau "vynaa " (misal: "bot ping" atau "vynaa menu")
      const botNameRegex = /^(bot|vynaa)\s+/i;
      if (botNameRegex.test(cleanedText)) {
        cleanedText = cleanedText.replace(botNameRegex, '').trim();
      }

      // 4. Cek awalan prefix simbol (. / ! # $)
      const prefixRegex = /^[.!#/$]/;
      if (prefixRegex.test(cleanedText)) {
        prefix = cleanedText.match(prefixRegex)[0];
        cleanedText = cleanedText.slice(prefix.length).trim();
      }

      cleanedText = cleanedText.trim();
      const firstSpaceIndex = cleanedText.search(/\s/);
      if (firstSpaceIndex === -1) {
        command = cleanedText.toLowerCase();
        text = '';
        args = [];
      } else {
        command = cleanedText.slice(0, firstSpaceIndex).toLowerCase();
        text = cleanedText.slice(firstSpaceIndex).trim();
        args = text ? text.split(/\s+/) : [];
      }
    }

    if (!command) return;

    // ==========================================
    // PENCARIAN & EKSEKUSI FITUR DARI /vynaafeture
    // ==========================================
    let targetPlugin = null;

    for (const [, plugin] of plugins) {
      if (typeof plugin.execute !== 'function') continue;

      if (Array.isArray(plugin.command)) {
        if (plugin.command.includes(command)) {
          targetPlugin = plugin;
          break;
        }
      } else if (plugin.command instanceof RegExp) {
        if (plugin.command.test(command)) {
          targetPlugin = plugin;
          break;
        }
      } else if (typeof plugin.command === 'string') {
        if (plugin.command.toLowerCase() === command) {
          targetPlugin = plugin;
          break;
        }
      } else if (plugin.name && plugin.name.toLowerCase() === command) {
        targetPlugin = plugin;
        break;
      }
    }

    // Jika bukan perintah yang dikenali, lewati
    if (!targetPlugin) return;

    // Validasi izin akses fitur
    if (targetPlugin.group && !isGroup) {
      return m.reply(config.msg.group).catch(() => {});
    }
    if (targetPlugin.owner && !isOwner) {
      return m.reply(config.msg.owner).catch(() => {});
    }
    if (targetPlugin.admin && !isAdmin) {
      return m.reply(config.msg.admin).catch(() => {});
    }
    if (targetPlugin.botAdmin && !isBotAdmin) {
      return m.reply(config.msg.botAdmin).catch(() => {});
    }

    // Log eksekusi gaya Antigravity
    const senderDisplay = m.pushName ? `${m.pushName} (@${m.senderNumber})` : `@${m.senderNumber || m.sender}`;
    const groupDisplay = groupMetadata?.subject || (isGroup ? m.chat : 'Private Chat');
    logger.cmd(senderDisplay, command, groupDisplay);

    // Jalankan fitur
    await targetPlugin.execute({
      vynaa,
      m,
      args,
      text,
      command,
      prefix,
      isOwner,
      isAdmin,
      isBotAdmin,
      groupMetadata,
      participants,
      chat: chatData,
      user: userData,
      db,
      config
    });

  } catch (err) {
    if (!err.message?.includes('Connection Closed')) {
      logger.error('HandlerError', err.message);
    }
  }
}

const DEFAULT_WELCOME = `┌── [ MEMBER BARU BERGABUNG ]
│
├ Halo @user
├ Selamat datang di:
├ %group%
│
├ Deskripsi Grup:
│ %desc%
│
└── [ Semoga betah dan patuhi aturan ya kak! ]`;

const DEFAULT_BYE = `┌── [ MEMBER KELUAR ]
│
├ Selamat jalan @user
├ Dari grup: %group%
│
└── [ Semoga harimu selalu menyenangkan! ]`;

/**
 * Handler event ketika ada anggota bergabung atau keluar dari grup (Welcome & Bye)
 */
export async function groupParticipantsHandler(vynaa, update) {
  try {
    const { id, participants, action } = update;
    if (!id || !id.endsWith('@g.us')) return;
    if (action !== 'add' && action !== 'remove') return;

    const chat = db.getChat(id);
    if (!chat) return;

    // Cek apakah fitur aktif untuk aksi ini
    if (action === 'add' && !chat.welcome) return;
    if (action === 'remove' && !chat.bye) return;

    const metadata = await getSafeGroupMetadata(vynaa, id).catch(() => null);
    const groupName = metadata?.subject || 'Grup WhatsApp';
    const groupDesc = metadata?.desc || 'Tidak ada deskripsi';
    const memberCount = (metadata?.participants || []).length;

    let timeStr = '';
    try {
      timeStr = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date()) + ' WIB';
    } catch {
      timeStr = new Date().toLocaleString('id-ID');
    }

    for (const p of participants || []) {
      const userJid = cleanJid(p);
      const userNum = formatNumber(userJid);

      // Jangan sambut bot sendiri saat baru join
      if (userJid === cleanJid(vynaa.user?.id) || userNum === formatNumber(vynaa.user?.id)) {
        continue;
      }

      // 1. Ambil foto profil pengguna (user)
      let pp = await vynaa.profilePictureUrl(userJid, 'image').catch(() => null);
      if (!pp) {
        // Fallback 1: Foto profil grup
        pp = await vynaa.profilePictureUrl(id, 'image').catch(() => null);
      }
      if (!pp) {
        // Fallback 2: Thumbnail default bot
        pp = config.thumb || 'https://vydrive.zone.id/f/nm2rJWfe.jpeg';
      }

      let template = action === 'add'
        ? (chat.welcomeText || DEFAULT_WELCOME)
        : (chat.byeText || DEFAULT_BYE);

      // Ganti placeholder
      template = template.replace(/@user/g, `@${userNum}`);
      template = template.replace(/%user%/gi, `@${userNum}`);
      template = template.replace(/%(group|grup)%/gi, groupName);
      template = template.replace(/%(desc|deskripsi)%/gi, groupDesc);
      template = template.replace(/%(members|total|member)%/gi, `${memberCount}`);
      template = template.replace(/%(waktu|jam|tanggal)%/gi, timeStr);

      await vynaa.sendMessage(id, {
        image: { url: pp },
        caption: template,
        mentions: [userJid]
      });
    }
  } catch (err) {
    logger.error('ParticipantsUpdateError', err.message || String(err));
  }
}
