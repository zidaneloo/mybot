export default {
  name: 'profile',
  command: ['profile', 'me', 'profil'],
  category: 'general',
  description: 'Melihat informasi akun dan peran kamu di grup ini',
  group: true,

  async execute({ m, isAdmin, isOwner }) {
    let role = 'Member Biasa';
    if (isOwner) {
      role = 'Owner Bot & Admin';
    } else if (isAdmin) {
      role = 'Admin Grup';
    }

    const text = `PROFIL PENGGUNA
----------------------------------------
- Nomor Telepon : @${m.senderNumber}
- Status Peran  : ${role}
- Lokasi Obrolan: Grup
----------------------------------------`;

    return m.reply(text, {
      mentions: [m.sender]
    });
  }
};
