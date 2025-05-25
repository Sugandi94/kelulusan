const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
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

// Login admin (JWT)
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const data = loadAdmin();
  const admin = data.find(a => a.username === username);
  if (!admin) return res.status(401).json({ message: 'Login gagal' });
  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) return res.status(401).json({ message: 'Login gagal' });
  const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '8h' });
  res.json({ token });
});

// Ganti password admin
router.post('/change-password', authenticateToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const admins = loadAdmin();
  const idx = admins.findIndex(a => a.username === req.user.username);
  if (idx === -1) return res.status(401).json({ message: 'User tidak ditemukan' });
  const valid = await bcrypt.compare(oldPassword, admins[idx].password);
  if (!valid) return res.status(400).json({ message: 'Password lama salah' });
  admins[idx].password = await bcrypt.hash(newPassword, 10);
  saveAdmin(admins);
  res.json({ message: 'Password berhasil diganti' });
});

// List siswa (pencarian, pagination)
router.get('/siswa', authenticateToken, (req, res) => {
  let data = loadSiswa().filter(s => !s.deleted && s.importedBy === req.user.username);
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

// Tambah siswa
router.post('/siswa', authenticateToken, (req, res) => {
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
router.put('/siswa/:id', authenticateToken, (req, res) => {
  const data = loadSiswa();
  const idx = data.findIndex(s => s.id === req.params.id && !s.deleted);
  if (idx === -1) return res.status(404).json({ message: 'Siswa tidak ditemukan' });
  const { nisn, nama, sekolah, status } = req.body;
  data[idx] = { ...data[idx], nisn, nama, sekolah, status };
  saveSiswa(data);
  res.json({ message: 'Siswa diupdate' });
});

// Hapus siswa (soft delete)
router.delete('/siswa/:id', authenticateToken, (req, res) => {
  const data = loadSiswa();
  const idx = data.findIndex(s => s.id === req.params.id && !s.deleted);
  if (idx === -1) return res.status(404).json({ message: 'Siswa tidak ditemukan' });
  data[idx].deleted = true;
  saveSiswa(data);
  res.json({ message: 'Siswa dihapus (soft delete)' });
});

// Import Excel
router.post('/import', authenticateToken, upload.single('file'), (req, res) => {
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
router.get('/export', authenticateToken, (req, res) => {
  const data = loadSiswa().filter(s=>!s.deleted);
  const ws = xlsx.utils.json_to_sheet(data.map(({id, deleted, ...rest})=>rest));
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Siswa');
  const file = path.join('uploads', `siswa_export_${Date.now()}.xlsx`);
  xlsx.writeFile(wb, file);
  res.download(file, () => fs.unlinkSync(file));
});

// Lihat log aktivitas
router.get('/log', authenticateToken, (req, res) => {
  const logPath = path.join(__dirname, '../data/log.json');
  const logs = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath)) : [];
  res.json(logs);
});

// Dashboard statistik
router.get('/dashboard', authenticateToken, (req, res) => {
  const data = loadSiswa();
  const total = data.filter(s=>!s.deleted).length;
  const lulus = data.filter(s=>!s.deleted && s.status.toUpperCase() === 'LULUS').length;
  const tidak = data.filter(s=>!s.deleted && s.status.toUpperCase() !== 'LULUS').length;
  res.json({ total, lulus, tidak });
});

router.post('/add-user', authenticateToken, async (req, res) => {
  const { username, name, password } = req.body;
  if (!username || !name || !password) return res.status(400).json({ message: 'Username, name dan password harus diisi' });

  const admins = loadAdmin();
  if (admins.find(a => a.username === username)) {
    return res.status(400).json({ message: 'Username sudah digunakan' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  admins.push({ username, name, password: hashedPassword });
  saveAdmin(admins);
  res.json({ message: 'User admin berhasil ditambahkan' });
});

// List all admin users
router.get('/users', authenticateToken, (req, res) => {
  const admins = loadAdmin();
  const users = admins.map(({ username, name }) => ({ username, name }));
  res.json(users);
});

module.exports = router;
