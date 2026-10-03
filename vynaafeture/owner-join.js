export default {
  name: 'join',
  command: ['join', 'gabung'],
  category: 'owner',
  description: 'Memerintahkan bot masuk ke grup WhatsApp via link undangan (Khusus Owner)',
  owner: true,

  async execute({ vynaa, m, text, prefix }) {
    if (!text) {
      return m.reply(`Masukkan link grup WhatsApp bro.\nContoh: ${prefix}join https://chat.whatsapp.com/GQoTL3aoeCh4RIFqcq48Xk`);
    }

    const linkRegex = /chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i;
    const match = text.match(linkRegex);

    if (!match || !match[1]) {
      return m.reply('Format link grup tidak valid. Pastikan formatnya: https://chat.whatsapp.com/xxx');
    }

    const inviteCode = match[1];

    try {
      await m.reply('Sedang memeriksa link undangan grup...');

      // Cek info grup terlebih dahulu
      let groupInfo = null;
      try {
        groupInfo = await vynaa.groupGetInviteInfo(inviteCode);
      } catch (e) {}

      const groupName = groupInfo?.subject || 'Grup WhatsApp';
      const size = groupInfo?.size || '?';

      // Masuk ke grup
      const res = await vynaa.groupAcceptInvite(inviteCode);

      const responseText = `┌── [ SUKSES BERGABUNG ]
│
├ Nama Grup   : ${groupName}
├ Total Member: ${size} Orang
├ ID Grup     : ${res || inviteCode}
│
└── [ Bot berhasil masuk dan siap aktif di grup tersebut ]`;

      return m.reply(responseText);
    } catch (err) {
      return m.reply(`Gagal bergabung ke grup:\n${err.message}`);
    }
  }
};
