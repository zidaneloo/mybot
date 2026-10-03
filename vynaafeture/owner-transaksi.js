import db from '../lib/database.js';
import { formatNumber, cleanJid } from '../lib/simple.js';

const DEFAULT_PROSES = `┌── [ TRANSAKSI DIPROSES ]
│
├ Pembeli : @user
├ Waktu   : %waktu%
├ Status  : ⏳ Sedang Diproses
│
├ Catatan : %pesan%
│
└── [ Mohon ditunggu, pesanan Anda sedang kami proses ]`;

const DEFAULT_DONE = `┌── [ TRANSAKSI SUKSES ]
│
├ Pembeli : @user
├ Waktu   : %waktu%
├ Status  : ✅ Selesai (DONE)
│
├ Catatan : %pesan%
│
└── [ Terimakasih telah order! Ditunggu orderan selanjutnya ya kak ]`;

/**
 * Helper pembaca template dengan fallback aman (mencegah TypeError jika bot belum restart)
 */
function getStoredTemplate(type) {
  if (typeof db.getTemplate === 'function') {
    return db.getTemplate(type);
  }
  if (!db.data) db.data = {};
  if (!db.data.settings) db.data.settings = {};
  if (!db.data.settings.templates) db.data.settings.templates = {};
  return db.data.settings.templates[type] || '';
}

/**
 * Helper penyimpan template dengan fallback aman
 */
function setStoredTemplate(type, text) {
  if (typeof db.setTemplate === 'function') {
    return db.setTemplate(type, text);
  }
  if (!db.data) db.data = {};
  if (!db.data.settings) db.data.settings = {};
  if (!db.data.settings.templates) db.data.settings.templates = {};
  db.data.settings.templates[type] = String(text);
  if (typeof db.saveSync === 'function') {
    db.saveSync();
  } else if (typeof db.save === 'function') {
    db.save();
  }
  return true;
}

/**
 * Format tanggal & waktu WIB
 */
function getWibTime() {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date()) + ' WIB';
  } catch {
    const d = new Date();
    return `${d.toLocaleDateString('id-ID')} ${d.toLocaleTimeString('id-ID')} WIB`;
  }
}

/**
 * Ganti variabel placeholder dalam template
 */
function renderTemplate(template, { userNumber, timeStr, note, orderText }) {
  let res = template;
  res = res.replace(/@user/g, `@${userNumber}`);
  res = res.replace(/%user%/gi, `@${userNumber}`);
  res = res.replace(/%(waktu|jam|tanggal)%/gi, timeStr);
  res = res.replace(/%(pesan|catatan|note)%/gi, note || 'Tidak ada catatan');
  res = res.replace(/%order%/gi, orderText || note || 'Pesanan');
  return res;
}

export default {
  name: 'transaksi',
  command: ['proses', 'p', 'done', 'd', 'setproses', 'setdone', 'cekproses', 'cekdone'],
  menu: ['proses', 'done', 'setproses', 'setdone'],
  category: 'store',
  description: 'Fitur proses & done transaksi pesanan dengan custom template per grup (khusus admin & owner)',
  group: true,
  admin: true,

  async execute({ vynaa, m, text, command, prefix, chat, db }) {
    if (chat && !chat.templates) {
      chat.templates = {};
    }

    // ==========================================
    // 1. SET TEMPLATE PROSES (SETPROSES)
    // ==========================================
    if (command === 'setproses') {
      const newTemplate = (text || m.quoted?.text || '').trim();

      if (!newTemplate) {
        return m.reply(
          `*Cara Mengatur Template Proses:*\n\n` +
          `1. *Ketik langsung (bisa teks panjang):*\n` +
          `   ${prefix}setproses <teks template>\n\n` +
          `2. *Atau reply pesan teks template lalu ketik:*\n` +
          `   ${prefix}setproses\n\n` +
          `*Variabel yang dapat digunakan:*\n` +
          `• *@user* atau *%user%* : Tag nomor pembeli\n` +
          `• *%waktu%* : Tanggal dan jam WIB\n` +
          `• *%pesan%* : Catatan tambahan atau isi orderan\n` +
          `• *%order%* : Teks pesan yang di-reply`
        );
      }

      if (chat) {
        chat.templates['proses'] = newTemplate;
      }
      setStoredTemplate('proses', newTemplate);
      if (db?.saveSync) db.saveSync();

      return m.reply(
        `✅ *Template PROSES grup berhasil disimpan!*\n\n` +
        `*Preview Tampilan:*\n` +
        `────────────────────\n` +
        `${renderTemplate(newTemplate, {
          userNumber: m.senderNumber,
          timeStr: getWibTime(),
          note: 'Diamond 140 FF',
          orderText: 'Order Diamond'
        })}`
      );
    }

    // ==========================================
    // 2. SET TEMPLATE DONE (SETDONE)
    // ==========================================
    if (command === 'setdone') {
      const newTemplate = (text || m.quoted?.text || '').trim();

      if (!newTemplate) {
        return m.reply(
          `*Cara Mengatur Template Done:*\n\n` +
          `1. *Ketik langsung (bisa teks panjang):*\n` +
          `   ${prefix}setdone <teks template>\n\n` +
          `2. *Atau reply pesan teks template lalu ketik:*\n` +
          `   ${prefix}setdone\n\n` +
          `*Variabel yang dapat digunakan:*\n` +
          `• *@user* atau *%user%* : Tag nomor pembeli\n` +
          `• *%waktu%* : Tanggal dan jam WIB\n` +
          `• *%pesan%* : Catatan tambahan atau isi orderan\n` +
          `• *%order%* : Teks pesan yang di-reply`
        );
      }

      if (chat) {
        chat.templates['done'] = newTemplate;
      }
      setStoredTemplate('done', newTemplate);
      if (db?.saveSync) db.saveSync();

      return m.reply(
        `✅ *Template DONE grup berhasil disimpan!*\n\n` +
        `*Preview Tampilan:*\n` +
        `────────────────────\n` +
        `${renderTemplate(newTemplate, {
          userNumber: m.senderNumber,
          timeStr: getWibTime(),
          note: 'Diamond 140 FF Berhasil Terkirim',
          orderText: 'Order Diamond'
        })}`
      );
    }

    // ==========================================
    // 3. CEK TEMPLATE (CEKPROSES / CEKDONE)
    // ==========================================
    if (command === 'cekproses') {
      const tmpl = chat?.templates?.['proses'] || getStoredTemplate('proses') || DEFAULT_PROSES;
      return m.reply(`*Template PROSES Grup Saat Ini:*\n\n${tmpl}`);
    }

    if (command === 'cekdone') {
      const tmpl = chat?.templates?.['done'] || getStoredTemplate('done') || DEFAULT_DONE;
      return m.reply(`*Template DONE Grup Saat Ini:*\n\n${tmpl}`);
    }

    // ==========================================
    // 4. EKSEKUSI PROSES & DONE
    // ==========================================
    let buyerJid = '';
    let buyerNumber = '';
    let quotedMessage = null;

    if (m.quoted) {
      buyerJid = cleanJid(m.quoted.sender);
      buyerNumber = formatNumber(buyerJid);
      quotedMessage = m.quoted.raw || m.raw;
    } else if (m.mentions && m.mentions.length > 0) {
      buyerJid = cleanJid(m.mentions[0]);
      buyerNumber = formatNumber(buyerJid);
      quotedMessage = m.raw;
    } else {
      buyerJid = cleanJid(m.sender);
      buyerNumber = m.senderNumber;
      quotedMessage = m.raw;
    }

    const timeStr = getWibTime();
    const orderText = m.quoted?.text || '';
    const note = text.trim() || (orderText ? orderText : 'Pesanan Pelanggan');

    const mentions = [buyerJid].filter(Boolean);

    // Kirim respon PROSES
    if (command === 'proses' || command === 'p') {
      const template = chat?.templates?.['proses'] || getStoredTemplate('proses') || DEFAULT_PROSES;
      const finalMsg = renderTemplate(template, {
        userNumber: buyerNumber,
        timeStr,
        note,
        orderText
      });

      return await vynaa.sendMessage(m.chat, {
        text: finalMsg,
        mentions
      }, { quoted: quotedMessage });
    }

    // Kirim respon DONE
    if (command === 'done' || command === 'd') {
      const template = chat?.templates?.['done'] || getStoredTemplate('done') || DEFAULT_DONE;
      const finalMsg = renderTemplate(template, {
        userNumber: buyerNumber,
        timeStr,
        note,
        orderText
      });

      return await vynaa.sendMessage(m.chat, {
        text: finalMsg,
        mentions
      }, { quoted: quotedMessage });
    }
  }
};
