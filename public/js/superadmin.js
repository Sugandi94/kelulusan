function login() {
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  fetch('/superadmin/login', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      username: usernameInput.value,
      password: passwordInput.value
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.token) {
      token = data.token;
      localStorage.setItem('token', token);
      document.getElementById('login-form').style.display = 'none';
      document.getElementById('superadmin-panel').style.display = 'block';
      loadDashboard();
      loadSiswa();
      fetchUsers();
      fetchCurrentUser();
    } else {
      alert('Login gagal');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const addUserForm = document.getElementById('addUserForm');
  const importUserForm = document.getElementById('importUserForm');
  const importFileInput = document.getElementById('importFile');
  const userTableBody = document.querySelector('#userTable tbody');

  let token = '', page=1, limit=10, total=0;

  // Check token on page load to keep user logged in
  const storedToken = localStorage.getItem('token');
  let currentUser = null;

  async function fetchCurrentUser() {
    try {
      const res = await fetch('/superadmin/me', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('Gagal mengambil info user');
      currentUser = await res.json();
      applyAccessLevel();
    } catch (err) {
      alert(err.message);
    }
  }

  function applyAccessLevel() {
    if (!currentUser) return;
    const level = currentUser.accessLevel || 'read-only';

    // Disable or hide UI elements based on access level
    if (level === 'read-only') {
      // Disable all buttons except logout and export
      document.querySelectorAll('button').forEach(btn => {
        if (!btn.textContent.toLowerCase().includes('logout') && !btn.textContent.toLowerCase().includes('export')) {
          btn.disabled = true;
        }
      });
      // Disable inputs and selects
      document.querySelectorAll('input, select').forEach(el => el.disabled = true);
      // Hide add user form and import user form
      const addUserForm = document.getElementById('addUserForm');
      const importUserForm = document.getElementById('importUserForm');
      if (addUserForm) addUserForm.style.display = 'none';
      if (importUserForm) importUserForm.style.display = 'none';
    } else if (level === 'limited') {
      // Enable buttons for adding/editing siswa but disable user management
      const addUserForm = document.getElementById('addUserForm');
      const importUserForm = document.getElementById('importUserForm');
      if (addUserForm) addUserForm.style.display = 'none';
      if (importUserForm) importUserForm.style.display = 'none';
      // Enable inputs and buttons related to siswa management
      // (Assuming buttons have onclick handlers with 'Siswa' in name)
      document.querySelectorAll('button').forEach(btn => {
        if (btn.textContent.toLowerCase().includes('siswa') || btn.textContent.toLowerCase().includes('logout') || btn.textContent.toLowerCase().includes('export')) {
          btn.disabled = false;
        } else {
          btn.disabled = true;
        }
      });
      document.querySelectorAll('input, select').forEach(el => el.disabled = false);
    } else {
      // full access, enable all
      document.querySelectorAll('button').forEach(btn => btn.disabled = false);
      document.querySelectorAll('input, select').forEach(el => el.disabled = false);
      const addUserForm = document.getElementById('addUserForm');
      const importUserForm = document.getElementById('importUserForm');
      if (addUserForm) addUserForm.style.display = 'block';
      if (importUserForm) importUserForm.style.display = 'block';
    }
  }

  if (storedToken) {
    token = storedToken;
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('superadmin-panel').style.display = 'block';
    loadDashboard();
    loadSiswa();
    fetchUsers();
    fetchCurrentUser();
  } else {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('superadmin-panel').style.display = 'none';
  }
});
function logout() {
  token = '';
  localStorage.removeItem('token');
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('superadmin-panel').style.display = 'none';
}

function loadDashboard() {
  fetch('/superadmin/dashboard', {
    headers: { Authorization: 'Bearer ' + token }
  })
  .then(res => res.json())
  .then(data => {
    const dashboard = document.getElementById('dashboard');
    dashboard.innerHTML = `
      <p>Total Siswa: ${data.total}</p>
      <p>Siswa Lulus: ${data.lulus}</p>
      <p>Siswa Tidak Lulus: ${data.tidak}</p>
    `;
  })
  .catch(() => {
    alert('Gagal memuat dashboard');
  });
}

function loadSiswa() {
  const search = document.getElementById('search').value.toLowerCase();
  fetch('/superadmin/siswa', {
    headers: { Authorization: 'Bearer ' + token }
  })
  .then(res => res.json())
  .then(response => {
    let data = response.data || [];
    let filtered = data.filter(s => !s.deleted);
    if (search) {
      filtered = filtered.filter(s =>
        s.nama.toLowerCase().includes(search) ||
        s.nisn.toLowerCase().includes(search) ||
        s.sekolah.toLowerCase().includes(search)
      );
    }
    const daftar = document.getElementById('daftar');
    if (filtered.length === 0) {
      daftar.innerHTML = '<p>Tidak ada data siswa.</p>';
      return;
    }
    let html = '<table><thead><tr><th>NISN</th><th>Nama</th><th>Sekolah</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
    filtered.forEach(s => {
      html += `<tr>
        <td>${s.nisn}</td>
        <td>${s.nama}</td>
        <td>${s.sekolah}</td>
        <td>${s.status}</td>
        <td>
          <button onclick="editSiswa('${s.id}')">Edit</button>
          <button onclick="hapusSiswa('${s.id}')">Hapus</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    daftar.innerHTML = html;
  })
  .catch(() => {
    alert('Gagal memuat data siswa');
  });
}

function fetchUsers() {
  fetch('/superadmin/users', {
    headers: { Authorization: 'Bearer ' + token }
  })
  .then(res => res.json())
  .then(users => {
    const tbody = document.querySelector('#userTable tbody');
    tbody.innerHTML = '';
    users.forEach((user, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${user.username}</td>
        <td>${user.name}</td>
        <td>
          <button onclick="editUser('${user.username}')">Edit</button>
          <button onclick="deleteUser('${user.username}')">Hapus</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  })
  .catch(() => {
    alert('Gagal memuat data user');
  });
}
