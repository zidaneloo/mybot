import db from '../lib/database.js';

// Cache memori untuk anti-spam (deteksi kecepatan kirim chat per sender)
const spamTracker = new Map();

export const DEFAULT_BADWORDS = [
  'anjing', 'babi', 'kontol', 'memek', 'jembut',
  'bangsat', 'ngentot', 'puki', 'pantek', 'asu',
  'bajingan', 'tolol', 'goblok', 'idiot', 'lonte'
];

export default {
  name: 'antispam',
  command: ['antispam', 'antibadword', 'addbadword', 'delbadword', 'listbadword'],
  menu: ['antispam [on/off]', 'antibadword [on/off]', 'addbadword [kata]', 'listbadword'],
  category: 'admin',
  description: 'Proteksi grup dari spam chat bertubi-tubi dan sensor kata-kata kasar / toxic',
  group: true,
  admin: true,

  /**
   * Hook sebelum pesan diproses perintah: Deteksi spam & badwords secara realtime
   */
  async before({ vynaa, m, chat, isGroup, isAdmin, isOwner, isBotAdmin }) {
    if (!isGroup || !chat || isAdmin || isOwner || m.fromMe) return false;

    const senderKey = `${m.chat}_${m.sender}`;
    const now = Date.now();

    // ==========================================
    // 1. CEK ANTI-SPAM
    // ==========================================
    if (chat.antispam) {
      if (!spamTracker.has(senderKey)) {
        spamTracker.set(senderKey, []);
      }

      const timestamps = spamTracker.get(senderKey);
      // Simpan hanya riwayat dalam 4 detik terakhir
      const recent = timestamps.filter((t) => now - t < 4000);
      recent.push(now);
      spamTracker.set(senderKey, recent);

      // Jika mengirim lebih dari 5 pesan dalam 4 detik -> SPAM TERDETEKSI
      if (recent.length > 5) {
        if (isBotAdmin) {
          await vynaa.sendMessage(m.chat, { delete: m.raw.key }).catch(() => {});
        }
        if (recent.length === 6) {
          await m.reply(
            `⚠️ *PERINGATAN SPAM*\n` +
            `Halo @${m.senderNumber}, tolong jangan spam chat di grup ini ya!`,
            { mentions: [m.sender] }
          ).catch(() => {});
        }
        return true;
      }
    }

    // ==========================================
    // 2. CEK ANTI-BADWORD (KATA KASAR)
    // ==========================================
    if (chat.antibadword) {
      const textLower = (m.body || '').toLowerCase();
      if (!textLower) return false;

      const activeBadwords = Array.from(new Set([...DEFAULT_BADWORDS, ...(chat.badwords || [])]));
      const containsBadword = activeBadwords.some((word) => {
        if (!word) return false;
        const regex = new RegExp(`(^|\\s|[^a-zA-Z0-9])${word.toLowerCase()}($|\\s|[^a-zA-Z0-9])`, 'i');
        return regex.test(textLower);
      });

      if (containsBadword) {
        if (isBotAdmin) {
          await vynaa.sendMessage(m.chat, { delete: m.raw.key }).catch(() => {});
        }
        await m.reply(
          `⚠️ *SENSOR KATA TERLARANG*\n` +
          `Pesan dari @${m.senderNumber} dihapus karena mengandung kata-kata kasar / toxic. Harap jaga kesopanan di grup ini!`,
          { mentions: [m.sender] }
        ).catch(() => {});
        return true;
      }
    }

    return false;
  },

  async execute({ vynaa, m, text, args, command, prefix, chat }) {
    if (!chat) return m.reply('Data grup tidak ditemukan.');

    if (!Array.isArray(chat.badwords)) {
      chat.badwords = [];
    }

    // 1. TAMBAH KATA TERLARANG (ADDBADWORD)
    if (command === 'addbadword') {
      const word = text.trim().toLowerCase();
      if (!word) {
        return m.reply(`Ketik: *${prefix}addbadword <kata>* untuk menambahkan kata terlarang.`);
      }

      if (chat.badwords.includes(word) || DEFAULT_BADWORDS.includes(word)) {
        return m.reply(`Kata "${word}" sudah ada dalam daftar kata terlarang.`);
      }

      chat.badwords.push(word);
      db.saveSync();
      return m.reply(`✅ Berhasil menambahkan "${word}" ke daftar kata terlarang grup ini.`);
    }

    // 2. HAPUS KATA TERLARANG (DELBADWORD)
    if (command === 'delbadword') {
      const word = text.trim().toLowerCase();
      if (!word) {
        return m.reply(`Ketik: *${prefix}delbadword <kata>* untuk menghapus kata terlarang.`);
      }

      const index = chat.badwords.indexOf(word);
      if (index === -1) {
        return m.reply(`Kata "${word}" tidak ditemukan dalam daftar kustom grup ini.`);
      }

      chat.badwords.splice(index, 1);
      db.saveSync();
      return m.reply(`✅ Berhasil menghapus "${word}" dari daftar kata terlarang grup.`);
    }

    // 3. DAFTAR KATA TERLARANG (LISTBADWORD)
    if (command === 'listbadword') {
      const allWords = Array.from(new Set([...DEFAULT_BADWORDS, ...(chat.badwords || [])]));
      let res = `┌── [ DAFTAR KATA TERLARANG ]\n│\n`;
      let count = 1;
      for (const w of allWords) {
        res += `│ ├ ${count++}. ${w}\n`;
      }
      res += `│\n└── [ Total: ${allWords.length} Kata ]`;
      return m.reply(res);
    }

    // 4. ON / OFF ANTISPAM
    if (command === 'antispam') {
      const arg = (args[0] || '').toLowerCase();
      if (arg === 'on' || arg === '1' || arg === 'aktif' || arg === 'enable') {
        chat.antispam = true;
        db.saveSync();
        return m.reply('✅ Fitur *Anti-Spam* berhasil diaktifkan di grup ini.');
      }
      if (arg === 'off' || arg === '0' || arg === 'mati' || arg === 'disable') {
        chat.antispam = false;
        db.saveSync();
        return m.reply('❌ Fitur *Anti-Spam* berhasil dinonaktifkan di grup ini.');
      }
      return m.reply(
        `*Pengaturan Anti-Spam:*\n` +
        `• Status saat ini: *${chat.antispam ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'}*\n\n` +
        `*Perintah:*\n` +
        `• *${prefix}antispam on* : Aktifkan anti-spam\n` +
        `• *${prefix}antispam off* : Nonaktifkan anti-spam`
      );
    }

    // 5. ON / OFF ANTIBADWORD
    if (command === 'antibadword') {
      const arg = (args[0] || '').toLowerCase();
      if (arg === 'on' || arg === '1' || arg === 'aktif' || arg === 'enable') {
        chat.antibadword = true;
        db.saveSync();
        return m.reply('✅ Fitur *Anti-Badword* (Sensor Kata Kasar) berhasil diaktifkan.');
      }
      if (arg === 'off' || arg === '0' || arg === 'mati' || arg === 'disable') {
        chat.antibadword = false;
        db.saveSync();
        return m.reply('❌ Fitur *Anti-Badword* berhasil dinonaktifkan.');
      }
      return m.reply(
        `*Pengaturan Anti-Badword (Anti Kata Kasar):*\n` +
        `• Status saat ini: *${chat.antibadword ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'}*\n\n` +
        `*Perintah:*\n` +
        `• *${prefix}antibadword on* : Aktifkan sensor kata kasar\n` +
        `• *${prefix}antibadword off* : Nonaktifkan sensor\n` +
        `• *${prefix}addbadword <kata>* : Tambah kata terlarang kustom\n` +
        `• *${prefix}listbadword* : Lihat semua kata terlarang`
      );
    }
  }
};
