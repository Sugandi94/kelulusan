const request = require('supertest');
const express = require('express');
const adminRoutes = require('../routes/admin');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const SECRET_KEY = 'testsecret'; // Use a test secret key

// Mock middleware/auth.js to use test secret key and bypass authenticateToken for some tests
jest.mock('../middleware/auth', () => ({
  SECRET_KEY: 'testsecret',
  authenticateToken: (req, res, next) => {
    if (req.headers.authorization === 'Bearer validtoken') {
      req.user = { username: 'admin' };
      next();
    } else {
      res.status(401).json({ message: 'Unauthorized' });
    }
  }
}));

// Setup express app for testing
const app = express();
app.use(bodyParser.json());
app.use('/admin', adminRoutes);

describe('Admin Routes', () => {
  // Mock data file paths
  const adminPath = path.join(__dirname, '../data/admin.json');
  const siswaPath = path.join(__dirname, '../data/siswa.json');

  // Backup original data
  let originalAdminData;
  let originalSiswaData;

  beforeAll(() => {
    if (fs.existsSync(adminPath)) {
      originalAdminData = fs.readFileSync(adminPath, 'utf-8');
    }
    if (fs.existsSync(siswaPath)) {
      originalSiswaData = fs.readFileSync(siswaPath, 'utf-8');
    }
  });

  afterAll(() => {
    // Restore original data
    if (originalAdminData) fs.writeFileSync(adminPath, originalAdminData);
    if (originalSiswaData) fs.writeFileSync(siswaPath, originalSiswaData);
  });

  describe('POST /admin/login', () => {
    beforeEach(() => {
      // Write a test admin user with hashed password
      const hashedPassword = bcrypt.hashSync('password123', 10);
      const admins = [{ username: 'admin', password: hashedPassword }];
      fs.writeFileSync(adminPath, JSON.stringify(admins, null, 2));
    });

    it('should login successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/admin/login')
        .send({ username: 'admin', password: 'password123' });
      expect(res.statusCode).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('should fail login with wrong username', async () => {
      const res = await request(app)
        .post('/admin/login')
        .send({ username: 'wrong', password: 'password123' });
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Login gagal');
    });

    it('should fail login with wrong password', async () => {
      const res = await request(app)
        .post('/admin/login')
        .send({ username: 'admin', password: 'wrongpass' });
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Login gagal');
    });
  });

  describe('POST /admin/change-password', () => {
    beforeEach(() => {
      const hashedPassword = bcrypt.hashSync('oldpass', 10);
      const admins = [{ username: 'admin', password: hashedPassword }];
      fs.writeFileSync(adminPath, JSON.stringify(admins, null, 2));
    });

    it('should change password successfully', async () => {
      const res = await request(app)
        .post('/admin/change-password')
        .set('Authorization', 'Bearer validtoken')
        .send({ oldPassword: 'oldpass', newPassword: 'newpass' });
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Password berhasil diganti');
    });

    it('should fail if old password is wrong', async () => {
      const res = await request(app)
        .post('/admin/change-password')
        .set('Authorization', 'Bearer validtoken')
        .send({ oldPassword: 'wrongold', newPassword: 'newpass' });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('Password lama salah');
    });

    it('should fail if user not found', async () => {
      // Simulate user not found by clearing admin data
      fs.writeFileSync(adminPath, JSON.stringify([]));
      const res = await request(app)
        .post('/admin/change-password')
        .set('Authorization', 'Bearer validtoken')
        .send({ oldPassword: 'oldpass', newPassword: 'newpass' });
      expect(res.statusCode).toBe(401);
    });
  });

  // Additional tests for siswa CRUD, import/export, logs, dashboard, add-user can be added similarly

  describe('POST /admin/import', () => {
    beforeEach(() => {
      // Clear siswa data before import
      fs.writeFileSync(path.join(__dirname, '../data/siswa.json'), JSON.stringify([], null, 2));
    });

    it('should import siswa data with importedBy field', async () => {
      // Prepare a sample Excel file buffer with siswa data
      const XLSX = require('xlsx');
      const wb = XLSX.utils.book_new();
      const wsData = [
        ['nisn', 'nama', 'sekolah', 'status'],
        ['1234567890', 'Test Siswa', 'Test School', 'LULUS']
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Write buffer to a temp file
      const tmp = require('tmp');
      const tmpFile = tmp.fileSync({ postfix: '.xlsx' });
      require('fs').writeFileSync(tmpFile.name, buffer);

      const res = await request(app)
        .post('/admin/import')
        .set('Authorization', 'Bearer validtoken')
        .attach('file', tmpFile.name);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/Import berhasil/);

      // Verify siswa data has importedBy field
      const siswaData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/siswa.json')));
      expect(siswaData.length).toBe(1);
      expect(siswaData[0].importedBy).toBe('admin');
      expect(siswaData[0].nama).toBe('Test Siswa');

      tmpFile.removeCallback();
    });
  });

  describe('GET /admin/users', () => {
    it('should return list of admin users', async () => {
      // Prepare admin data
      const admins = [
        { username: 'admin1', password: 'hashedpass1' },
        { username: 'admin2', password: 'hashedpass2' }
      ];
      fs.writeFileSync(path.join(__dirname, '../data/admin.json'), JSON.stringify(admins, null, 2));

      const res = await request(app)
        .get('/admin/users')
        .set('Authorization', 'Bearer validtoken');

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual([
        { username: 'admin1' },
        { username: 'admin2' }
      ]);
    });
  });
});
