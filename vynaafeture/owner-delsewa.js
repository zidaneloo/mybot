export default {
  name: 'delsewa',
  command: ['delsewa', 'hapussewa', 'sewadel'],
  menu: ['delsewa [nomor / ID grup]'],
  category: 'owner',
  description: 'Menghapus masa sewa grup berdasarkan nomor urut listsewa atau ID grup (Khusus Owner)',
  owner: true,

  async execute({ vynaa, m, args, db, prefix, isGroup }) {
    const list = db.getAllSewa();
    let targetChat = '';
    let targetName = '';

    // Skenario 1: Hapus berdasarkan nomor urut (contoh: .delsewa 1)
    if (args[0] && !isNaN(args[0])) {
      const num = parseInt(args[0]);
      if (list.length === 0) {
        return m.reply('Saat ini belum ada grup yang terdaftar dalam masa sewa aktif.');
      }
      if (num < 1 || num > list.length) {
        return m.reply(
          `⚠️ *Nomor urut sewa tidak ditemukan!*\n\n` +
          `Masukkan nomor antara 1 sampai ${list.length}.\n` +
          `Ketik *${prefix}listsewa* untuk melihat daftar nomor grup yang disewa.`
        );
      }
      const targetItem = list[num - 1];
      targetChat = targetItem.chatId;
      targetName = targetItem.name;
    }
    // Skenario 2: Hapus berdasarkan input ID grup / JID manual (contoh: .delsewa 120363xxx@g.us)
    else if (args[0]) {
      targetChat = args[0].trim();
      const existing = list.find((g) => g.chatId === targetChat);
      targetName = existing?.name || db.getChat(targetChat)?.name || 'Grup WhatsApp';
    }
    // Skenario 3: Dijalankan langsung di dalam grup yang ingin dihapus sewanya
    else if (isGroup) {
      targetChat = m.chat;
      targetName = db.getChat(targetChat)?.name || 'Grup Ini';
    }
    // Tidak ada argumen dan tidak dijalankan di grup
    else {
      let guide = `*Panduan Hapus Sewa:*\n\n` +
        `1. *Hapus berdasarkan nomor urut dari listsewa:*\n` +
        `   *${prefix}delsewa 1*\n\n` +
        `2. *Hapus berdasarkan ID grup:*\n` +
        `   *${prefix}delsewa 12036304xxxx@g.us*\n\n` +
        `3. *Hapus langsung di dalam grup:*\n` +
        `   Ketik *${prefix}delsewa* di dalam grup\n\n`;

      if (list.length > 0) {
        guide += `*Daftar Sewa Aktif Saat Ini:*\n`;
        list.slice(0, 5).forEach((item, idx) => {
          guide += `• [${idx + 1}] ${item.name} (${item.remaining})\n`;
        });
        if (list.length > 5) guide += `_...dan ${list.length - 5} grup lainnya. Ketik ${prefix}listsewa untuk melihat semua._`;
      } else {
        guide += `_Saat ini belum ada grup sewa aktif._`;
      }

      return m.reply(guide);
    }

    db.removeSewa(targetChat);

    return m.reply(
      `✅ *Berhasil Menghapus Sewa!*\n\n` +
      `• *Nama Grup* : ${targetName}\n` +
      `• *ID Grup*   : ${targetChat}\n\n` +
      `_Status sewa untuk grup tersebut telah resmi dinonaktifkan._`
    );
  }
};
