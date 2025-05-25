const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const siswaPath = path.join(__dirname, '../data/siswa.json');

// Cek kelulusan berdasarkan NISN
router.post('/cek', (req, res) => {
  const { nisn } = req.body;
  const data = JSON.parse(fs.readFileSync(siswaPath));
  const siswa = data.find(s => s.nisn === nisn && !s.deleted);
  if (!siswa) return res.status(404).json({ message: 'Data tidak ditemukan' });
  res.json({
    nama: siswa.nama,
    sekolah: siswa.sekolah,
    status: siswa.status
  });
});

module.exports = router;