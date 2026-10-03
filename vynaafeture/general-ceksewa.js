export default {
  name: 'ceksewa',
  command: ['ceksewa', 'sewa', 'infosewa'],
  category: 'general',
  description: 'Melihat status dan sisa durasi sewa bot di grup ini',
  group: true,

  async execute({ m, db, groupMetadata }) {
    const info = db.getSewaInfo(m.chat);
    const groupName = groupMetadata?.subject || 'Grup Ini';

    if (!info.active || info.isExpired) {
      return m.reply(`┌── [ STATUS SEWA GRUP ]
│
├ Grup        : ${groupName}
├ Status Sewa : Tidak aktif / Permanen
│
└── [ Hubungi Owner untuk menyewa atau memperpanjang bot ]`);
    }

    const text = `┌── [ STATUS SEWA GRUP ]
│
├ Grup          : ${groupName}
├ Status        : Aktif
├ Sisa Durasi   : ${info.remaining}
├ Berakhir Pada : ${info.expiredDate}
│
└── [ Bot akan otomatis mengingatkan saat masa sewa hampir habis ]`;

    return m.reply(text);
  }
};
