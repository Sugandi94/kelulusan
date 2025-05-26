const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, SECRET_KEY } = require('../middleware/auth');

const router = express.Router();
const siswaPath = path.join(__dirname, '../data/siswa.json');
const adminPath = path.join(__dirname, '../data/admin.json');
const upload = multer({ dest: 'uploads/' });

// Helper load/save
function loadSiswa() {
  return fs.existsSync(siswaPath) ? JSON.parse(fs.readFileSync(siswaPath)) : [];
}
function saveSiswa(data) {
  fs.writeFileSync(siswaPath, JSON.stringify(data, null, 2));
}
function loadAdmin() {
  return fs.existsSync(adminPath) ? JSON.parse(fs.readFileSync(adminPath)) : [];
}
function saveAdmin(data) {
  fs.writeFileSync(adminPath, JSON.stringify(data, null, 2));
}

// Middleware to check superadmin role
function authenticateSuperadminToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token tidak ditemukan' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token tidak valid' });
    // Check if user is superadmin
    const admins = loadAdmin();
    const foundUser = admins.find(a => a.username === user.username && a.role === 'superadmin');
    if (!foundUser) return res.status(403).json({ message: 'Akses ditolak' });
    req.user = foundUser; // attach full user info including accessLevel
    next();
  });
}

// Get current superadmin user info
router.get('/me', authenticateSuperadminToken, (req, res) => {
  const { username, name, role, accessLevel } = req.user;
  res.json({ username, name, role, accessLevel });
});

// Middleware to check access level
function checkAccessLevel(requiredLevel) {
  return (req, res, next) => {
    const levels = ['read-only', 'limited', 'full'];
    const userLevel = req.user.accessLevel || 'read-only';
    if (levels.indexOf(userLevel) < levels.indexOf(requiredLevel)) {
      return res.status(403).json({ message: 'Akses tidak cukup' });
    }
    next();
  };
}

// Login superadmin (JWT)
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const data = loadAdmin();
  const superadmin = data.find(a => a.username === username && a.role === 'superadmin');
  if (!superadmin) return res.status(401).json({ message: 'Login gagal' });
  const valid = await bcrypt.compare(password, superadmin.password);
  if (!valid) return res.status(401).json({ message: 'Login gagal' });
  const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '8h' });
  res.json({ token });
});

// Ganti password superadmin
router.post('/change-password', authenticateSuperadminToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const admins = loadAdmin();
  const idx = admins.findIndex(a => a.username === req.user.username && a.role === 'superadmin');
  if (idx === -1) return res.status(401).json({ message: 'User tidak ditemukan' });
  const valid = await bcrypt.compare(oldPassword, admins[idx].password);
  if (!valid) return res.status(400).json({ message: 'Password lama salah' });
  admins[idx].password = await bcrypt.hash(newPassword, 10);
  saveAdmin(admins);
  res.json({ message: 'Password berhasil diganti' });
});

// List all siswa (no filtering by username)
router.get('/siswa', authenticateSuperadminToken, (req, res) => {
  let data = loadSiswa().filter(s => !s.deleted);
  const { q, page = 1, limit = 20 } = req.query;
  if (q)
    data = data.filter(
      (s) =>
        s.nama.toLowerCase().includes(q.toLowerCase()) ||
        s.nisn.includes(q) ||
        s.sekolah.toLowerCase().includes(q.toLowerCase())
    );
  const total = data.length;
  const slice = data.slice((page - 1) * limit, page * limit);
  res.json({ total, data: slice });
});

// Delete all siswa data (soft delete)
router.delete('/siswa/delete-all', authenticateSuperadminToken, (req, res) => {
  let data = loadSiswa();
  let count = 0;
  data.forEach(s => {
    if (!s.deleted) {
      s.deleted = true;
      count++;
    }
  });
  saveSiswa(data);
  res.json({ message: `Berhasil menghapus ${count} data siswa.` });
});

// Tambah siswa
router.post('/siswa', authenticateSuperadminToken, checkAccessLevel('limited'), (req, res) => {
  const data = loadSiswa();
  const { nisn, nama, sekolah, status } = req.body;
  if (!nisn || !nama || !sekolah || !status)
    return res.status(400).json({ message: 'Data tidak lengkap' });
  if (data.find(s => s.nisn === nisn && !s.deleted))
    return res.status(400).json({ message: 'NISN sudah ada' });
  data.push({ id: uuidv4(), nisn, nama, sekolah, status, importedBy: req.user.username });
  saveSiswa(data);
  res.json({ message: 'Siswa ditambah' });
});

// Edit siswa
router.put('/siswa/:id', authenticateSuperadminToken, checkAccessLevel('limited'), (req, res) => {
  const data = loadSiswa();
  const idx = data.findIndex(s => s.id === req.params.id && !s.deleted);
  if (idx === -1) return res.status(404).json({ message: 'Siswa tidak ditemukan' });
  const { nisn, nama, sekolah, status } = req.body;
  data[idx] = { ...data[idx], nisn, nama, sekolah, status };
  saveSiswa(data);
  res.json({ message: 'Siswa diupdate' });
});

// Hapus siswa (soft delete)
router.delete('/siswa/:id', authenticateSuperadminToken, checkAccessLevel('limited'), (req, res) => {
  const data = loadSiswa();
  const idx = data.findIndex(s => s.id === req.params.id && !s.deleted);
  if (idx === -1) return res.status(404).json({ message: 'Siswa tidak ditemukan' });
  data[idx].deleted = true;
  saveSiswa(data);
  res.json({ message: 'Siswa dihapus (soft delete)' });
});

// Import Excel
router.post('/import', authenticateSuperadminToken, checkAccessLevel('limited'), upload.single('file'), (req, res) => {
  const workbook = xlsx.readFile(req.file.path);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const imported = xlsx.utils.sheet_to_json(sheet);
  // Format harus: nisn, nama, sekolah, status
  let data = loadSiswa();
  let count = 0;
  imported.forEach(row => {
    if (!row.nisn || !row.nama || !row.sekolah || !row.status) return;
    if (!data.find(s => s.nisn == row.nisn && !s.deleted)) {
      data.push({ id: uuidv4(), nisn: row.nisn, nama: row.nama, sekolah: row.sekolah, status: row.status, importedBy: req.user.username });
      count++;
    }
  });
  saveSiswa(data);
  res.json({ message: `Import berhasil (${count} data baru)` });
});

// Export data siswa ke Excel
router.get('/export', authenticateSuperadminToken, checkAccessLevel('read-only'), (req, res) => {
  let data = loadSiswa().filter(s => !s.deleted);

  // Add nomor (index) to each row
  const numberedData = data.map((item, index) => {
    const { id, deleted, ...rest } = item;
    return { No: index + 1, ...rest };
  });

  const ws = xlsx.utils.json_to_sheet(numberedData);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Siswa');
  const file = path.join('uploads', `siswa_export_${Date.now()}.xlsx`);
  xlsx.writeFile(wb, file);
  res.download(file, () => fs.unlinkSync(file));
});

// Lihat log aktivitas
router.get('/log', authenticateSuperadminToken, checkAccessLevel('read-only'), (req, res) => {
  const logPath = path.join(__dirname, '../data/log.json');
  const logs = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath)) : [];
  res.json(logs);
});

// Dashboard statistik
router.get('/dashboard', authenticateSuperadminToken, (req, res) => {
  const data = loadSiswa();
  const total = data.filter(s=>!s.deleted).length;
  const lulus = data.filter(s=>!s.deleted && s.status.toUpperCase() === 'LULUS').length;
  const tidak = data.filter(s=>!s.deleted && s.status.toUpperCase() !== 'LULUS').length;
  res.json({ total, lulus, tidak });
});

// Add user
router.post('/add-user', authenticateSuperadminToken, checkAccessLevel('full'), async (req, res) => {
  const { username, name, password } = req.body;
  if (!username || !name || !password) return res.status(400).json({ message: 'Username, name dan password harus diisi' });

  const admins = loadAdmin();
  if (admins.find(a => a.username === username)) {
    return res.status(400).json({ message: 'Username sudah digunakan' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  admins.push({ username, name, password: hashedPassword, role: 'superadmin' });
  saveAdmin(admins);
  res.json({ message: 'User superadmin berhasil ditambahkan' });
});

// List all admin users
router.get('/users', authenticateSuperadminToken, (req, res) => {
  const admins = loadAdmin();
  const users = admins.map(({ username, name, role }) => ({ username, name, role }));
  res.json(users);
});

// Delete admin user
router.delete('/delete-user/:username', authenticateSuperadminToken, checkAccessLevel('full'), (req, res) => {
  const username = req.params.username;
  let admins = loadAdmin();
  if (username === req.user.username) {
    return res.status(400).json({ message: 'Tidak dapat menghapus user sendiri' });
  }
  const idx = admins.findIndex(a => a.username === username);
  if (idx === -1) return res.status(404).json({ message: 'User tidak ditemukan' });
  admins.splice(idx, 1);
  saveAdmin(admins);
  res.json({ message: 'User berhasil dihapus' });
});

// Update admin user
router.put('/update-user/:username', authenticateSuperadminToken, checkAccessLevel('full'), async (req, res) => {
  const oldUsername = req.params.username;
  const { username, name, role } = req.body;
  if (!username || !name || !role) return res.status(400).json({ message: 'Username, name dan role harus diisi' });

  let admins = loadAdmin();
  const idx = admins.findIndex(a => a.username === oldUsername);
  if (idx === -1) return res.status(404).json({ message: 'User tidak ditemukan' });

  // Check if new username is already used by another user
  if (username !== oldUsername && admins.find(a => a.username === username)) {
    return res.status(400).json({ message: 'Username sudah digunakan' });
  }

  admins[idx].username = username;
  admins[idx].name = name;
  admins[idx].role = role;
  saveAdmin(admins);
  res.json({ message: 'User berhasil diupdate' });
});

// Import admin users from Excel
router.post('/import-admin', authenticateSuperadminToken, checkAccessLevel('full'), upload.single('file'), async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const imported = xlsx.utils.sheet_to_json(sheet);
    // Format harus: username, name, password, role
    let admins = loadAdmin();
    let count = 0;
    for (const row of imported) {
      if (!row.username || !row.name || !row.password || !row.role) continue;
      if (!admins.find(a => a.username === row.username)) {
        const hashedPassword = await bcrypt.hash(row.password.toString(), 10);
        admins.push({ username: row.username, name: row.name, password: hashedPassword, role: row.role });
        count++;
      }
    }
    saveAdmin(admins);
    res.json({ message: `Import berhasil (${count} user baru)` });
  } catch (error) {
    console.error('Error importing admin:', error);
    res.status(500).json({ message: 'Gagal mengimpor data admin', error: error.message });
  }
});

module.exports = router;
