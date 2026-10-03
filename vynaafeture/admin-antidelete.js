import db from '../lib/database.js';

export default {
  name: 'antidelete',
  command: ['antidelete', 'antitarik'],
  menu: ['antidelete [on/off]'],
  category: 'admin',
  description: 'Mendeteksi dan mengirim ulang pesan member yang ditarik/dihapus di grup',
  group: true,
  admin: true,

  async execute({ vynaa, m, args, prefix, chat }) {
    if (!chat) return m.reply('Data grup tidak ditemukan.');

    const arg = (args[0] || '').toLowerCase();

    if (arg === 'on' || arg === '1' || arg === 'aktif' || arg === 'enable') {
      chat.antidelete = true;
      db.saveSync();
      return m.reply(
        `✅ *Fitur Antidelete Berhasil Diaktifkan!*\n\n` +
        `_Jika ada member yang menarik / menghapus pesan (Delete for Everyone), bot akan otomatis memunculkan kembali pesan tersebut._`
      );
    }

    if (arg === 'off' || arg === '0' || arg === 'mati' || arg === 'disable') {
      chat.antidelete = false;
      db.saveSync();
      return m.reply('❌ Fitur *Antidelete* berhasil dinonaktifkan di grup ini.');
    }

    return m.reply(
      `*Pengaturan Fitur Antidelete:*\n` +
      `• Status saat ini: *${chat.antidelete ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'}*\n\n` +
      `*Perintah:*\n` +
      `• *${prefix}antidelete on* : Mengaktifkan deteksi pesan ditarik\n` +
      `• *${prefix}antidelete off* : Menonaktifkan deteksi`
    );
  }
};
