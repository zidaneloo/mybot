export default {
  name: 'addsewa',
  command: ['addsewa', 'tambahsewa', 'sewaadd'],
  category: 'owner',
  description: 'Menambah atau memperpanjang masa sewa grup (Khusus Owner)',
  owner: true,

  async execute({ vynaa, m, args, text, db, prefix, groupMetadata, isGroup }) {
    let targetChat = m.chat;
    let days = 0;
    let groupName = groupMetadata?.subject || '';

    // Format 1: .addsewa 30 (di dalam grup)
    if (args.length === 1 && !isNaN(args[0])) {
      if (!isGroup) {
        return m.reply(`Jika di private chat, gunakan format:\n${prefix}addsewa <link_grup/id_grup> <jumlah_hari>\n\nContoh:\n${prefix}addsewa https://chat.whatsapp.com/xxx 30`);
      }
      days = parseInt(args[0]);
    }
    // Format 2: .addsewa <link/id> 30
    else if (args.length >= 2) {
      const linkOrId = args[0];
      days = parseInt(args[1]);

      const linkRegex = /chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i;
      const match = linkOrId.match(linkRegex);

      if (match && match[1]) {
        try {
          const inviteInfo = await vynaa.groupGetInviteInfo(match[1]);
          targetChat = inviteInfo.id;
          groupName = inviteInfo.subject || 'Grup WhatsApp';
          // Pastikan bot join ke grup tersebut
          await vynaa.groupAcceptInvite(match[1]).catch(() => {});
        } catch (err) {
          return m.reply(`Gagal memeriksa link grup: ${err.message}`);
        }
      } else if (linkOrId.endsWith('@g.us')) {
        targetChat = linkOrId;
      } else {
        return m.reply(`Format target tidak dikenali bro. Masukkan link grup atau jalankan langsung di dalam grup.`);
      }
    } else {
      return m.reply(`Cara Penggunaan Tambah Sewa:
- Di dalam grup: ${prefix}addsewa <hari> (Contoh: ${prefix}addsewa 30)
- Dari PC/Owner: ${prefix}addsewa <link_grup> <hari> (Contoh: ${prefix}addsewa https://chat.whatsapp.com/xxx 30)`);
    }

    if (days <= 0 || isNaN(days)) {
      return m.reply('Jumlah hari sewa harus berupa angka lebih dari 0.');
    }

    const sewa = db.addSewa(targetChat, days, groupName);
    const info = db.getSewaInfo(targetChat);

    const responseText = `┌── [ 🧾 TANDA BUKTI SEWA RESMI AKTIF ]
│
├ Status        : ✅ RESMI DIAKTIFKAN
├ Grup          : ${groupName || targetChat}
├ Durasi Sewa   : +${days} Hari
├ Sisa Waktu    : ${info.remaining}
├ Jatuh Tempo   : ${info.expiredDate}
│
├── [ 📌 INFORMASI & PANDUAN ]
│ ├ Cek Masa Sewa : ${prefix}ceksewa
│ ├ Menu Fitur    : ${prefix}menu
│ ├ Notifikasi    : Pengingat otomatis H-1 sebelum sewa berakhir
│ ├ Perpanjangan  : Hubungi Owner sebelum jatuh tempo
│
└── [ Terimakasih telah berlangganan layanan ${config.botName} ]`;

    // Kirim notifikasi invoice ke pemanggil
    await m.reply(responseText);

    // Jika dipanggil dari PC / private chat untuk grup lain, kirim tanda bukti juga ke grup tersebut
    if (targetChat !== m.chat) {
      await vynaa.sendMessage(targetChat, {
        text: responseText
      }).catch(() => {});
    }
  }
};
