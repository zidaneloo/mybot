export default {
  name: 'listsewa',
  command: ['listsewa', 'sewalist', 'sewas'],
  category: 'owner',
  description: 'Melihat seluruh daftar grup yang sedang menyewa bot (Khusus Owner)',
  owner: true,

  async execute({ m, db }) {
    const list = db.getAllSewa();

    if (list.length === 0) {
      return m.reply('Saat ini belum ada grup yang terdaftar dalam masa sewa aktif.');
    }

    let text = `┌── [ DAFTAR SEWA AKTIF ]
│
├ Total Grup Disewa: ${list.length} Grup
│
├── [ DAFTAR GRUP ]\n`;

    let count = 1;
    for (const item of list) {
      text += `│ ├ ${count++}. ${item.name}\n`;
      text += `│ │  ID       : ${item.chatId}\n`;
      text += `│ │  Sisa     : ${item.remaining}\n`;
      text += `│ │  Expired  : ${item.expiredDate}\n`;
      text += `│ │\n`;
    }

    text += `└── [ Total: ${list.length} Grup | Ketik .delsewa <nomor> untuk hapus ]`;

    return m.reply(text);
  }
};
