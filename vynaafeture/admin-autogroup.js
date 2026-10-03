import db from '../lib/database.js';

export default {
  name: 'autogroup',
  command: ['autogroup', 'autogc', 'setbuka', 'settutup', 'cekautogroup'],
  menu: ['autogroup [on/off]', 'setbuka [07:00]', 'settutup [22:00]'],
  category: 'admin',
  description: 'Jadwal otomatis buka dan tutup obrolan grup WhatsApp setiap hari secara otomatis',
  group: true,
  admin: true,

  async execute({ vynaa, m, text, args, command, prefix, chat }) {
    if (!chat) return m.reply('Data grup tidak ditemukan.');

    if (!chat.autogroup) {
      chat.autogroup = {
        active: false,
        openTime: '07:00',
        closeTime: '22:00',
        lastAction: ''
      };
    }

    // 1. SET WAKTU BUKA
    if (command === 'setbuka') {
      const timeInput = (text || args[0] || '').trim();
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

      if (!timeRegex.test(timeInput)) {
        return m.reply(
          `*Format jam tidak valid!*\n` +
          `Gunakan format 24 jam (HH:mm).\n` +
          `Contoh: *${prefix}setbuka 07:00*`
        );
      }

      chat.autogroup.openTime = timeInput;
      chat.autogroup.lastAction = '';
      db.saveSync();

      return m.reply(`✅ *Jadwal Buka Grup Berhasil Diatur:*\n• Jam Buka: *${timeInput} WIB*`);
    }

    // 2. SET WAKTU TUTUP
    if (command === 'settutup') {
      const timeInput = (text || args[0] || '').trim();
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

      if (!timeRegex.test(timeInput)) {
        return m.reply(
          `*Format jam tidak valid!*\n` +
          `Gunakan format 24 jam (HH:mm).\n` +
          `Contoh: *${prefix}settutup 22:00*`
        );
      }

      chat.autogroup.closeTime = timeInput;
      chat.autogroup.lastAction = '';
      db.saveSync();

      return m.reply(`✅ *Jadwal Tutup Grup Berhasil Diatur:*\n• Jam Tutup: *${timeInput} WIB*`);
    }

    // 3. CEK STATUS & JADWAL
    if (command === 'cekautogroup') {
      return m.reply(
        `┌── [ JADWAL BUKA/TUTUP GRUP ]\n│\n` +
        `├ Status  : *${chat.autogroup.active ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'}*\n` +
        `├ Buka    : *${chat.autogroup.openTime} WIB*\n` +
        `├ Tutup   : *${chat.autogroup.closeTime} WIB*\n` +
        `├ Terakhir: *${chat.autogroup.lastAction || 'Belum ada'}*\n│\n` +
        `└── [ Otomatis buka tutup oleh Bot ]`
      );
    }

    // 4. ON / OFF AUTOGROUP
    const arg = (args[0] || '').toLowerCase();

    if (arg === 'on' || arg === '1' || arg === 'aktif' || arg === 'enable') {
      chat.autogroup.active = true;
      chat.autogroup.lastAction = '';
      db.saveSync();
      return m.reply(
        `✅ *Fitur Auto Buka/Tutup Grup Berhasil Diaktifkan!*\n\n` +
        `• Jam Buka : *${chat.autogroup.openTime} WIB*\n` +
        `• Jam Tutup: *${chat.autogroup.closeTime} WIB*\n\n` +
        `_Pastikan bot sudah menjadi Admin grup agar dapat mengubah setelan obrolan._`
      );
    }

    if (arg === 'off' || arg === '0' || arg === 'mati' || arg === 'disable') {
      chat.autogroup.active = false;
      db.saveSync();
      return m.reply('❌ Fitur *Auto Buka/Tutup Grup* berhasil dinonaktifkan.');
    }

    return m.reply(
      `*Panduan Auto Buka/Tutup Grup:*\n` +
      `• Status saat ini: *${chat.autogroup.active ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'}*\n` +
      `• Jam Buka  : *${chat.autogroup.openTime} WIB*\n` +
      `• Jam Tutup : *${chat.autogroup.closeTime} WIB*\n\n` +
      `*Perintah:*\n` +
      `• *${prefix}autogroup on / off*\n` +
      `• *${prefix}setbuka 07:00*\n` +
      `• *${prefix}settutup 22:00*\n` +
      `• *${prefix}cekautogroup*`
    );
  }
};
