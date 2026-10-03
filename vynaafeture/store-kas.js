import db from '../lib/database.js';

/**
 * Format angka ke mata uang Rupiah
 */
function formatRupiah(number) {
  return 'Rp ' + Number(number || 0).toLocaleString('id-ID');
}

/**
 * Evaluasi ekspresi matematika sederhana secara aman tanpa risiko injeksi kode
 */
function safeCalculate(expression) {
  const sanitized = String(expression).replace(/x/gi, '*').replace(/÷/g, '/').trim();
  // Hanya izinkan angka, operator dasar, titik, kurung, dan spasi
  if (!/^[\d\s+\-*/%().]+$/.test(sanitized)) {
    throw new Error('Hanya karakter angka dan operator (+, -, *, /, %) yang diizinkan.');
  }
  const result = Function(`'use strict'; return (${sanitized})`)();
  if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
    throw new Error('Hasil perhitungan tidak valid atau tidak terhingga.');
  }
  return result;
}

export default {
  name: 'kas',
  command: ['tambahkas', 'tarikkas', 'cekkas', 'listkas', 'resetkas', 'kalkulator', 'calc'],
  menu: ['tambahkas [nominal|ket]', 'tarikkas [nominal|ket]', 'cekkas', 'kalkulator [rumus]'],
  category: 'store',
  description: 'Pencatatan kas pemasukan/pengeluaran toko grup dan kalkulator hitung cepat',
  group: true,

  async execute({ vynaa, m, text, args, command, prefix, chat, isAdmin, isOwner }) {
    // ==========================================
    // 1. KALKULATOR CEPAT (KALKULATOR / CALC)
    // ==========================================
    if (command === 'kalkulator' || command === 'calc') {
      const expr = text || m.quoted?.text || '';
      if (!expr) {
        return m.reply(
          `*Panduan Kalkulator:*\n\n` +
          `Ketik: *${prefix}calc <operasi matematika>*\n` +
          `Contoh: *${prefix}calc 15000 * 5 - 2000*`
        );
      }

      try {
        const result = safeCalculate(expr);
        return m.reply(
          `┌── [ KALKULATOR ]\n│\n` +
          `├ Soal  : ${expr}\n` +
          `├ Hasil : *${Number(result).toLocaleString('id-ID')}*\n│\n` +
          `└── [ Selesai ]`
        );
      } catch (err) {
        return m.reply(`⚠️ Perhitungan gagal: ${err.message}`);
      }
    }

    if (!chat) return m.reply('Data grup tidak ditemukan.');

    if (!chat.kas) {
      chat.kas = {
        saldo: 0,
        history: []
      };
    }
    if (!Array.isArray(chat.kas.history)) {
      chat.kas.history = [];
    }

    // ==========================================
    // 2. CEK SALDO KAS (CEKKAS / LISTKAS)
    // ==========================================
    if (command === 'cekkas' || command === 'listkas') {
      let res = `┌── [ BUKU KAS TOKO ]\n│\n`;
      res += `├ Saldo Saat Ini : *${formatRupiah(chat.kas.saldo)}*\n`;
      res += `├ Total Catatan  : ${chat.kas.history.length} Transaksi\n│\n`;
      res += `├── [ 5 RIWAYAT TERAKHIR ]\n`;

      if (chat.kas.history.length === 0) {
        res += `│ _Belum ada riwayat pemasukan / pengeluaran kas._\n`;
      } else {
        const recent = chat.kas.history.slice(-5).reverse();
        for (const h of recent) {
          const sign = h.type === 'in' ? '🟢 (+)' : '🔴 (-)';
          const time = new Date(h.time).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
          res += `│ ├ ${sign} ${formatRupiah(h.nominal)} [${time}]\n`;
          res += `│ │ Catatan: ${h.note}\n`;
        }
      }

      res += `│\n└── [ Kas Toko Transparan ]`;
      return m.reply(res);
    }

    // ==========================================
    // PERINTAH ADMIN / OWNER DI BAWAH INI
    // ==========================================
    if (!isAdmin && !isOwner) {
      return m.reply('Perintah kelola kas hanya dapat digunakan oleh Admin atau Owner.');
    }

    // ==========================================
    // 3. TAMBAH KAS MASUK (TAMBAHKAS)
    // ==========================================
    if (command === 'tambahkas') {
      if (!text) {
        return m.reply(
          `*Cara Tambah Kas Masuk:*\n\n` +
          `Ketik: *${prefix}tambahkas <nominal> | <keterangan>*\n` +
          `Contoh: *${prefix}tambahkas 50000 | Order Diamond FF Vynaa*`
        );
      }

      let nominal = 0;
      let note = 'Pemasukan Kas';

      if (text.includes('|')) {
        const parts = text.split('|');
        nominal = parseInt(parts[0].replace(/\D/g, ''), 10);
        note = parts.slice(1).join('|').trim() || note;
      } else {
        nominal = parseInt(text.replace(/\D/g, ''), 10);
      }

      if (!nominal || isNaN(nominal) || nominal <= 0) {
        return m.reply('Nominal pemasukan harus berupa angka yang valid dan lebih dari 0.');
      }

      chat.kas.saldo = (chat.kas.saldo || 0) + nominal;
      chat.kas.history.push({
        type: 'in',
        nominal,
        note,
        time: Date.now(),
        user: m.senderNumber
      });
      db.saveSync();

      return m.reply(
        `✅ *Pemasukan Kas Berhasil Dicatat!*\n\n` +
        `• Jumlah      : *+${formatRupiah(nominal)}*\n` +
        `• Keterangan  : ${note}\n` +
        `• Saldo Akhir : *${formatRupiah(chat.kas.saldo)}*`
      );
    }

    // ==========================================
    // 4. TARIK KAS KELUAR (TARIKKAS)
    // ==========================================
    if (command === 'tarikkas') {
      if (!text) {
        return m.reply(
          `*Cara Catat Kas Keluar:*\n\n` +
          `Ketik: *${prefix}tarikkas <nominal> | <keterangan>*\n` +
          `Contoh: *${prefix}tarikkas 20000 | Beli Pulsa Operasional*`
        );
      }

      let nominal = 0;
      let note = 'Pengeluaran Kas';

      if (text.includes('|')) {
        const parts = text.split('|');
        nominal = parseInt(parts[0].replace(/\D/g, ''), 10);
        note = parts.slice(1).join('|').trim() || note;
      } else {
        nominal = parseInt(text.replace(/\D/g, ''), 10);
      }

      if (!nominal || isNaN(nominal) || nominal <= 0) {
        return m.reply('Nominal pengeluaran harus berupa angka yang valid dan lebih dari 0.');
      }

      if (nominal > chat.kas.saldo) {
        return m.reply(`Saldo kas tidak mencukupi! Saldo saat ini hanya *${formatRupiah(chat.kas.saldo)}*.`);
      }

      chat.kas.saldo = (chat.kas.saldo || 0) - nominal;
      chat.kas.history.push({
        type: 'out',
        nominal,
        note,
        time: Date.now(),
        user: m.senderNumber
      });
      db.saveSync();

      return m.reply(
        `🔴 *Pengeluaran Kas Berhasil Dicatat!*\n\n` +
        `• Jumlah      : *-${formatRupiah(nominal)}*\n` +
        `• Keterangan  : ${note}\n` +
        `• Saldo Akhir : *${formatRupiah(chat.kas.saldo)}*`
      );
    }

    // ==========================================
    // 5. RESET KAS (RESETKAS)
    // ==========================================
    if (command === 'resetkas') {
      chat.kas = {
        saldo: 0,
        history: []
      };
      db.saveSync();
      return m.reply('✅ Seluruh buku kas dan saldo grup ini berhasil di-reset ke 0.');
    }
  }
};
