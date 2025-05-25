const request = require('supertest');
const express = require('express');
const userRoutes = require('../routes/user');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

// Setup express app for testing
const app = express();
app.use(bodyParser.json());
app.use('/user', userRoutes);

describe('User Routes', () => {
  const siswaPath = path.join(__dirname, '../data/siswa.json');
  let originalSiswaData;

  beforeAll(() => {
    if (fs.existsSync(siswaPath)) {
      originalSiswaData = fs.readFileSync(siswaPath, 'utf-8');
    }
  });

  afterAll(() => {
    if (originalSiswaData) {
      fs.writeFileSync(siswaPath, originalSiswaData);
    }
  });

  beforeEach(() => {
    // Setup test siswa data
    const siswaData = [
      { id: '1', nisn: '12345', nama: 'Test Siswa', sekolah: 'Test School', status: 'LULUS' },
      { id: '2', nisn: '67890', nama: 'Another Siswa', sekolah: 'Another School', status: 'TIDAK LULUS', deleted: true }
    ];
    fs.writeFileSync(siswaPath, JSON.stringify(siswaData, null, 2));
  });

  test('POST /user/cek - should return siswa data if found', async () => {
    const res = await request(app)
      .post('/user/cek')
      .send({ nisn: '12345' });
    expect(res.statusCode).toBe(200);
    expect(res.body.nama).toBe('Test Siswa');
    expect(res.body.sekolah).toBe('Test School');
    expect(res.body.status).toBe('LULUS');
  });

  test('POST /user/cek - should return 404 if siswa not found', async () => {
    const res = await request(app)
      .post('/user/cek')
      .send({ nisn: '99999' });
    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe('Data tidak ditemukan');
  });
});
