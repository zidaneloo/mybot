/*
        ••JANGAN HAPUS INI••
SCRIPT BY © VYNAA VALERIE 
•• recode kasih credits 
•• contacts: (6282389924037) 
•• (github.com/VynaaValerie) 

•• Join https://whatsapp.com/channel/0029VbCaDhn11ulT1qwodB2x  

• Menerima pemberitahuan web
• Menerima pemberitahuan aplikasi 
• Menerima pembuatan script bot
• Menerima perbaikan script atau fitur bot
• Menerima pembuatan fitur bot
• Menerima semua kebutuhan bot
• Menerima Jadi Bot

ℹ️ Information

• Pembayaran bisa dicicil
• Bisa bayar di awal atau akhir
• Pembayaran melalu QRIS Only
• Testimoni Banyak

Aturan:
1. Dilarang memperjualbelikan script ini.
2. Hak cipta milik Vynaa Valerie.

“Dan janganlah kamu makan harta di antara kamu dengan jalan yang batil, dan janganlah kamu membunuh dirimu sendiri. Sesungguhnya Allah adalah Maha Penyayang kepadamu.” (QS. Al-Baqarah: 188)
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../database.json');

class Database {
  constructor() {
    this.data = {
      chats: {},
      users: {},
      settings: {
        self: false,
        prefix: '.',
        autoread: false
      }
    };
    this.saveTimeout = null;
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(dbPath)) {
        const fileContent = fs.readFileSync(dbPath, 'utf-8');
        if (fileContent.trim()) {
          this.data = JSON.parse(fileContent);
          if (!this.data.settings) this.data.settings = {};
          if (this.data.settings.autoread === undefined) {
            this.data.settings.autoread = false;
          }
        }
      } else {
        this.saveSync();
      }
    } catch (err) {
      console.error('[DB Error] Gagal memuat database.json:', err.message);
    }
  }

  /**
   * Simpan database secara aman (debounced untuk performa tinggi & anti-korup)
   */
  save() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveSync();
    }, 500);
  }

  saveSync() {
    try {
      const tempPath = `${dbPath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, dbPath);
    } catch (err) {
      console.error('[DB Error] Gagal menyimpan database:', err.message);
    }
  }

  getChat(jid) {
    if (!this.data.chats) this.data.chats = {};
    if (!this.data.chats[jid]) {
      this.data.chats[jid] = {
        name: '',
        antilink: false,
        antilink2: false,
        antilinkKick: false,
        mute: false,
        welcome: false,
        sewa: {
          active: false,
          expired: 0,
          addedAt: 0,
          days: 0
        }
      };
      this.save();
    }
    // Pastikan field antilink2 selalu ada
    if (this.data.chats[jid].antilink2 === undefined) {
      this.data.chats[jid].antilink2 = Boolean(this.data.chats[jid].antilinkKick);
    }
    // Pastikan field sewa selalu ada
    if (!this.data.chats[jid].sewa) {
      this.data.chats[jid].sewa = {
        active: false,
        expired: 0,
        addedAt: 0,
        days: 0
      };
    }
    // Pastikan field store selalu ada (tiap grup db terpisah)
    if (!this.data.chats[jid].store) {
      this.data.chats[jid].store = {};
    }
    // Pastikan field welcome & bye selalu ada
    if (this.data.chats[jid].welcome === undefined) {
      this.data.chats[jid].welcome = false;
    }
    if (this.data.chats[jid].bye === undefined) {
      this.data.chats[jid].bye = false;
    }
    if (this.data.chats[jid].welcomeText === undefined) {
      this.data.chats[jid].welcomeText = '';
    }
    if (this.data.chats[jid].byeText === undefined) {
      this.data.chats[jid].byeText = '';
    }
    // Pastikan field testi selalu ada per grup
    if (!Array.isArray(this.data.chats[jid].testi)) {
      this.data.chats[jid].testi = [];
    }
    // Pastikan field templates selalu ada per grup
    if (!this.data.chats[jid].templates) {
      this.data.chats[jid].templates = {};
    }
    return this.data.chats[jid];
  }

  // ==========================================
  // MANAJEMEN OWNER BOT
  // ==========================================
  getOwners() {
    if (!this.data.settings) this.data.settings = {};
    if (!Array.isArray(this.data.settings.owners)) {
      this.data.settings.owners = [];
    }
    return this.data.settings.owners;
  }

  addOwner(number) {
    const num = String(number).replace(/\D/g, '');
    if (!num) return false;
    const owners = this.getOwners();
    if (!owners.includes(num)) {
      owners.push(num);
      this.saveSync();
      return true;
    }
    return false;
  }

  removeOwner(number) {
    const num = String(number).replace(/\D/g, '');
    if (!num) return false;
    const owners = this.getOwners();
    const index = owners.indexOf(num);
    if (index !== -1) {
      owners.splice(index, 1);
      this.saveSync();
      return true;
    }
    return false;
  }

  // ==========================================
  // MANAJEMEN PENGATURAN AUTO READ
  // ==========================================
  isAutoRead() {
    return Boolean(this.data?.settings?.autoread);
  }

  setAutoRead(state) {
    if (!this.data.settings) this.data.settings = {};
    this.data.settings.autoread = Boolean(state);
    this.saveSync();
    return this.data.settings.autoread;
  }

  // ==========================================
  // MANAJEMEN TEMPLATE TRANSAKSI (PROSES & DONE)
  // ==========================================
  getTemplate(type) {
    if (!this.data.settings) this.data.settings = {};
    if (!this.data.settings.templates) this.data.settings.templates = {};
    return this.data.settings.templates[type] || '';
  }

  setTemplate(type, text) {
    if (!this.data.settings) this.data.settings = {};
    if (!this.data.settings.templates) this.data.settings.templates = {};
    this.data.settings.templates[type] = String(text);
    this.saveSync();
    return true;
  }

  getUser(jid) {
    if (!this.data.users) this.data.users = {};
    if (!this.data.users[jid]) {
      this.data.users[jid] = {
        name: '',
        warn: 0
      };
      this.save();
    }
    return this.data.users[jid];
  }

  // ==========================================
  // MANAJEMEN SEWA GRUP
  // ==========================================

  /**
   * Tambah atau perpanjang masa sewa grup
   */
  addSewa(chatId, days, groupName = '') {
    const chat = this.getChat(chatId);
    if (groupName) chat.name = groupName;

    const msToAdd = days * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Jika sewa saat ini masih aktif, tambahkan dari tanggal expired lama
    const baseTime = (chat.sewa?.active && chat.sewa?.expired > now) ? chat.sewa.expired : now;
    const newExpired = baseTime + msToAdd;

    chat.sewa = {
      active: true,
      expired: newExpired,
      addedAt: now,
      days: days,
      reminderH1: false
    };

    this.saveSync();
    return chat.sewa;
  }

  /**
   * Hapus masa sewa grup
   */
  removeSewa(chatId) {
    const chat = this.getChat(chatId);
    chat.sewa = {
      active: false,
      expired: 0,
      addedAt: 0,
      days: 0
    };
    this.saveSync();
    return true;
  }

  /**
   * Cek informasi sewa grup
   */
  getSewaInfo(chatId) {
    const chat = this.getChat(chatId);
    const sewa = chat.sewa || { active: false, expired: 0 };
    const now = Date.now();

    if (!sewa.active || sewa.expired <= 0) {
      return { active: false, isExpired: true, remaining: 'Tidak disewa', expiredDate: '-' };
    }

    const diff = sewa.expired - now;
    if (diff <= 0) {
      return { active: false, isExpired: true, remaining: 'Sewa telah habis', expiredDate: new Date(sewa.expired).toLocaleDateString('id-ID') };
    }

    const d = Math.floor(diff / (24 * 60 * 60 * 1000));
    const h = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const m = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

    const dateStr = new Date(sewa.expired).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return {
      active: true,
      isExpired: false,
      days: d,
      hours: h,
      minutes: m,
      remaining: `${d > 0 ? d + ' hari ' : ''}${h} jam ${m} menit`,
      expiredDate: dateStr,
      expiredTimestamp: sewa.expired
    };
  }

  /**
   * Ambil daftar seluruh grup yang sedang disewa
   */
  getAllSewa() {
    const list = [];
    const now = Date.now();

    for (const [chatId, chat] of Object.entries(this.data.chats || {})) {
      if (chat.sewa?.active && chat.sewa?.expired > 0) {
        const info = this.getSewaInfo(chatId);
        list.push({
          chatId,
          name: chat.name || 'Grup WhatsApp',
          ...info
        });
      }
    }

    // Urutkan dari yang paling cepat habis
    return list.sort((a, b) => (a.expiredTimestamp || 0) - (b.expiredTimestamp || 0));
  }
}

export const db = new Database();
global.db = db;
export default db;
