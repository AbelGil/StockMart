
// ── DATA ──────────────────────────────────────────────
let productos = JSON.parse(localStorage.getItem('sm_productos') || '[]');
let proveedores = JSON.parse(localStorage.getItem('sm_proveedores') || '[]');
let editingId = null;
let editingProvId = null;

function save() {
  localStorage.setItem('sm_productos', JSON.stringify(productos));
  localStorage.setItem('sm_proveedores', JSON.stringify(proveedores));
}

function uid() { return Date.now() + Math.random().toString(36).slice(2); }

// ── NAVIGATION ────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.textContent.trim().toLowerCase().includes(page === 'dashboard' ? 'dash' : page.slice(0,4)))
      n.classList.add('active');
  });
  if (page === 'dashboard') renderDashboard();
  if (page === 'inventario') renderInventario();
  if (page === 'proveedores') renderProveedores();
}

// ── TOAST ─────────────────────────────────────────────
function toast(msg, error = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (error ? ' error' : '');
  setTimeout(() => t.className = 'toast', 2800);
}

// ── STATUS ────────────────────────────────────────────
function getStatus(p) {
  if (p.cantidad === 0) return { label: 'Sin stock', cls: 'badge-danger' };
  if (p.cantidad <= (p.minimo || 5)) return { label: 'Stock bajo', cls: 'badge-warn' };
  return { label: 'Disponible', cls: 'badge-ok' };
}

// ── DASHBOARD ─────────────────────────────────────────
function renderDashboard() {
  const low = productos.filter(p => p.cantidad > 0 && p.cantidad <= (p.minimo || 5));
  const empty = productos.filter(p => p.cantidad === 0);

  document.getElementById('stat-total').textContent = productos.length;
  document.getElementById('stat-low').textContent = low.length;
  document.getElementById('stat-empty').textContent = empty.length;
  document.getElementById('stat-prov').textContent = proveedores.length;

  // Alert banner
  const alertSection = document.getElementById('alert-section');
  if (empty.length > 0) {
    alertSection.innerHTML = `<div class="alert-banner">🚫 <strong>${empty.length} producto(s) sin stock:</strong> ${empty.map(p => p.nombre).join(', ')}</div>`;
  } else {
    alertSection.innerHTML = '';
  }

  // Low stock table
  const lowTbl = document.getElementById('dash-low-table');
  if (low.length === 0 && empty.length === 0) {
    lowTbl.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:20px">Sin alertas 🎉</td></tr>';
  } else {
    const alerts = [...empty, ...low];
    lowTbl.innerHTML = alerts.map(p => {
      const s = getStatus(p);
      return `<tr><td>${p.nombre}</td><td>${p.cantidad}</td><td><span class="badge ${s.cls}">${s.label}</span></td></tr>`;
    }).join('');
  }

  // Recent
  const recentTbl = document.getElementById('dash-recent-table');
  const recent = [...productos].reverse().slice(0, 5);
  if (recent.length === 0) {
    recentTbl.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:20px">Sin productos aún</td></tr>';
  } else {
    recentTbl.innerHTML = recent.map(p => `
      <tr>
        <td>${p.nombre}</td>
        <td><span class="badge badge-cat">${p.categoria}</span></td>
        <td>$${parseFloat(p.precio).toFixed(2)}</td>
      </tr>`).join('');
  }
}

// ── INVENTARIO ────────────────────────────────────────
function renderInventario() {
  const q = document.getElementById('search-inv').value.toLowerCase();
  const cat = document.getElementById('filter-cat').value;
  const tbl = document.getElementById('inv-table');

  let filtered = productos.filter(p => {
    const matchQ = p.nombre.toLowerCase().includes(q) || (p.proveedor || '').toLowerCase().includes(q);
    const matchCat = !cat || p.categoria === cat;
    return matchQ && matchCat;
  });

  if (filtered.length === 0) {
    tbl.innerHTML = `<tr><td colspan="7"><div class="empty"><div class="empty-icon">📦</div><div class="empty-text">No se encontraron productos</div></div></td></tr>`;
    return;
  }

  tbl.innerHTML = filtered.map(p => {
    const s = getStatus(p);
    const prov = proveedores.find(v => v.id === p.proveedorId);
    return `<tr>
      <td><strong>${p.nombre}</strong></td>
      <td><span class="badge badge-cat">${p.categoria}</span></td>
      <td>${p.cantidad}</td>
      <td>$${parseFloat(p.precio).toFixed(2)}</td>
      <td>${prov ? prov.nombre : '<span style="color:var(--muted)">—</span>'}</td>
      <td><span class="badge ${s.cls}">${s.label}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="editProducto('${p.id}')">✏️ Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProducto('${p.id}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

// ── MODAL PRODUCTO ────────────────────────────────────
function openModal(id = null) {
  editingId = id;
  const modal = document.getElementById('modal-producto');

  // Populate proveedor select
  const sel = document.getElementById('inp-prov');
  sel.innerHTML = '<option value="">-- Sin proveedor --</option>' +
    proveedores.map(v => `<option value="${v.id}">${v.nombre}</option>`).join('');

  if (id) {
    const p = productos.find(x => x.id === id);
    document.getElementById('modal-producto-title').textContent = 'Editar Producto';
    document.getElementById('inp-nombre').value = p.nombre;
    document.getElementById('inp-cat').value = p.categoria;
    document.getElementById('inp-cantidad').value = p.cantidad;
    document.getElementById('inp-precio').value = p.precio;
    document.getElementById('inp-minimo').value = p.minimo || 5;
    document.getElementById('inp-prov').value = p.proveedorId || '';
  } else {
    document.getElementById('modal-producto-title').textContent = 'Agregar Producto';
    ['inp-nombre','inp-cantidad','inp-precio','inp-minimo'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('inp-cat').value = 'Lácteos';
    document.getElementById('inp-prov').value = '';
  }
  modal.classList.add('open');
}

function closeModal() { document.getElementById('modal-producto').classList.remove('open'); editingId = null; }

function guardarProducto() {
  const nombre = document.getElementById('inp-nombre').value.trim();
  const cantidad = parseInt(document.getElementById('inp-cantidad').value);
  const precio = parseFloat(document.getElementById('inp-precio').value);
  const categoria = document.getElementById('inp-cat').value;
  const proveedorId = document.getElementById('inp-prov').value;
  const minimo = parseInt(document.getElementById('inp-minimo').value) || 5;

  if (!nombre || isNaN(cantidad) || isNaN(precio)) {
    toast('Por favor llena todos los campos requeridos', true); return;
  }

  const prov = proveedores.find(v => v.id === proveedorId);

  if (editingId) {
    const i = productos.findIndex(p => p.id === editingId);
    productos[i] = { ...productos[i], nombre, cantidad, precio, categoria, proveedorId, proveedor: prov ? prov.nombre : '', minimo };
    toast('Producto actualizado ✓');
  } else {
    productos.push({ id: uid(), nombre, cantidad, precio, categoria, proveedorId, proveedor: prov ? prov.nombre : '', minimo });
    toast('Producto agregado ✓');
  }
  save(); closeModal(); renderInventario();
}

function editProducto(id) { navigate('inventario'); openModal(id); }

function deleteProducto(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  productos = productos.filter(p => p.id !== id);
  save(); renderInventario(); toast('Producto eliminado');
}

// ── PROVEEDORES ───────────────────────────────────────
function renderProveedores() {
  const q = document.getElementById('search-prov').value.toLowerCase();
  const tbl = document.getElementById('prov-table');
  const filtered = proveedores.filter(v => v.nombre.toLowerCase().includes(q));

  if (filtered.length === 0) {
    tbl.innerHTML = `<tr><td colspan="5"><div class="empty"><div class="empty-icon">🏭</div><div class="empty-text">No se encontraron proveedores</div></div></td></tr>`;
    return;
  }

  tbl.innerHTML = filtered.map(v => {
    const count = productos.filter(p => p.proveedorId === v.id).length;
    return `<tr>
      <td><strong>${v.nombre}</strong></td>
      <td>${v.telefono || '—'}</td>
      <td><span class="badge badge-cat">${v.categoria}</span></td>
      <td>${count} producto(s)</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="editProveedor('${v.id}')">✏️ Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProveedor('${v.id}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function openProvModal(id = null) {
  editingProvId = id;
  if (id) {
    const v = proveedores.find(x => x.id === id);
    document.getElementById('modal-prov-title').textContent = 'Editar Proveedor';
    document.getElementById('pinp-nombre').value = v.nombre;
    document.getElementById('pinp-tel').value = v.telefono || '';
    document.getElementById('pinp-cat').value = v.categoria;
  } else {
    document.getElementById('modal-prov-title').textContent = 'Agregar Proveedor';
    document.getElementById('pinp-nombre').value = '';
    document.getElementById('pinp-tel').value = '';
    document.getElementById('pinp-cat').value = 'Lácteos';
  }
  document.getElementById('modal-proveedor').classList.add('open');
}

function closeProvModal() { document.getElementById('modal-proveedor').classList.remove('open'); editingProvId = null; }

function guardarProveedor() {
  const nombre = document.getElementById('pinp-nombre').value.trim();
  const telefono = document.getElementById('pinp-tel').value.trim();
  const categoria = document.getElementById('pinp-cat').value;
  if (!nombre) { toast('El nombre es requerido', true); return; }

  if (editingProvId) {
    const i = proveedores.findIndex(v => v.id === editingProvId);
    proveedores[i] = { ...proveedores[i], nombre, telefono, categoria };
    toast('Proveedor actualizado ✓');
  } else {
    proveedores.push({ id: uid(), nombre, telefono, categoria });
    toast('Proveedor agregado ✓');
  }
  save(); closeProvModal(); renderProveedores();
  document.getElementById('stat-prov').textContent = proveedores.length;
}

function editProveedor(id) { openProvModal(id); }

function deleteProveedor(id) {
  if (!confirm('¿Eliminar este proveedor?')) return;
  proveedores = proveedores.filter(v => v.id !== id);
  // Remove link from products
  productos = productos.map(p => p.proveedorId === id ? { ...p, proveedorId: '', proveedor: '' } : p);
  save(); renderProveedores(); toast('Proveedor eliminado');
}

// Close modals on overlay click
document.getElementById('modal-producto').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.getElementById('modal-proveedor').addEventListener('click', e => { if (e.target === e.currentTarget) closeProvModal(); });

// Init
renderDashboard();
