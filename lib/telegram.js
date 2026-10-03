import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import config from '../config.js';
import db from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.resolve(__dirname, '..');

class TelegramController {
  constructor() {
    this.token = config.telegram?.token || '';
    this.ownerId = String(config.telegram?.ownerId || '8800459833');
    this.allowedUsers = new Set([this.ownerId, ...(config.telegram?.allowedUsers || []).map(String)]);
    this.apiUrl = `https://api.telegram.org/bot${this.token}`;
    this.isPolling = false;
    this.lastUpdateId = 0;
    this.abortController = null;
    this.userStates = new Map(); // userId -> state object
    
    // Callbacks provided by index.js
    this.handlers = {
      getSocket: () => null,
      requestPairingCode: async () => null,
      resetSession: async () => null,
      restartBot: async () => null,
      getStatus: () => ({}),
      triggerQR: async () => null
    };

    this.latestQR = null;
    this.qrTimestamp = 0;
    this.qrRequestedChatId = null;
  }

  isAuthorized(userId) {
    const uid = String(userId);
    const ownerId = String(config.telegram?.ownerId || '8800459833');
    const allowed = (config.telegram?.allowedUsers || []).map(String);
    return uid === ownerId || allowed.includes(uid) || this.allowedUsers.has(uid);
  }

  // Simpan QR terbaru di memory tanpa spamming pesan foto ke Telegram
  setLatestQR(qrString) {
    this.latestQR = qrString;
    this.qrTimestamp = Date.now();

    // Hanya kirim gambar jika ada permintaan aktif dari user (misal klik Scan QR)
    if (this.qrRequestedChatId) {
      const targetChat = this.qrRequestedChatId;
      this.qrRequestedChatId = null;
      this.sendQRCodePhoto(targetChat, qrString).catch(() => {});
    }
  }

  clearQR() {
    this.latestQR = null;
    this.qrTimestamp = 0;
    this.qrRequestedChatId = null;
  }

  // ==========================================
  // TELEGRAM API CLIENT (Native Fetch)
  // ==========================================
  async request(method, data = {}) {
    if (!this.token) return null;
    try {
      const res = await fetch(`${this.apiUrl}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async sendMessage(chatId, text, options = {}) {
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: options.parse_mode ?? 'Markdown',
      disable_web_page_preview: true,
      ...options
    };
    return await this.request('sendMessage', payload);
  }

  async deleteMessage(chatId, messageId) {
    return await this.request('deleteMessage', {
      chat_id: chatId,
      message_id: messageId
    });
  }

  async sendPhoto(chatId, imageBuffer, caption = '', options = {}) {
    if (!this.token) return null;
    try {
      const formData = new FormData();
      formData.append('chat_id', String(chatId));
      formData.append('caption', caption);
      if (options.parse_mode) formData.append('parse_mode', options.parse_mode);
      if (options.reply_markup) formData.append('reply_markup', JSON.stringify(options.reply_markup));
      
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      formData.append('photo', blob, 'qrcode.png');

      const res = await fetch(`${this.apiUrl}/sendPhoto`, {
        method: 'POST',
        body: formData
      });
      return await res.json();
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async sendDocument(chatId, fileBuffer, fileName, caption = '', options = {}) {
    if (!this.token) return null;
    try {
      const formData = new FormData();
      formData.append('chat_id', String(chatId));
      formData.append('caption', caption);
      if (options.parse_mode) formData.append('parse_mode', options.parse_mode);

      const blob = new Blob([fileBuffer]);
      formData.append('document', blob, fileName);

      const res = await fetch(`${this.apiUrl}/sendDocument`, {
        method: 'POST',
        body: formData
      });
      return await res.json();
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
    return await this.request('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert
    });
  }

  async editMessageText(chatId, messageId, text, options = {}) {
    return await this.request('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: options.parse_mode ?? 'Markdown',
      disable_web_page_preview: true,
      ...options
    });
  }

  // Helper agar tombol inline tidak pernah macet/gagal jika pesan sebelumnya bertipe media/foto
  async safeSendOrEdit(chatId, messageId, text, options = {}) {
    if (messageId) {
      const res = await this.editMessageText(chatId, messageId, text, options);
      if (res && res.ok) return res;
      // Jika edit gagal (misal pesan sebelumnya adalah foto atau media), hapus pesan lama dan kirim baru
      await this.deleteMessage(chatId, messageId).catch(() => {});
    }
    return await this.sendMessage(chatId, text, options);
  }

  // ==========================================
  // NOTIFIKASI EVENT WHATSAPP KE TELEGRAM OWNER
  // ==========================================
  async notifyConnected(info = {}) {
    this.clearQR();
    const phone = info.user?.id ? info.user.id.split(':')[0] : 'Aktif';
    const text = `🟢 *WHATSAPP TERHUBUNG & ONLINE!*\n\n` +
      `• *Bot:* ${config.botName}\n` +
      `• *Nomor:* +${phone}\n` +
      `• *Status:* Gateway Siap Menerima Pesan\n` +
      `• *Waktu:* ${this.getJakartaTime()}\n\n` +
      `Bot WhatsApp sekarang sudah siap digunakan sepenuhnya. Gunakan /menu untuk membuka panel kontrol.`;
    await this.sendMessage(this.ownerId, text);
  }

  async notifyDisconnected(reason = '', willReconnect = true) {
    const text = `🔴 *KONEKSI WHATSAPP TERPUTUS*\n\n` +
      `• *Alasan:* \`${reason || 'Koneksi ditutup oleh server'}\`\n` +
      `• *Menyambung Ulang:* ${willReconnect ? 'Ya, otomatis dalam 3 detik...' : 'Tidak (Sesi Expired/Keluar)'}\n` +
      `• *Waktu:* ${this.getJakartaTime()}\n\n` +
      (!willReconnect
        ? `⚠️ *Perhatian:* Sesi Anda telah logout. Klik tombol di bawah atau ketik /delsesi lalu /getsesi untuk pairing ulang.`
        : `Bot akan mencoba menyambung kembali secara otomatis.`);

    const replyMarkup = !willReconnect ? {
      inline_keyboard: [
        [{ text: '🗑️ Hapus Sesi Lama', callback_data: 'act_delsesi' }],
        [{ text: '🔑 Ambil Sesi Baru', callback_data: 'act_getsesi' }]
      ]
    } : undefined;

    await this.sendMessage(this.ownerId, text, { reply_markup: replyMarkup });
  }

  // Kirim QR code hanya saat dipanggil secara eksplisit oleh user
  async sendQRCodePhoto(chatId, qrString) {
    try {
      const buffer = await QRCode.toBuffer(qrString, {
        type: 'png',
        margin: 2,
        scale: 8,
        color: { dark: '#000000', light: '#ffffff' }
      });

      const caption = `📷 *SCAN QR CODE WHATSAPP*\n\n` +
        `1. Buka aplikasi WhatsApp di HP Anda\n` +
        `2. Masuk ke *Perangkat Tertaut* ➔ *Tautkan Perangkat*\n` +
        `3. Scan barcode di atas sekarang!\n\n` +
        `_Barcode berlaku sekitar 30-60 detik._`;

      const replyMarkup = {
        inline_keyboard: [
          [{ text: '🔢 Ganti ke Pairing Code', callback_data: 'act_pairing' }],
          [{ text: '🔄 Refresh QR', callback_data: 'act_qr' }],
          [{ text: '🔙 Menu Utama', callback_data: 'menu_main' }]
        ]
      };

      return await this.sendPhoto(chatId, buffer, caption, { reply_markup: replyMarkup });
    } catch (err) {
      console.error('[Telegram QR Error]', err);
      return await this.sendMessage(chatId, `❌ Gagal membuat gambar QR: ${err.message}`);
    }
  }

  // ==========================================
  // HANDLERS COMMAND & INTERAKSI TELEGRAM
  // ==========================================
  async handleCommand(chatId, userId, command, args, rawMessage) {
    if (!this.isAuthorized(userId)) {
      return await this.sendMessage(chatId, '⛔ *Akses Ditolak!*\nBot ini privat dan hanya dapat digunakan oleh Owner yang terdaftar.');
    }

    // Reset input state user jika memulai command baru
    this.userStates.delete(userId);

    switch (command.toLowerCase()) {
      case '/start':
      case '/menu':
      case '/help':
        return await this.sendMainMenu(chatId);

      case '/getsesi':
      case '/pairing':
      case '/session':
        return await this.sendGetSesiMenu(chatId);

      case '/qr':
        return await this.handleRequestQR(chatId);

      case '/status':
      case '/ping':
        return await this.sendStatus(chatId);

      case '/backup':
      case '/backupzip':
      case '/bckp':
      case '/backupdb':
        return await this.sendBackup(chatId);

      case '/autobackup':
        return await this.sendAutoBackupMenu(chatId);

      case '/delsesi':
      case '/clearsesi':
        return await this.sendDelSesiConfirmation(chatId);

      case '/restart':
      case '/reboot':
        return await this.handleRestart(chatId);

      default:
        return await this.sendMessage(chatId, `❓ Perintah *${command}* tidak dikenali.\nKetik /menu untuk melihat daftar perintah yang tersedia.`);
    }
  }

  async handleCallbackQuery(query) {
    const { id: queryId, from, message, data } = query;
    const userId = String(from.id);
    const chatId = message?.chat?.id;
    const messageId = message?.message_id;

    if (!this.isAuthorized(userId)) {
      return await this.answerCallbackQuery(queryId, '⛔ Akses Ditolak! Hanya untuk Owner.', true);
    }

    // Selalu respon callback query langsung agar animasi loading di tombol Telegram berhenti
    await this.answerCallbackQuery(queryId).catch(() => {});

    switch (data) {
      case 'menu_main':
        this.userStates.delete(userId);
        return await this.sendMainMenu(chatId, messageId);

      case 'act_getsesi':
        this.userStates.delete(userId);
        return await this.sendGetSesiMenu(chatId, messageId);

      case 'act_pairing':
        this.userStates.set(userId, { state: 'waiting_pairing_number' });
        const pairingPrompt = `📱 *LOGIN VIA PAIRING CODE (WHATSAPP)*\n\n` +
          `Silakan ketik nomor WhatsApp Anda di chat ini:\n\n` +
          `• Format: \`628xxxxxxxxxx\` atau \`08xxxxxxxxxx\`\n` +
          `• Minimal 10 digit nomor aktif di aplikasi WhatsApp\n` +
          `• Contoh: \`6283872659753\`\n\n` +
          `_Ketik nomor WhatsApp sekarang:_`;
        
        const markup = {
          inline_keyboard: [
            [{ text: '❌ Batal', callback_data: 'menu_main' }]
          ]
        };

        return await this.safeSendOrEdit(chatId, messageId, pairingPrompt, { reply_markup: markup });

      case 'act_qr':
        return await this.handleRequestQR(chatId, messageId);

      case 'act_status':
        return await this.sendStatus(chatId, messageId);

      case 'act_backup':
        return await this.sendBackup(chatId);

      case 'menu_autobackup':
        return await this.sendAutoBackupMenu(chatId, messageId);

      case 'toggle_autobackup':
        if (!db.data.settings) db.data.settings = {};
        if (!db.data.settings.autobackup) {
          db.data.settings.autobackup = { enabled: true, intervalHours: 24, lastBackup: 0 };
        }
        db.data.settings.autobackup.enabled = !db.data.settings.autobackup.enabled;
        db.saveSync();
        return await this.sendAutoBackupMenu(chatId, messageId);

      case 'set_backup_12h':
        if (!db.data.settings) db.data.settings = {};
        if (!db.data.settings.autobackup) db.data.settings.autobackup = { enabled: true, intervalHours: 24, lastBackup: 0 };
        db.data.settings.autobackup.intervalHours = 12;
        db.data.settings.autobackup.enabled = true;
        db.saveSync();
        return await this.sendAutoBackupMenu(chatId, messageId);

      case 'set_backup_24h':
        if (!db.data.settings) db.data.settings = {};
        if (!db.data.settings.autobackup) db.data.settings.autobackup = { enabled: true, intervalHours: 24, lastBackup: 0 };
        db.data.settings.autobackup.intervalHours = 24;
        db.data.settings.autobackup.enabled = true;
        db.saveSync();
        return await this.sendAutoBackupMenu(chatId, messageId);

      case 'act_delsesi':
        return await this.sendDelSesiConfirmation(chatId, messageId);

      case 'confirm_delsesi':
        return await this.executeDeleteSession(chatId, messageId);

      case 'act_restart':
        return await this.handleRestart(chatId, messageId);

      default:
        break;
    }
  }

  async handleTextMessage(chatId, userId, text, message) {
    if (!this.isAuthorized(userId)) return;

    const userState = this.userStates.get(userId);

    // Sedang menunggu input nomor pairing
    if (userState?.state === 'waiting_pairing_number') {
      this.userStates.delete(userId);
      return await this.executePairingCode(chatId, text.trim());
    }

    // Default reply jika ada chat biasa
    await this.sendMessage(chatId, `Halo! Ketik /menu untuk membuka panel kontrol WhatsApp bot atau /getsesi untuk mengambil pairing code.`);
  }

  // ==========================================
  // FITUR: PAIRING CODE
  // ==========================================
  async executePairingCode(chatId, inputNumber) {
    let cleaned = String(inputNumber).replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    }

    if (!cleaned || cleaned.length < 10) {
      this.userStates.set(String(chatId), { state: 'waiting_pairing_number' });
      return await this.sendMessage(
        chatId,
        `⚠️ *Nomor Tidak Valid!*\nNomor \`${inputNumber}\` kurang dari 10 digit atau format salah.\n\nSilakan masukkan nomor WhatsApp yang benar (contoh: \`6283872659753\`) atau klik Batal:`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Batal', callback_data: 'menu_main' }]]
          }
        }
      );
    }

    await this.sendMessage(chatId, `⏳ *Menghubungkan ke server WhatsApp...*\nSedang meminta kode pairing untuk nomor *+${cleaned}*...`);

    try {
      const code = await this.handlers.requestPairingCode(cleaned);

      if (!code) {
        throw new Error('Gagal mendapatkan kode dari WhatsApp. Pastikan sesi belum login dan koneksi stabil.');
      }

      const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;

      const successText = `╔═══════════════════════════════════╗\n` +
        `║       *KODE PAIRING WHATSAPP*       ║\n` +
        `╚═══════════════════════════════════╝\n\n` +
        `📱 *Target:* \`+${cleaned}\`\n` +
        `🔑 *Kode:* \`${formattedCode}\`\n\n` +
        `_(Klik kode di atas untuk langsung menyalin)_\n\n` +
        `📋 *Langkah Menautkan di Ponsel:*\n` +
        `1. Buka aplikasi WhatsApp di HP Anda\n` +
        `2. Buka menu titik tiga (⋮) / Pengaturan ➔ *Perangkat Tertaut*\n` +
        `3. Pilih *Tautkan Perangkat*\n` +
        `4. Klik *Tautkan dengan nomor telepon saja* di layar bawah\n` +
        `5. Masukkan 8 digit kode di atas: *${formattedCode}*\n\n` +
        `⏱️ _Kode berlaku selama 1-2 menit._`;

      const replyMarkup = {
        inline_keyboard: [
          [{ text: '🔄 Minta Kode Lagi', callback_data: 'act_pairing' }],
          [{ text: '📊 Cek Status Bot', callback_data: 'act_status' }],
          [{ text: '🔙 Menu Utama', callback_data: 'menu_main' }]
        ]
      };

      await this.sendMessage(chatId, successText, { reply_markup: replyMarkup });
    } catch (err) {
      await this.sendMessage(
        chatId,
        `❌ *Gagal Mengambil Kode Pairing*\n\n*Penyebab:* \`${err.message || String(err)}\`\n\n` +
        `💡 *Saran:* Pastikan nomor *+${cleaned}* benar dan aktif di WhatsApp. Jika ada sesi lama yang macet, silakan klik tombol *Hapus Sesi* di bawah lalu coba kembali.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Coba Lagi', callback_data: 'act_pairing' }],
              [{ text: '🗑️ Hapus Sesi Lama', callback_data: 'act_delsesi' }],
              [{ text: '🔙 Menu Utama', callback_data: 'menu_main' }]
            ]
          }
        }
      );
    }
  }

  // ==========================================
  // FITUR: QR CODE
  // ==========================================
  async handleRequestQR(chatId, messageId = null) {
    const sock = this.handlers.getSocket?.();
    if (sock?.user?.id) {
      return await this.safeSendOrEdit(chatId, messageId, `✅ *WhatsApp sudah terhubung!* (+${sock.user.id.split(':')[0]})\nTidak perlu scan QR.`);
    }

    if (this.latestQR && Date.now() - this.qrTimestamp < 50000) {
      if (messageId) {
        await this.deleteMessage(chatId, messageId).catch(() => {});
      }
      return await this.sendQRCodePhoto(chatId, this.latestQR);
    }

    this.qrRequestedChatId = chatId;
    if (messageId) {
      await this.deleteMessage(chatId, messageId).catch(() => {});
    }
    await this.sendMessage(chatId, `⏳ *Menyiapkan QR Code...*\nMenunggu generate barcode dari WhatsApp Gateway. Barcode akan segera dikirim saat siap...`);

    if (this.handlers.triggerQR) {
      await this.handlers.triggerQR();
    }
  }

  // ==========================================
  // FITUR: MENU UTAMA & SUBMENU
  // ==========================================
  async sendMainMenu(chatId, messageId = null) {
    const sock = this.handlers.getSocket();
    const isOnline = Boolean(sock?.user?.id);
    const userPhone = sock?.user?.id ? sock.user.id.split(':')[0] : '-';

    const text = `🤖 *PANEL KONTROL ${config.botName.toUpperCase()}*\n` +
      `_Pusat remote management WhatsApp bot VPS via Telegram_\n\n` +
      `• *Status WA:* ${isOnline ? '🟢 Online (+ ' + userPhone + ')' : '🔴 Offline / Butuh Login'}\n` +
      `• *Waktu:* ${this.getJakartaTime()}\n` +
      `• *VPS Host:* \`${os.hostname()}\` (${os.type()} ${os.arch()})\n\n` +
      `Pilih menu di bawah:`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '🔑 Ambil Sesi (/getsesi)', callback_data: 'act_getsesi' },
          { text: '📊 Status VPS (/status)', callback_data: 'act_status' }
        ],
        [
          { text: '📦 Backup ZIP (/backup)', callback_data: 'act_backup' },
          { text: '⚙️ Auto Backup', callback_data: 'menu_autobackup' }
        ],
        [
          { text: '🗑️ Hapus Sesi (/delsesi)', callback_data: 'act_delsesi' },
          { text: '🔄 Restart Bot', callback_data: 'act_restart' }
        ]
      ]
    };

    return await this.safeSendOrEdit(chatId, messageId, text, { reply_markup: replyMarkup });
  }

  async sendGetSesiMenu(chatId, messageId = null) {
    const sock = this.handlers.getSocket?.();
    const isOnline = Boolean(sock?.user?.id);

    if (isOnline) {
      const text = `✅ *WhatsApp Sudah Terhubung!*\n\n` +
        `Bot saat ini sudah login dengan nomor: *+${sock.user.id.split(':')[0]}*.\n\n` +
        `Jika Anda ingin mengganti nomor atau login ulang, silakan hapus sesi terlebih dahulu.`;

      const replyMarkup = {
        inline_keyboard: [
          [{ text: '🗑️ Hapus Sesi & Ganti Akun', callback_data: 'act_delsesi' }],
          [{ text: '🔙 Kembali ke Menu', callback_data: 'menu_main' }]
        ]
      };

      return await this.safeSendOrEdit(chatId, messageId, text, { reply_markup: replyMarkup });
    }

    const text = `🔑 *AMBIL SESI LOGIN WHATSAPP*\n\n` +
      `Silakan pilih salah satu metode koneksi di bawah:\n\n` +
      `1️⃣ *Pairing Code (Paling Direkomendasikan)*\n` +
      `Cukup masukkan nomor WA Anda (628xxx), bot akan memberikan 8 digit kode pairing untuk diinput di WhatsApp HP.\n\n` +
      `2️⃣ *QR Code Barcode*\n` +
      `Bot akan mengirimkan gambar barcode untuk discan langsung lewat kamera WhatsApp.`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '1️⃣ Pairing Code (Nomor HP)', callback_data: 'act_pairing' }
        ],
        [
          { text: '2️⃣ Scan QR Code', callback_data: 'act_qr' }
        ],
        [
          { text: '🔙 Kembali ke Menu', callback_data: 'menu_main' }
        ]
      ]
    };

    return await this.safeSendOrEdit(chatId, messageId, text, { reply_markup: replyMarkup });
  }

  // ==========================================
  // FITUR: STATUS SISTEM & VPS
  // ==========================================
  async sendStatus(chatId, messageId = null) {
    const sock = this.handlers.getSocket();
    const isOnline = Boolean(sock?.user?.id);
    const phone = sock?.user?.id ? sock.user.id.split(':')[0] : 'Tidak ada';

    // Perhitungan RAM
    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
    const usedMem = (totalMem - freeMem).toFixed(2);
    const memPercent = Math.round((usedMem / totalMem) * 100);

    // Node process memory
    const procMem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

    // CPU Cores & Load
    const cpuCores = os.cpus().length;
    const cpuModel = os.cpus()[0]?.model || 'Generic CPU';
    const loadAvg = os.loadavg().map((l) => l.toFixed(2)).join(', ');

    // Uptime
    const vpsUptimeStr = this.formatUptime(os.uptime());
    const botUptimeStr = this.formatUptime(process.uptime());

    // Stats Database
    const chatsCount = Object.keys(db.data?.chats || {}).length;
    const usersCount = Object.keys(db.data?.users || {}).length;
    const pluginsCount = global.plugins ? global.plugins.size : 0;

    const text = `📊 *STATUS SISTEM & BOT WA*\n\n` +
      `🌐 *WhatsApp Status:*\n` +
      `• Koneksi: ${isOnline ? '🟢 *ONLINE*' : '🔴 *OFFLINE*'}\n` +
      `• Nomor Bot: +${phone}\n` +
      `• Total Plugin: ${pluginsCount} fitur\n` +
      `• Total Chat DB: ${chatsCount} grup/chat\n` +
      `• Total User DB: ${usersCount} pengguna\n` +
      `• Bot Uptime: ${botUptimeStr}\n\n` +
      `🖥️ *Spesifikasi VPS:*\n` +
      `• Hostname: \`${os.hostname()}\`\n` +
      `• OS: ${os.type()} ${os.release()} (${os.arch()})\n` +
      `• CPU: ${cpuCores}x ${cpuModel.split(' ')[0]} (Load: ${loadAvg})\n` +
      `• RAM VPS: ${usedMem} GB / ${totalMem} GB (${memPercent}%)\n` +
      `• Node.js Heap: ${procMem} MB (v${process.version})\n` +
      `• VPS Uptime: ${vpsUptimeStr}\n` +
      `• Waktu Sistem: ${this.getJakartaTime()}`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '🔄 Refresh Status', callback_data: 'act_status' },
          { text: '🔙 Menu Utama', callback_data: 'menu_main' }
        ]
      ]
    };

    return await this.safeSendOrEdit(chatId, messageId, text, { reply_markup: replyMarkup });
  }

  // ==========================================
  // FITUR: BACKUP SOURCE CODE & DATABASE (.ZIP)
  // ==========================================
  async sendZipBackup(chatId) {
    await this.sendMessage(chatId, '⏳ Sedang mengompres seluruh *Source Code & Database* ke format *.zip*...');

    try {
      const { createProjectZipBackup } = await import('../vynaafeture/owner-backup.js');
      const { zipPath, fileName, sizeKb, timeStr } = await createProjectZipBackup();
      const buffer = fs.readFileSync(zipPath);

      const caption = `📦 *BACKUP SOURCE CODE & DATABASE (ZIP)*\n\n` +
        `• *Bot:* ${config.botName}\n` +
        `• *File:* \`${fileName}\`\n` +
        `• *Ukuran:* ${sizeKb} KB\n` +
        `• *Format:* ZIP Archive (.zip)\n` +
        `• *Waktu:* ${timeStr}\n\n` +
        `📁 *Isi Arsip:* Seluruh source code bot, plugins, konfigurasi, dan database.json aktif.\n\n` +
        `_Simpan file .zip ini untuk keamanan & restore kapan saja._`;

      await this.sendDocument(chatId, buffer, fileName, caption);
    } catch (err) {
      await this.sendMessage(chatId, `❌ Gagal membuat backup ZIP: ${err.message}`);
    }
  }

  async sendBackup(chatId) {
    return await this.sendZipBackup(chatId);
  }

  // ==========================================
  // FITUR: PENGATURAN AUTO BACKUP (.ZIP)
  // ==========================================
  async sendAutoBackupMenu(chatId, messageId = null) {
    if (!db.data.settings) db.data.settings = {};
    if (!db.data.settings.autobackup) {
      db.data.settings.autobackup = {
        enabled: true,
        intervalHours: 24,
        lastBackup: 0
      };
    }

    const setting = db.data.settings.autobackup;
    const { getJakartaTimeString } = await import('../vynaafeture/owner-backup.js');
    const lastStr = setting.lastBackup ? getJakartaTimeString(new Date(setting.lastBackup)) : 'Belum pernah';
    const nextTime = setting.lastBackup ? new Date(setting.lastBackup + (setting.intervalHours * 3600 * 1000)) : new Date();
    const nextStr = setting.enabled ? getJakartaTimeString(nextTime) : '-';

    const text = `⚙️ *PENGATURAN AUTO BACKUP (.ZIP)*\n\n` +
      `Bot otomatis mencadangkan full source code & database ke format *.zip* secara berkala.\n\n` +
      `• *Status:* ${setting.enabled ? '🟢 *AKTIF*' : '🔴 *NONAKTIF*'}\n` +
      `• *Interval:* Setiap ${setting.intervalHours} Jam\n` +
      `• *Terakhir Backup:* ${lastStr}\n` +
      `• *Jadwal Berikut:* ${nextStr}\n` +
      `• *Tujuan:* WhatsApp Owner & Telegram Owner\n\n` +
      `Silakan atur opsi di bawah:`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: setting.enabled ? '🔴 Matikan Auto Backup' : '🟢 Aktifkan Auto Backup', callback_data: 'toggle_autobackup' }
        ],
        [
          { text: '⏱️ Interval 12 Jam', callback_data: 'set_backup_12h' },
          { text: '⏱️ Interval 24 Jam', callback_data: 'set_backup_24h' }
        ],
        [
          { text: '📦 Backup ZIP Sekarang', callback_data: 'act_backup' }
        ],
        [
          { text: '🔙 Menu Utama', callback_data: 'menu_main' }
        ]
      ]
    };

    return await this.safeSendOrEdit(chatId, messageId, text, { reply_markup: replyMarkup });
  }

  // ==========================================
  // FITUR: HAPUS SESI
  // ==========================================
  async sendDelSesiConfirmation(chatId, messageId = null) {
    const text = `⚠️ *KONFIRMASI PENGHAPUSAN SESI*\n\n` +
      `Apakah Anda yakin ingin menghapus folder sesi (*${config.sessionName}*)?\n\n` +
      `• Sesi login WhatsApp saat ini akan diputus.\n` +
      `• Bot akan bersih dari sesi lama dan siap dipairing kembali dengan nomor baru.\n` +
      `• Database user/chat TIDAK akan terhapus.`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '⚠️ Ya, Hapus Sesi Sekarang', callback_data: 'confirm_delsesi' },
          { text: '❌ Batal', callback_data: 'menu_main' }
        ]
      ]
    };

    return await this.safeSendOrEdit(chatId, messageId, text, { reply_markup: replyMarkup });
  }

  async executeDeleteSession(chatId, messageId = null) {
    await this.safeSendOrEdit(chatId, messageId, '⏳ Sedang membersihkan file sesi dan mereset socket...');
    try {
      const sessionPath = path.resolve(baseDir, config.sessionName);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }

      this.clearQR();

      if (this.handlers.resetSession) {
        await this.handlers.resetSession();
      }

      const text = `✅ *SESI BERHASIL DIHAPUS!*\n\n` +
        `Folder sesi (*${config.sessionName}*) telah dibersihkan sepenuhnya.\n` +
        `Koneksi WhatsApp telah di-reset ke mode awal.\n\n` +
        `Silakan ambil sesi baru dengan mengklik tombol di bawah:`;

      const replyMarkup = {
        inline_keyboard: [
          [{ text: '🔑 Ambil Sesi Baru (/getsesi)', callback_data: 'act_getsesi' }],
          [{ text: '🔙 Menu Utama', callback_data: 'menu_main' }]
        ]
      };

      await this.sendMessage(chatId, text, { reply_markup: replyMarkup });
    } catch (err) {
      await this.sendMessage(chatId, `❌ Gagal menghapus sesi: ${err.message}`);
    }
  }

  // ==========================================
  // FITUR: RESTART BOT
  // ==========================================
  async handleRestart(chatId, messageId = null) {
    await this.sendMessage(chatId, '🔄 *Merestart Bot WhatsApp...*\nProses akan dimulai ulang dalam 2 detik.');

    setTimeout(async () => {
      if (this.handlers.restartBot) {
        await this.handlers.restartBot();
      } else {
        process.exit(0);
      }
    }, 1500);
  }

  // ==========================================
  // POLLING ENGINE
  // ==========================================
  async startPolling() {
    if (this.isPolling || !this.token) return;
    this.isPolling = true;

    // Delete webhook first to ensure getUpdates works without conflict
    await this.request('deleteWebhook', { drop_pending_updates: false });

    // Set bot commands description in Telegram
    await this.request('setMyCommands', {
      commands: [
        { command: 'menu', description: 'Buka menu panel kontrol' },
        { command: 'getsesi', description: 'Ambil sesi Pairing Code / QR' },
        { command: 'status', description: 'Lihat status VPS & WhatsApp' },
        { command: 'backup', description: 'Backup database.json' },
        { command: 'delsesi', description: 'Hapus sesi login WhatsApp' },
        { command: 'restart', description: 'Restart bot WhatsApp' }
      ]
    });

    console.log('[Telegram Controller] Polling engine started successfully.');

    while (this.isPolling) {
      try {
        const res = await this.request('getUpdates', {
          offset: this.lastUpdateId + 1,
          timeout: 25,
          allowed_updates: ['message', 'callback_query']
        });

        if (res && res.ok && Array.isArray(res.result)) {
          for (const update of res.result) {
            this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
            await this.processUpdate(update).catch((err) => console.error('[Telegram Process Error]', err));
          }
        } else if (res && !res.ok) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      } catch (err) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  async processUpdate(update) {
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat?.id;
      const userId = String(msg.from?.id);
      const text = msg.text || '';

      if (text.startsWith('/')) {
        const parts = text.trim().split(/\s+/);
        const command = parts[0].split('@')[0];
        const args = parts.slice(1);
        await this.handleCommand(chatId, userId, command, args, msg);
      } else {
        await this.handleTextMessage(chatId, userId, text, msg);
      }
    } else if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }
  }

  stopPolling() {
    this.isPolling = false;
  }

  // ==========================================
  // HELPER FORMATTING
  // ==========================================
  formatUptime(seconds) {
    const sec = Math.floor(seconds);
    const d = Math.floor(sec / (3600 * 24));
    const h = Math.floor((sec % (3600 * 24)) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const parts = [];
    if (d > 0) parts.push(`${d} hari`);
    if (h > 0) parts.push(`${h} jam`);
    if (m > 0) parts.push(`${m} menit`);
    parts.push(`${s} detik`);
    return parts.join(' ');
  }

  getJakartaTime() {
    try {
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(new Date()) + ' WIB';
    } catch {
      return new Date().toLocaleString('id-ID');
    }
  }
}

export const telegram = new TelegramController();
export default telegram;
