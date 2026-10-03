/*
        ••JANGAN HAPUS INI••
SCRIPT BY © VYNAA VALERIE 
•• recode kasih credits 
•• contacts: (6282389924037) 
•• (github.com/VynaaValerie) 

•• Join https://whatsapp.com/channel/0029VbCaDhn11ulT1qwodB2x  

• Menerima pemberitahuan web
• Menerima pemberitahuan aplikasi 
• Menerima pembuatan script bot
• Menerima perbaikan script atau fitur bot
• Menerima pembuatan fitur bot
• Menerima semua kebutuhan bot
• Menerima Jadi Bot

ℹ️ Information

• Pembayaran bisa dicicil
• Bisa bayar di awal atau akhir
• Pembayaran melalu QRIS Only
• Testimoni Banyak

Aturan:
1. Dilarang memperjualbelikan script ini.
2. Hak cipta milik Vynaa Valerie.

“Dan janganlah kamu makan harta di antara kamu dengan jalan yang batil, dan janganlah kamu membunuh dirimu sendiri. Sesungguhnya Allah adalah Maha Penyayang kepadamu.” (QS. Al-Baqarah: 188)
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getContentType, downloadContentFromMessage, jidDecode } from '@whiskeysockets/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sessionDir = path.resolve(__dirname, '../VynaaSesi');

// Cache pemetaan LID ke Phone JID (@s.whatsapp.net)
const lidCache = new Map();
// Cache nama / username pengguna
export const nameCache = new Map();

/**
 * Ambil mapping LID <-> Phone Number dari file session disk secara instan
 */
export function getLidMappingFromFile(identifier) {
  const clean = String(identifier || '').replace(/\D/g, '');
  if (!clean) return null;
  const file1 = path.join(sessionDir, `lid-mapping-${clean}.json`);
  if (fs.existsSync(file1)) {
    try {
      const val = JSON.parse(fs.readFileSync(file1, 'utf-8'));
      return { lid: `${val}@lid`, pn: `${clean}@s.whatsapp.net` };
    } catch {}
  }
  const file2 = path.join(sessionDir, `lid-mapping-${clean}_reverse.json`);
  if (fs.existsSync(file2)) {
    try {
      const val = JSON.parse(fs.readFileSync(file2, 'utf-8'));
      return { pn: `${val}@s.whatsapp.net`, lid: `${clean}@lid` };
    } catch {}
  }
  return null;
}

/**
 * Decode dan bersihkan format JID
 */
export function cleanJid(jid) {
  if (!jid) return '';
  if (typeof jid !== 'string') jid = String(jid);
  const decoded = jidDecode(jid);
  if (decoded && decoded.user && decoded.server) {
    return `${decoded.user}@${decoded.server}`;
  }
  return jid.replace(/:\d+@/g, '@');
}

/**
 * Ekstrak nomor telepon dari JID (hanya angka)
 */
export function formatNumber(jid) {
  if (!jid) return '';
  const cleaned = cleanJid(jid);
  return cleaned.split('@')[0].replace(/\D/g, '');
}

/**
 * Cari objek participant dalam daftar metadata grup dengan multi-field matching (ID, LID, Phone, Session Disk)
 */
export function findParticipant(participants = [], target = '') {
  if (!target || !Array.isArray(participants)) return null;

  const cleanTarget = cleanJid(target);
  const numTarget = formatNumber(target);

  // 1. Cek kecocokan JID / LID langsung
  let found = participants.find((p) => {
    const pId = cleanJid(p.id || p.jid);
    const pLid = cleanJid(p.lid);
    return (pId && (pId === cleanTarget || pId.split('@')[0] === cleanTarget.split('@')[0])) ||
           (pLid && (pLid === cleanTarget || pLid.split('@')[0] === cleanTarget.split('@')[0]));
  });
  if (found) return found;

  // 2. Cek kecocokan lewat mapping file session (LID <-> Phone)
  const mapInfo = getLidMappingFromFile(target);
  if (mapInfo) {
    found = participants.find((p) => {
      const pId = cleanJid(p.id || p.jid);
      const pLid = cleanJid(p.lid);
      return (mapInfo.lid && (pId === mapInfo.lid || pLid === mapInfo.lid)) ||
             (mapInfo.pn && (pId === mapInfo.pn || pLid === mapInfo.pn));
    });
    if (found) return found;
  }

  // 3. Cek kecocokan nomor telepon untuk setiap participant di grup
  if (numTarget) {
    found = participants.find((p) => {
      const pId = cleanJid(p.id || p.jid);
      const pLid = cleanJid(p.lid);
      const pPhone = p.phoneNumber ? String(p.phoneNumber).replace(/\D/g, '') : '';
      if (pPhone && (pPhone === numTarget || pPhone.endsWith(numTarget))) return true;

      // Cek pemetaan reverse file untuk participant ini
      const pMap = getLidMappingFromFile(pId) || (pLid ? getLidMappingFromFile(pLid) : null);
      if (pMap?.pn && formatNumber(pMap.pn) === numTarget) return true;

      if (!pId.endsWith('@lid')) {
        const idNum = formatNumber(pId);
        if (idNum === numTarget || idNum.endsWith(numTarget)) return true;
      }
      return false;
    });
    if (found) return found;
  }

  return null;
}

/**
 * Periksa apakah seorang participant adalah admin atau superadmin
 */
export function isParticipantAdmin(participantObj) {
  return participantObj?.admin === 'admin' || participantObj?.admin === 'superadmin';
}

/**
 * Resolve JID dari LID ke Phone JID jika memungkinkan
 */
export function resolveJid(rawJid, participants = []) {
  if (!rawJid) return '';
  const cleaned = cleanJid(rawJid);

  // Jika sudah berakhiran @s.whatsapp.net atau grup @g.us
  if (!cleaned.endsWith('@lid')) {
    return cleaned;
  }

  // Cek di cache memory
  if (lidCache.has(cleaned)) {
    return lidCache.get(cleaned);
  }

  // Cek mapping disk
  const mapInfo = getLidMappingFromFile(cleaned);
  if (mapInfo?.pn) {
    lidCache.set(cleaned, mapInfo.pn);
    return mapInfo.pn;
  }

  // Cari di daftar participant metadata grup
  const found = findParticipant(participants, cleaned);
  if (found) {
    const pId = cleanJid(found.id || found.jid);
    const pPhone = found.phoneNumber ? `${found.phoneNumber}@s.whatsapp.net` : '';
    const resolved = pPhone || (!pId.endsWith('@lid') ? pId : '');

    if (resolved) {
      lidCache.set(cleaned, resolved);
      return resolved;
    }
  }

  return cleaned;
}

/**
 * Update cache LID dan nama dari seluruh participant grup
 */
export function updateLidCacheFromMetadata(metadata) {
  if (!metadata || !Array.isArray(metadata.participants)) return;
  for (const p of metadata.participants) {
    const pId = cleanJid(p.id || p.jid);
    const pLid = cleanJid(p.lid);
    const pPhone = p.phoneNumber ? `${p.phoneNumber}@s.whatsapp.net` : '';
    const target = pPhone || (pId && !pId.endsWith('@lid') ? pId : '');

    if (pLid && target) {
      lidCache.set(pLid, target);
    }
    if (p.name || p.notify) {
      const name = p.name || p.notify;
      if (target) nameCache.set(target, name);
      if (pLid) nameCache.set(pLid, name);
    }
  }
}

/**
 * Ambil nama panggilan pengguna jika ada di cache
 */
export function getUserName(jid) {
  const cleaned = cleanJid(jid);
  if (nameCache.has(cleaned)) return nameCache.get(cleaned);
  const num = formatNumber(cleaned);
  if (nameCache.has(num)) return nameCache.get(num);
  return '';
}

/**
 * Unpack ephemeral/view-once wrapper
 */
export function unwrapMessage(msg) {
  let unwrapped = msg?.message ?? msg;
  while (
    unwrapped?.ephemeralMessage ||
    unwrapped?.viewOnceMessage ||
    unwrapped?.viewOnceMessageV2 ||
    unwrapped?.viewOnceMessageV2Extension ||
    unwrapped?.documentWithCaptionMessage
  ) {
    unwrapped =
      unwrapped?.ephemeralMessage?.message ??
      unwrapped?.viewOnceMessage?.message ??
      unwrapped?.viewOnceMessageV2?.message ??
      unwrapped?.viewOnceMessageV2Extension?.message ??
      unwrapped?.documentWithCaptionMessage?.message;
  }
  return unwrapped;
}

/**
 * Serialisasi pesan Baileys
 */
export function smsg(sock, m) {
  if (!m) return m;

  const msg = { ...m };
  msg.raw = m;

  if (msg.key) {
    msg.id = msg.key.id;
    msg.isBaileys = msg.id.startsWith('BAE5') && msg.id.length === 16;
    msg.chat = cleanJid(msg.key.remoteJid);
    msg.fromMe = msg.key.fromMe;
    msg.isGroup = msg.chat.endsWith('@g.us');
    msg.rawSender = msg.fromMe ? sock.user?.id : (msg.isGroup ? msg.key.participant : msg.chat);
    msg.sender = cleanJid(msg.rawSender);
  }

  msg.pushName = m.pushName || '';
  if (msg.sender && msg.pushName) {
    nameCache.set(msg.sender, msg.pushName);
    nameCache.set(formatNumber(msg.sender), msg.pushName);
    if (msg.rawSender) nameCache.set(cleanJid(msg.rawSender), msg.pushName);
  }

  if (msg.message) {
    const innerMsg = unwrapMessage(msg.message);
    msg.type = getContentType(innerMsg) || Object.keys(innerMsg)[0];
    msg.msg = innerMsg[msg.type] || innerMsg;

    // Ambil isi teks pesan
    msg.text =
      innerMsg.conversation ||
      innerMsg.extendedTextMessage?.text ||
      innerMsg.imageMessage?.caption ||
      innerMsg.videoMessage?.caption ||
      innerMsg.documentMessage?.caption ||
      innerMsg.buttonsResponseMessage?.selectedButtonId ||
      innerMsg.listResponseMessage?.singleSelectReply?.selectedRowId ||
      innerMsg.templateButtonReplyMessage?.selectedId ||
      '';

    msg.body = typeof msg.text === 'string' ? msg.text.trim() : '';

    // Mentions
    msg.mentions = innerMsg.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (msg.text) {
      const regexMentions = msg.text.match(/@(\d+)/g);
      if (regexMentions) {
        for (const num of regexMentions) {
          const userJid = `${num.replace('@', '')}@s.whatsapp.net`;
          if (!msg.mentions.includes(userJid)) msg.mentions.push(userJid);
        }
      }
    }

    // Quoted Message
    const contextInfo = innerMsg.extendedTextMessage?.contextInfo || msg.msg?.contextInfo;
    if (contextInfo && contextInfo.quotedMessage) {
      const quotedInner = unwrapMessage(contextInfo.quotedMessage);
      const quotedType = getContentType(quotedInner) || Object.keys(quotedInner)[0];
      const quotedMsg = quotedInner[quotedType] || quotedInner;

      const quotedParticipant = cleanJid(contextInfo.participant);
      msg.quoted = {
        id: contextInfo.stanzaId,
        chat: cleanJid(contextInfo.remoteJid || msg.chat),
        sender: quotedParticipant,
        rawSender: contextInfo.participant,
        senderNumber: formatNumber(quotedParticipant),
        fromMe: quotedParticipant === cleanJid(sock.user?.id),
        raw: {
          key: {
            remoteJid: cleanJid(contextInfo.remoteJid || msg.chat),
            fromMe: quotedParticipant === cleanJid(sock.user?.id),
            id: contextInfo.stanzaId,
            participant: contextInfo.participant
          },
          message: contextInfo.quotedMessage
        },
        type: quotedType,
        msg: quotedMsg,
        text:
          quotedInner.conversation ||
          quotedInner.extendedTextMessage?.text ||
          quotedInner.imageMessage?.caption ||
          quotedInner.videoMessage?.caption ||
          quotedInner.documentMessage?.caption ||
          '',
        mentions: contextInfo.mentionedJid || [],
        download: async () => {
          const mediaKind = quotedType.replace('Message', '');
          const stream = await downloadContentFromMessage(quotedMsg, mediaKind);
          let buffer = Buffer.alloc(0);
          for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
          return buffer;
        }
      };
    } else {
      msg.quoted = null;
    }
  }

  // Method reply praktis
  msg.reply = async (text, options = {}) => {
    return sock.sendMessage(
      msg.chat,
      {
        text: String(text),
        mentions: options.mentions || (typeof text === 'string' ? parseMentions(text) : []),
        ...options
      },
      { quoted: msg.raw }
    );
  };

  // Helper download media pesan ini
  msg.download = async () => {
    if (!msg.type) return null;
    const mediaKind = msg.type.replace('Message', '');
    const stream = await downloadContentFromMessage(msg.msg, mediaKind);
    let buffer = Buffer.alloc(0);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
  };

  return msg;
}

/**
 * Parsing mentions dari text string
 */
export function parseMentions(text = '') {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(/@(\d{5,16})/g) || [];
  return matches.map((v) => `${v.slice(1)}@s.whatsapp.net`);
}

/**
 * Regex & Helper pendeteksi segala jenis tautan / link web dan domain
 * Mendukung http://, https://, chat WA, sosmed, shortlink, serta domain tanpa protokol (.com, .my.id, .biz.id, dll)
 */
export const URL_REGEX = /(?:https?|ftp):\/\/[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|t\.me\/[^\s]+|linktr\.ee\/[^\s]+|www\.[a-zA-Z0-9-]+\.[^\s]+|\b[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.(?:com|net|org|edu|gov|mil|int|id|co|io|me|ai|xyz|biz|info|app|dev|site|online|top|club|store|shop|vip|pro|tech|cloud|space|fun|icu|asia|tv|cc|gg|to|ly|is|in|us|uk|ru|de|jp|br|ca|au|fr|ch|it|nl|se|no|es|eu|link|live|news|blog|click|work|today|press|agency|mobi|social|best|digital|world|pub|guru|cok|my\.id|biz\.id|web\.id|co\.id|ac\.id|sch\.id|go\.id|or\.id|mil\.id)(?:\/[^\s]*)?\b/i;

export function isUrl(text) {
  if (!text || typeof text !== 'string') return false;
  if (URL_REGEX.test(text)) return true;
  const cleaned = text.replace(/\[\.\]|\(\.\)/g, '.');
  return URL_REGEX.test(cleaned);
}

/**
 * Update status participant di grup (remove / promote / demote) dengan penanganan multi-ID (LID & Phone JID)
 */
export async function updateParticipantGroup(sock, chatId, target, action, participants = []) {
  if (!target) throw new Error('Target tidak ditentukan.');

  const botJid = cleanJid(sock.user?.id);
  const botLid = cleanJid(sock.user?.lid);
  const botNum = formatNumber(botJid);

  const cleanTarget = cleanJid(target);
  const numTarget = formatNumber(target);

  // 1. Validasi aksi terhadap bot sendiri
  if (cleanTarget === botJid || cleanTarget === botLid || (numTarget && numTarget === botNum)) {
    if (action === 'remove') throw new Error('Tidak bisa mengeluarkan bot sendiri dari grup.');
    if (action === 'demote') throw new Error('Tidak bisa menurunkan jabatan (demote) bot sendiri.');
    if (action === 'promote') throw new Error('Bot sudah menjadi admin grup.');
  }

  // 2. Cari data participant di grup
  const participantObj = findParticipant(participants, target);

  // 3. Validasi aturan admin / superadmin WhatsApp
  if (action === 'demote') {
    if (participantObj?.admin === 'superadmin') {
      throw new Error('Tidak bisa menurunkan jabatan pembuat / ketua grup (superadmin).');
    }
    if (participantObj && participantObj.admin !== 'admin') {
      throw new Error('Member ini memang bukan admin grup.');
    }
  }

  if (action === 'promote') {
    if (participantObj && (participantObj.admin === 'admin' || participantObj.admin === 'superadmin')) {
      throw new Error('Member ini sudah menjadi admin grup.');
    }
  }

  if (action === 'remove') {
    if (participantObj?.admin === 'superadmin') {
      throw new Error('Tidak bisa mengeluarkan pembuat / ketua grup (superadmin).');
    }
  }

  // 4. Tentukan JID yang sesuai dengan protokol WhatsApp
  let jidsToTry = [];

  if (action === 'promote' || action === 'demote') {
    // WhatsApp mewajibkan Phone JID (@s.whatsapp.net) untuk promote & demote
    let pnJid = resolveJid(target, participants);
    if (!pnJid || pnJid.endsWith('@lid')) {
      const mapInfo = getLidMappingFromFile(cleanTarget) || (numTarget ? getLidMappingFromFile(numTarget) : null);
      if (mapInfo?.pn) pnJid = cleanJid(mapInfo.pn);
    }
    if (!pnJid || pnJid.endsWith('@lid')) {
      if (sock.signalRepository?.lidMapping && cleanTarget.endsWith('@lid')) {
        try {
          const mapped = await sock.signalRepository.lidMapping.getPNForLID(cleanTarget);
          if (mapped) pnJid = cleanJid(mapped);
        } catch {}
      }
    }
    if (pnJid && !pnJid.endsWith('@lid')) {
      jidsToTry.push(pnJid);
    } else if (cleanTarget.endsWith('@s.whatsapp.net')) {
      jidsToTry.push(cleanTarget);
    } else if (numTarget) {
      jidsToTry.push(`${numTarget}@s.whatsapp.net`);
    } else {
      throw new Error('Gagal mendapatkan nomor WhatsApp akun ini untuk di-promote/demote.');
    }
  } else {
    // Untuk remove (kick), utamakan ID peserta di grup (LID di grup LID, PN di grup PN)
    if (participantObj?.id) jidsToTry.push(cleanJid(participantObj.id));
    if (!jidsToTry.includes(cleanTarget)) jidsToTry.push(cleanTarget);
    
    // Tambahkan alternatif jika diperlukan
    let altJid = resolveJid(cleanTarget, participants);
    if (altJid && !jidsToTry.includes(altJid)) jidsToTry.push(altJid);
  }

  let lastError = null;
  for (const jid of jidsToTry) {
    try {
      const res = await sock.groupParticipantsUpdate(chatId, [jid], action);
      const status = res?.[0]?.status;
      if (!status || status === '200') {
        return {
          success: true,
          kickedJid: jid,
          targetNum: numTarget || formatNumber(jid),
          participant: participantObj
        };
      }

      const errorMap = {
        '400': 'Format identitas tidak diterima oleh server WhatsApp.',
        '403': 'Bot tidak memiliki wewenang admin untuk aksi ini.',
        '404': 'Member tidak ditemukan di dalam grup.',
        '408': 'Member baru saja keluar dari grup.',
        '409': 'Status member sudah sesuai.'
      };
      lastError = new Error(errorMap[status] || `WhatsApp mengembalikan status error ${status}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error(`Gagal melakukan ${action} pada member.`);
}

/**
 * Helper khusus mengeluarkan (kick) anggota dari grup
 */
export async function kickParticipant(sock, chatId, target, participants = []) {
  return updateParticipantGroup(sock, chatId, target, 'remove', participants);
}

/**
 * Ambil semua variasi JID peserta grup (p.id, p.lid, nomor HP @s.whatsapp.net)
 * Sangat penting untuk hidetag, tagall, dan totag agar mention terkirim
 * baik untuk akun beralamat LID maupun beralamat nomor telepon biasa.
 */
export function getAllParticipantJids(participants = []) {
  const mentions = [];
  const seen = new Set();

  function addJid(jid) {
    if (!jid) return;
    const clean = cleanJid(jid);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      mentions.push(clean);
    }
  }

  for (const p of participants || []) {
    // 1. ID peserta di grup (LID pada grup LID, PN pada grup PN)
    const rawId = p.id || p.jid;
    addJid(rawId);

    // 2. Properti LID eksplisit jika ada
    addJid(p.lid);

    // 3. Properti phoneNumber jika ada
    if (p.phoneNumber) {
      const pnStr = String(p.phoneNumber).replace(/\D/g, '');
      if (pnStr) addJid(`${pnStr}@s.whatsapp.net`);
    }

    // 4. Resolved phone JID lewat cache / session disk
    const resolved = resolveJid(rawId, participants);
    addJid(resolved);

    // 5. Cek pemetaan file session disk
    const mapInfo = getLidMappingFromFile(rawId);
    if (mapInfo?.lid) addJid(mapInfo.lid);
    if (mapInfo?.pn) addJid(mapInfo.pn);
  }

  return mentions;
}

/**
 * WhatsApp ReadMore fold (4001 invisible LRM characters)
 * Digunakan untuk menyembunyikan mention atau teks panjang di balik "... Baca selengkapnya"
 */
export const readMore = String.fromCharCode(8206).repeat(4001);
