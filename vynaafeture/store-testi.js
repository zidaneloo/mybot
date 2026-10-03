import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testiDir = path.resolve(__dirname, '../storage/testi');

if (!fs.existsSync(testiDir)) {
  fs.mkdirSync(testiDir, { recursive: true });
}

function getWibTime() {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date()) + ' WIB';
  } catch {
    return new Date().toLocaleDateString('id-ID');
  }
}

export default {
  name: 'testi',
  command: ['testi', 'addtesti', 'deltesti', 'listtesti', 'hapustesti'],
  menu: ['addtesti [teks/reply foto]', 'testi [nomor]', 'deltesti [nomor]'],
  category: 'store',
  description: 'Manajemen arsip testimoni toko jualan per grup (khusus admin & owner)',
  group: true,

  async execute({ vynaa, m, text, args, command, prefix, isAdmin, isOwner, chat, groupMetadata, db }) {
    if (!chat.testi || !Array.isArray(chat.testi)) {
      chat.testi = [];
    }

    const groupName = groupMetadata?.subject || 'Grup WhatsApp';

    // ==========================================
    // 1. TAMBAH TESTIMONI (ADDTESTI) - ADMIN & OWNER
    // ==========================================
    if (command === 'addtesti') {
      if (!isAdmin && !isOwner) {
        return m.reply('Perintah ini hanya dapat digunakan oleh Admin atau Owner bot.');
      }

      let testiText = text.trim();
      let mediaData = null;

      // Skenario A: Reply foto/gambar bukti transaksi
      if (m.quoted && m.quoted.type === 'imageMessage') {
        try {
          const buffer = await m.quoted.download();
          if (buffer && buffer.length > 0) {
            const cleanChat = m.chat.replace(/[^a-zA-Z0-9]/g, '_');
            const groupTestiDir = path.join(testiDir, cleanChat);
            if (!fs.existsSync(groupTestiDir)) {
              fs.mkdirSync(groupTestiDir, { recursive: true });
            }

            const fileName = `testi_${Date.now()}.jpeg`;
            const filePath = path.join(groupTestiDir, fileName);
            fs.writeFileSync(filePath, buffer);

            mediaData = {
              type: 'imageMessage',
              filePath,
              mimetype: 'image/jpeg'
            };

            // Jika ada keterangan tambahan saat mengetik .addtesti atau dari caption quoted
            if (!testiText) {
              testiText = m.quoted.text || 'Bukti transaksi sukses pelanggan';
            }
          }
        } catch (err) {
          console.error('[AddTesti Download Error]', err);
          return m.reply('Gagal mengunduh foto bukti testimoni yang di-reply.');
        }
      }
      // Skenario B: Reply teks pesan testimoni
      else if (m.quoted && m.quoted.text) {
        testiText = text.trim() ? `${text.trim()}\n\n"${m.quoted.text.trim()}"` : m.quoted.text.trim();
      }

      if (!testiText && !mediaData) {
        return m.reply(
          `*Cara Menambah Testimoni Grup:*\n\n` +
          `1. *Reply Foto/Screenshot Bukti Transaksi:*\n` +
          `   Reply foto lalu ketik: *${prefix}addtesti [keterangan]*\n\n` +
          `2. *Teks Review Langsung:*\n` +
          `   *${prefix}addtesti Orderan Diamond FF 140 Done Cepat & Amanah!*\n\n` +
          `3. *Reply Chat Pembeli:*\n` +
          `   Reply chat pembeli lalu ketik: *${prefix}addtesti*`
        );
      }

      // Format baris baru
      testiText = testiText.replace(/\\r\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\\n/g, '\n');

      const newItem = {
        id: Date.now(),
        text: testiText,
        media: mediaData,
        addedBy: m.senderNumber,
        dateStr: getWibTime()
      };

      chat.testi.push(newItem);
      db.saveSync();

      return m.reply(
        `✅ *Testimoni Berhasil Ditambahkan!*\n\n` +
        `• *Nomor Testi* : #${chat.testi.length}\n` +
        `• *Tipe*        : ${mediaData ? '📷 Foto + Teks' : '📝 Teks'}\n` +
        `• *Waktu*       : ${newItem.dateStr}\n\n` +
        `_Ketik *${prefix}testi ${chat.testi.length}* untuk melihat detail testimoni._`
      );
    }

    // ==========================================
    // 2. HAPUS TESTIMONI (DELTESTI) - ADMIN & OWNER
    // ==========================================
    if (command === 'deltesti' || command === 'hapustesti') {
      if (!isAdmin && !isOwner) {
        return m.reply('Perintah ini hanya dapat digunakan oleh Admin atau Owner bot.');
      }

      const index = parseInt(args[0]) - 1;
      if (isNaN(index) || index < 0 || index >= chat.testi.length) {
        return m.reply(`Nomor testimoni tidak valid. Ketik *${prefix}testi* untuk melihat daftar nomor testimoni.`);
      }

      const deleted = chat.testi.splice(index, 1)[0];

      // Hapus file foto jika ada
      if (deleted?.media?.filePath && fs.existsSync(deleted.media.filePath)) {
        try {
          fs.unlinkSync(deleted.media.filePath);
        } catch {}
      }

      db.saveSync();
      return m.reply(`✅ Berhasil menghapus Testimoni #${index + 1} dari grup ini.`);
    }

    // ==========================================
    // 3. LIHAT TESTIMONI (TESTI / LISTTESTI) - BISA DIAKSES SEMUA MEMBER
    // ==========================================
    if (command === 'testi' || command === 'listtesti') {
      if (chat.testi.length === 0) {
        return m.reply(
          `*Daftar Testimoni Toko:*\n\n` +
          `Belum ada testimoni yang disimpan di grup ini.\n` +
          (isAdmin || isOwner ? `Admin dapat menambahkannya dengan *${prefix}addtesti* (reply foto transfer/chat).` : '')
        );
      }

      // Jika user memilih nomor spesifik (misal: .testi 1)
      const targetNum = parseInt(args[0]);
      if (!isNaN(targetNum) && targetNum >= 1 && targetNum <= chat.testi.length) {
        const item = chat.testi[targetNum - 1];
        const caption = `┌── [ 🌟 TESTIMONI #${targetNum} ]
│
├ Grup  : ${groupName}
├ Waktu : ${item.dateStr || '-'}
│
├ Catatan Pembeli:
${item.text}
│
└── [ Terimakasih telah order dan berlangganan di toko kami! ]`;

        // Jika memiliki foto bukti screenshot
        if (item.media && item.media.filePath && fs.existsSync(item.media.filePath)) {
          const buffer = fs.readFileSync(item.media.filePath);
          return await vynaa.sendMessage(m.chat, {
            image: buffer,
            caption
          }, { quoted: m.raw });
        }

        return m.reply(caption);
      }

      // Tampilkan seluruh daftar ringkasan testimoni
      let res = `┌── [ 🌟 ARSIP TESTIMONI TOKO ]\n│\n`;
      res += `├ Grup  : ${groupName}\n`;
      res += `├ Total : ${chat.testi.length} Bukti Transaksi\n│\n`;
      res += `├── [ DAFTAR TESTIMONI ]\n`;

      chat.testi.forEach((t, i) => {
        const shortText = t.text.split('\n')[0].slice(0, 35);
        const icon = t.media ? '📷' : '📝';
        res += `│ ├ ${i + 1}. ${icon} ${shortText}${t.text.length > 35 ? '...' : ''}\n`;
      });

      res += `│\n└── [ Ketik *${prefix}testi <nomor>* untuk melihat detail & foto ]`;
      return m.reply(res);
    }
  }
};
