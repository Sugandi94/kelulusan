document.addEventListener('DOMContentLoaded', () => {
  const addUserForm = document.getElementById('addUserForm');
  const userTableBody = document.querySelector('#userTable tbody');

  // Fetch and display user list
  async function fetchUsers() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/admin/users', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('Gagal mengambil data user');
      const users = await res.json();
      userTableBody.innerHTML = '';
      users.forEach(user => {
        const tr = document.createElement('tr');
        const tdUsername = document.createElement('td');
        tdUsername.textContent = user.username;
        tr.appendChild(tdUsername);
        userTableBody.appendChild(tr);
      });
    } catch (err) {
      alert(err.message);
    }
  }

  // Add new user
  addUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = addUserForm.username.value.trim();
    const password = addUserForm.password.value.trim();
    if (!username || !password) {
      alert('Username dan password harus diisi');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/admin/add-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menambah user');
      alert(data.message);
      addUserForm.reset();
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  });

  fetchUsers();
});
