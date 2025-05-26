document.addEventListener('DOMContentLoaded', () => {
  const addUserForm = document.getElementById('addUserForm');
  const importUserForm = document.getElementById('importUserForm');
  const importFileInput = document.getElementById('importFile');
  const userTableBody = document.querySelector('#userTable tbody');

  // Fetch and display user list
  async function fetchUsers() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/ss/users', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('Gagal mengambil data user');
      const users = await res.json();
      userTableBody.innerHTML = '';
      users.forEach((user, index) => {
        const tr = document.createElement('tr');
        const tdNo = document.createElement('td');
        tdNo.textContent = index + 1;

        const tdUsername = document.createElement('td');
        const usernameInput = document.createElement('input');
        usernameInput.type = 'text';
        usernameInput.value = user.username;
        usernameInput.disabled = true;
        tdUsername.appendChild(usernameInput);

        const tdName = document.createElement('td');
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = user.name || '';
        nameInput.disabled = true;
        tdName.appendChild(nameInput);

        const tdActions = document.createElement('td');

        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.classList.add('edit-btn');
        editButton.onclick = () => {
          if (editButton.textContent === 'Edit') {
            usernameInput.disabled = false;
            nameInput.disabled = false;
            editButton.textContent = 'Save';
            editButton.dataset.oldUsername = usernameInput.value; // store old username
          } else {
            // Save changes
            const newUsername = usernameInput.value.trim();
            const newName = nameInput.value.trim();
            const oldUsername = editButton.dataset.oldUsername;
            if (!newUsername) {
              alert('Username tidak boleh kosong');
              return;
            }
            fetch(`/ss/update-user/${encodeURIComponent(oldUsername)}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + localStorage.getItem('token')
              },
              body: JSON.stringify({ username: newUsername, name: newName })
            })
            .then(res => res.json())
            .then(data => {
              if (data.message) alert(data.message);
              editButton.textContent = 'Edit';
              usernameInput.disabled = true;
              nameInput.disabled = true;
              fetchUsers();
            })
            .catch(() => alert('Gagal menyimpan perubahan'));
          }
        };

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.classList.add('delete-btn');
        deleteButton.onclick = () => {
          if (confirm(`Hapus user ${user.username}?`)) {
            fetch(`/ss/delete-user/${user.username}`, {
              method: 'DELETE',
              headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
            })
            .then(res => res.json())
            .then(data => {
              if (data.message) alert(data.message);
              fetchUsers();
            })
            .catch(() => alert('Gagal menghapus user'));
          }
        };

        tdActions.appendChild(editButton);
        tdActions.appendChild(deleteButton);

        tr.appendChild(tdNo);
        tr.appendChild(tdUsername);
        tr.appendChild(tdName);
        tr.appendChild(tdActions);
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
    const name = addUserForm.name.value.trim();
    const password = addUserForm.password.value.trim();
    if (!username || !name || !password) {
      alert('Username, name dan password harus diisi');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/ss/add-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ username, name, password })
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

  // Import users from Excel
  importUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (importFileInput.files.length === 0) {
      alert('Pilih file Excel terlebih dahulu');
      return;
    }
    const file = importFileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/ss/import-admin', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token
        },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal mengimpor user');
      alert(data.message);
      importUserForm.reset();
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  });

  fetchUsers();
});
