import config from '../config.js';

export default {
  name: 'creator',
  command: ['creator', 'owner', 'developer', 'ownerbot', 'infoowner'],
  menu: ['owner'],
  category: 'general',
  description: 'Menampilkan kartu kontak WhatsApp resmi Owner Bot',
  group: true,

  async execute({ vynaa, m }) {
    const owners = config.owner || ['6282389924037', '6283872659753'];

    // 1. Buat vCard kartu kontak WhatsApp untuk setiap owner
    const contacts = owners.map((num) => {
      const cleanNum = num.replace(/\D/g, '');
      const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:Owner ${config.botName}\nORG:${config.botName};\nTEL;type=CELL;type=VOICE;waid=${cleanNum}:+${cleanNum}\nEND:VCARD`;
      return {
        displayName: `Owner ${config.botName}`,
        vcard
      };
    });

    // 2. Kirim kartu kontak WhatsApp (Native Contact Card)
    await vynaa.sendMessage(m.chat, {
      contacts: {
        displayName: `Owner ${config.botName}`,
        contacts
      }
    }, { quoted: m.raw });

    // 3. Kirim pesan detail informasi kontak yang rapi & ramah
    const ownerMentions = owners.map((n) => `${n.replace(/\D/g, '')}@s.whatsapp.net`);
    let ownerListText = '';
    owners.forEach((num, index) => {
      const clean = num.replace(/\D/g, '');
      ownerListText += `│ ├ Owner ${index + 1} : @${clean} ( https://wa.me/${clean} )\n`;
    });

    const caption = `┌── [ KONTAK OWNER RESMI ]
│
├ Halo @${m.senderNumber}
├ Di atas adalah kartu kontak WhatsApp resmi Owner ${config.botName}.
│
├── [ INFORMASI OWNER & BOT ]
│ ├ Nama Bot   : ${config.botName}
│ ├ Mode       : Khusus Grup
│ ├ Layanan    : Sewa Bot, Tanya Fitur, & Lapor Kendala
${ownerListText}│
└── [ Silakan hubungi langsung secara sopan dan jelas ]`;

    await m.reply(caption, {
      mentions: [m.sender, ...ownerMentions]
    });
  }
};