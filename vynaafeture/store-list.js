import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storeDir = path.resolve(__dirname, '../storage/store');

if (!fs.existsSync(storeDir)) {
  fs.mkdirSync(storeDir, { recursive: true });
}

/**
 * Helper pengiriman pesan list/produk (media / teks murni)
 * Memastikan karakter baris baru (\n) dan format paragraf tetap terjaga utuh
 */
async function sendStoreItem(vynaa, m, item) {
  if (!item) return false;
  const displayText = (item.text || '').replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');

  // 1. Jika list menyimpan media
  if (item.media && item.media.filePath && fs.existsSync(item.media.filePath)) {
    const buffer = fs.readFileSync(item.media.filePath);
    const caption = displayText;
    const qType = item.media.type;

    if (qType === 'imageMessage') {
      await vynaa.sendMessage(m.chat, { image: buffer, caption }, { quoted: m.raw });
      return true;
    }
    if (qType === 'videoMessage') {
      await vynaa.sendMessage(m.chat, { video: buffer, caption }, { quoted: m.raw });
      return true;
    }
    if (qType === 'documentMessage') {
      await vynaa.sendMessage(m.chat, {
        document: buffer,
        mimetype: item.media.mimetype || 'application/octet-stream',
        fileName: item.media.fileName || 'document',
        caption
      }, { quoted: m.raw });
      return true;
    }
    if (qType === 'stickerMessage') {
      await vynaa.sendMessage(m.chat, { sticker: buffer }, { quoted: m.raw });
      return true;
    }
    if (qType === 'audioMessage') {
      await vynaa.sendMessage(m.chat, {
        audio: buffer,
        mimetype: item.media.mimetype || 'audio/mp4',
        ptt: item.media.ptt || false
      }, { quoted: m.raw });
      return true;
    }
  }

  // 2. Pesan teks murni
  if (displayText) {
    await m.reply(displayText);
    return true;
  }
  return false;
}

export default {
  name: 'store',
  command: ['addlist', 'addstore', 'updatelist', 'editlist', 'dellist', 'delstore', 'list', 'store', 'getlist'],
  menu: ['addlist', 'updatelist', 'dellist', 'list'],
  category: 'store',
  description: 'Fitur toko / list grup jualan (addlist, updatelist, dellist, list, dan auto-respon keyword)',
  group: true,

  /**
   * Hook sebelum pesan diproses perintah:
   * Otomatis membalas jika ada anggota grup yang mengetikkan nama produk/list
   */
  async before({ vynaa, m, chat, isGroup }) {
    if (!isGroup || !chat || !chat.store) return false;

    const raw = (m.body || '').trim().toLowerCase();
    if (!raw) return false;

    // Bersihkan kemungkinan prefix (.dm ff atau dm ff)
    const stripped = raw.replace(/^[.!#/$]/, '').trim();

    const matchedKey = (chat.store[raw] && raw) || (chat.store[stripped] && stripped);
    if (!matchedKey) return false;

    // Jangan tangkap jika itu perintah manajemen store sendiri
    const reservedCommands = ['addlist', 'addstore', 'updatelist', 'editlist', 'dellist', 'delstore', 'list', 'store', 'menu', 'help'];
    if (reservedCommands.includes(matchedKey)) return false;

    const item = chat.store[matchedKey];
    if (!item) return false;

    try {
      return await sendStoreItem(vynaa, m, item);
    } catch (err) {
      console.error('[Store Auto-Response Error]', err);
    }

    return false;
  },

  async execute({ vynaa, m, text, args, command, prefix, isAdmin, isOwner, chat, groupMetadata, db }) {
    if (!chat.store) {
      chat.store = {};
    }

    const groupName = groupMetadata?.subject || 'Grup';

    // ==========================================
    // 1. LIHAT DAFTAR LIST (LIST / STORE) - URUTAN KONSISTEN
    // ==========================================
    if (command === 'list' || command === 'store') {
      const query = text.trim().toLowerCase();
      // Jika user mengetik ".list <nama produk>", langsung tampilkan isi list tersebut
      if (query) {
        const item = chat.store[query];
        if (item) {
          await sendStoreItem(vynaa, m, item);
          return;
        } else {
          return m.reply(`Produk/list "${text.trim()}" tidak ditemukan di grup ini. Ketik *${prefix}list* untuk melihat daftar.`);
        }
      }

      const keys = Object.keys(chat.store);

      if (keys.length === 0) {
        return m.reply(
          `*Daftar Produk / List Toko:*\n\n` +
          `Belum ada daftar produk/list yang disimpan di grup ini.\n` +
          (isAdmin ? `Ketik *${prefix}addlist <nama> | <isi>* atau reply pesan jualan untuk menambah list.` : '')
        );
      }

      // Urutkan secara konsisten berdasarkan createdAt (agar urutan item selalu stabil dan tidak acak)
      const sortedKeys = keys.sort((a, b) => {
        const timeA = chat.store[a].createdAt || 0;
        const timeB = chat.store[b].createdAt || 0;
        if (timeA !== timeB) return timeA - timeB;
        return a.localeCompare(b);
      });

      let res = `┌── [ DAFTAR PRODUK / LIST ]\n│\n`;
      res += `├ Grup : ${groupName}\n`;
      res += `├ Total: ${sortedKeys.length} Produk\n│\n`;
      res += `├── [ DAFTAR ITEM ]\n`;

      let count = 1;
      for (const k of sortedKeys) {
        res += `│ ├ ${count++}. ${chat.store[k].key || k}\n`;
      }

      res += `│\n└── [ Ketik nama produk langsung untuk melihat detail ]`;
      return m.reply(res);
    }

    // ==========================================
    // 2. GET LIST MANUAL (GETLIST)
    // ==========================================
    if (command === 'getlist') {
      const targetKey = text.trim().toLowerCase();
      if (!targetKey) {
        return m.reply(`Ketik *${prefix}getlist <nama produk>* untuk melihat isi list.`);
      }

      const item = chat.store[targetKey];
      if (!item) {
        return m.reply(`Produk/list "${text.trim()}" tidak ditemukan di grup ini. Ketik *${prefix}list* untuk melihat daftar.`);
      }

      await sendStoreItem(vynaa, m, item);
      return;
    }

    // ==========================================
    // PERINTAH ADMIN & OWNER DI BAWAH INI
    // ==========================================
    if (!isAdmin && !isOwner) {
      return m.reply('Perintah ini hanya dapat digunakan oleh Admin atau Owner bot.');
    }

    // ==========================================
    // 3. TAMBAH & UPDATE LIST (ADDLIST / UPDATELIST)
    // ==========================================
    const isUpdateCmd = command === 'updatelist' || command === 'editlist';

    if (command === 'addlist' || command === 'addstore' || isUpdateCmd) {
      let listKey = '';
      let listText = '';
      let mediaData = null;
      let hasNewMedia = false;

      // Skenario A: Reply pesan media (gambar, video, dokumen, stiker, audio)
      if (m.quoted && m.quoted.type && m.quoted.type !== 'conversation' && m.quoted.type !== 'extendedTextMessage') {
        listKey = text.trim();
        if (!listKey) {
          return m.reply(
            `*Cara ${isUpdateCmd ? 'Update' : 'Tambah'} List dengan Gambar/Media:*\n` +
            `Reply gambar/video produk, lalu ketik:\n` +
            `*${prefix + command} <nama list>*\n\n` +
            `Contoh: *${prefix + command} dm ff*`
          );
        }

        // Cek jika ada deskripsi tambahan via pemisah '|'
        if (listKey.includes('|')) {
          const parts = listKey.split('|');
          listKey = parts[0].trim();
          listText = parts.slice(1).join('|').trim();
        } else {
          listText = m.quoted.text || '';
        }

        try {
          const buffer = await m.quoted.download();
          if (buffer && buffer.length > 0) {
            const cleanChat = m.chat.replace(/[^a-zA-Z0-9]/g, '_');
            const cleanKey = listKey.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
            const groupStoreDir = path.join(storeDir, cleanChat);
            if (!fs.existsSync(groupStoreDir)) {
              fs.mkdirSync(groupStoreDir, { recursive: true });
            }

            const ext = m.quoted.type === 'imageMessage' ? 'jpeg' :
                        m.quoted.type === 'videoMessage' ? 'mp4' :
                        m.quoted.type === 'stickerMessage' ? 'webp' :
                        m.quoted.type === 'audioMessage' ? 'mp3' : 'bin';

            const filePath = path.join(groupStoreDir, `${cleanKey}.${ext}`);
            fs.writeFileSync(filePath, buffer);

            mediaData = {
              type: m.quoted.type,
              filePath,
              mimetype: m.quoted.msg?.mimetype || 'application/octet-stream',
              fileName: m.quoted.msg?.fileName || `${cleanKey}.${ext}`
            };
            hasNewMedia = true;
          }
        } catch (err) {
          console.error('[Addlist Download Error]', err);
          return m.reply('Gagal mengunduh media dari pesan yang di-reply.');
        }
      }
      // Skenario B: Reply pesan teks
      else if (m.quoted && m.quoted.text) {
        listKey = text.trim();
        if (!listKey) {
          return m.reply(
            `*Cara ${isUpdateCmd ? 'Update' : 'Tambah'} List dari Reply Teks:*\n` +
            `Reply pesan teks jualan, lalu ketik:\n` +
            `*${prefix + command} <nama list>*\n\n` +
            `Contoh: *${prefix + command} dm ff*`
          );
        }
        if (listKey.includes('|')) {
          const parts = listKey.split('|');
          listKey = parts[0].trim();
          listText = parts.slice(1).join('|').trim();
        } else {
          listText = m.quoted.text.trim();
        }
      }
      // Skenario C: Format teks langsung dengan pemisah '|'
      else if (text.includes('|')) {
        const parts = text.split('|');
        listKey = parts[0].trim();
        listText = parts.slice(1).join('|').trim();
      }
      // Skenario D: Format teks langsung dengan baris baru (baris 1 = nama list, baris berikutnya = isi list)
      else if (text.includes('\n')) {
        const firstNewline = text.indexOf('\n');
        const candidateKey = text.slice(0, firstNewline).trim();
        const candidateText = text.slice(firstNewline).trim();
        if (candidateKey && candidateText) {
          listKey = candidateKey;
          listText = candidateText;
        }
      }
      // Tidak memenuhi format
      else {
        return m.reply(
          `*Panduan Fitur ${isUpdateCmd ? 'Update List' : 'Addlist'} (Grup Jualan):*\n\n` +
          `1. *Ketik langsung dengan pemisah |*\n` +
          `   Contoh:\n` +
          `   *${prefix + command} dm ff | 70 DM: 10k\n140 DM: 20k*\n\n` +
          `2. *Reply pesan teks jualan*\n` +
          `   Reply pesan lalu ketik: *${prefix + command} dm ff*\n\n` +
          `3. *Reply gambar / foto produk*\n` +
          `   Reply foto jualan lalu ketik: *${prefix + command} dm ff*`
        );
      }

      const keyLower = listKey.toLowerCase();
      if (!keyLower) {
        return m.reply('Nama list tidak boleh kosong.');
      }

      // Normalisasi baris baru lintas OS tanpa merusak susunan paragraf
      if (listText) {
        listText = listText.replace(/\\r\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\\n/g, '\n');
      }

      const existing = chat.store[keyLower];

      // Jika menggunakan perintah updatelist/editlist tapi item belum pernah ada
      if (isUpdateCmd && !existing) {
        return m.reply(`Produk/list "${listKey}" belum terdaftar di grup ini. Gunakan *${prefix}addlist* untuk menambahkannya.`);
      }

      // Hapus media lama jika diganti dengan media baru
      if (hasNewMedia && existing?.media?.filePath && existing.media.filePath !== mediaData.filePath) {
        try {
          if (fs.existsSync(existing.media.filePath)) {
            fs.unlinkSync(existing.media.filePath);
          }
        } catch {}
      }

      // Pertahankan media lama jika hanya mengupdate teks saja
      const finalMedia = hasNewMedia ? mediaData : (existing?.media || null);

      // Simpan ke database grup dengan menjaga createdAt agar URUTAN KONSISTEN
      chat.store[keyLower] = {
        key: listKey,
        text: listText,
        media: finalMedia,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
        addedBy: existing?.addedBy || m.senderNumber,
        updatedBy: m.senderNumber
      };

      db.saveSync();

      const actionText = existing ? 'Memperbarui' : 'Menyimpan';
      return m.reply(
        `✅ *Berhasil ${actionText} List (Urutan Tetap Konsisten):*\n` +
        `• *Nama Produk*: ${listKey}\n` +
        `• *Tipe*: ${finalMedia ? 'Media + Teks' : 'Teks'}\n\n` +
        `_Siapapun yang mengetik "${listKey}" di grup ini akan otomatis menerima respon produk tersebut._`
      );
    }

    // ==========================================
    // 4. HAPUS LIST (DELLIST / DELSTORE)
    // ==========================================
    if (command === 'dellist' || command === 'delstore') {
      const keyLower = text.trim().toLowerCase();
      if (!keyLower) {
        return m.reply(
          `*Cara Hapus List:*\n` +
          `Ketik: *${prefix + command} <nama list>*\n` +
          `Contoh: *${prefix + command} dm ff*`
        );
      }

      if (!chat.store[keyLower]) {
        return m.reply(`Produk/list "${text}" tidak ditemukan di grup ini. Ketik *${prefix}list* untuk melihat daftar.`);
      }

      // Hapus file media jika ada
      const item = chat.store[keyLower];
      if (item?.media?.filePath && fs.existsSync(item.media.filePath)) {
        try {
          fs.unlinkSync(item.media.filePath);
        } catch {}
      }

      delete chat.store[keyLower];
      db.saveSync();

      return m.reply(`✅ Berhasil menghapus list/produk "${text}" dari grup ini.`);
    }
  }
};
