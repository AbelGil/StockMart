//Conexion a la base de datos Supabase
const supabaseUrl = 'https://fprbravswyywufwwmvwy.supabase.co';
const supabaseKey = 'sb_publishable_1_QgPFym2E7U_zfsRr0D3A_kj7ve4aj';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ── SEGURIDAD (CANDADO DE SESIÓN) ─────────────────────
async function revisarSesion() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  
  if (!session) {
    // Si no hay sesión, lo regresamos al login inmediatamente
    window.location.href = 'login.html';
  }
}
// Ejecutar el candado apenas cargue el archivo
revisarSesion();

async function cerrarSesion() {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}
// ──────────────────────────────────────────────────────

console.log('Estado de Supabase:', supabaseClient ? 'Conectado a la nube ☁️' : 'Error');

// ── DATA ──────────────────────────────────────────────
let productos = [];
let proveedores = [];
let categorias = [];
let editingId = null;
let editingProvId = null;

//carga de datos desde Supabase
async function cargarDatosNube() {
  try {
    //descargar categorias
    const{data: catData, error: catError} = await supabaseClient.from('categorias').select('*');
    if(catError) throw catError;
    categorias = catData;

    //descargar proveedores
    const{data: provData, error: provError} = await supabaseClient.from('proveedores').select('*');
    if(provError) throw provError;
    proveedores = provData;

    //descargar productos
    const{data: prodData, error: prodError} = await supabaseClient.from('productos').select('*');
    if(prodError) throw prodError;
    productos = prodData;

    console.log("📦 Datos sincronizados desde la nube:", { categorias, proveedores, productos });

    navigate('dashboard');
  } catch (error) {
    console.error('Error al cargar datos:', error);
    toast('Error al cargar datos desde la nube', true);
  }

}


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
  if(page === 'historial') renderHistorial();
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
        <td><span class="badge badge-cat">${categorias.find(c => c.id === p.categoria_id)?.nombre || '—'}</span></td>
        <td>$${parseFloat(p.precio).toFixed(2)}</td>
      </tr>`).join('');
  }
  renderGrafica();
}

// ── INVENTARIO ────────────────────────────────────────
function renderInventario() {
  const q = document.getElementById('search-inv').value.toLowerCase();
  const cat = document.getElementById('filter-cat').value;
  const tbl = document.getElementById('inv-table');

  let filtered = productos.filter(p => {
    // 1. Traducir los UUIDs a nombres reales para poder buscar
    const provObj = proveedores.find(v => v.id === p.proveedor_id);
    const nombreProv = provObj ? provObj.nombre.toLowerCase() : '';

    const catObj = categorias.find(c => c.id === p.categoria_id);
    const nombreCat = catObj ? catObj.nombre : '';

    // 2. Comprobar si el producto o el proveedor coinciden con el texto de búsqueda
    const matchQ = p.nombre.toLowerCase().includes(q) || nombreProv.includes(q);
    
    // 3. Comprobar si coincide con el filtro de categoría
    const matchCat = !cat || nombreCat === cat || p.categoria_id === cat;
    
    return matchQ && matchCat;
  });

  if (filtered.length === 0) {
    tbl.innerHTML = `<tr><td colspan="7"><div class="empty"><div class="empty-icon">📦</div><div class="empty-text">No se encontraron productos</div></div></td></tr>`;
    return;
  }

  tbl.innerHTML = filtered.map(p => {
    const s = getStatus(p);
    
    // Buscar la información completa para pintar en la tabla
    const prov = proveedores.find(v => v.id === p.proveedor_id);
    const catObj = categorias.find(c => c.id === p.categoria_id);
    
    // Asignar variables de texto (por si un producto no tiene proveedor o categoría)
    const nombreCategoria = catObj ? catObj.nombre : 'Desconocida';
    const nombreProveedor = prov ? prov.nombre : '<span style="color:var(--muted)">—</span>';

    return `<tr>
      <td><strong>${p.nombre}</strong></td>
      <td><span class="badge badge-cat">${nombreCategoria}</span></td>
      <td>${p.cantidad}</td>
      <td>$${parseFloat(p.precio).toFixed(2)}</td>
      <td>${nombreProveedor}</td>
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

  // Inyectar lista de proveedores
  const selProv = document.getElementById('inp-prov');
  selProv.innerHTML = '<option value="">-- Sin proveedor --</option>' +
    proveedores.map(v => `<option value="${v.id}">${v.nombre}</option>`).join('');

    //Inyectar lista de categorias
  const selCat = document.getElementById('inp-cat');
  selCat.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

  if (id) {
    const p = productos.find(x => x.id === id);
    document.getElementById('modal-producto-title').textContent = 'Editar Producto';
    document.getElementById('inp-nombre').value = p.nombre;

    //nombres de columna de la base de datos
    document.getElementById('inp-cat').value = p.categoria_id;
    document.getElementById('inp-cantidad').value = p.cantidad;
    document.getElementById('inp-precio').value = p.precio;
    document.getElementById('inp-minimo').value = p.minimo || 5;
    document.getElementById('inp-prov').value = p.proveedor_id || '';
  } else {
    document.getElementById('modal-producto-title').textContent = 'Agregar Producto';
    ['inp-nombre','inp-cantidad','inp-precio','inp-minimo'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('inp-cat').value = 'Lácteos';
    document.getElementById('inp-prov').value = '';

    if(categorias.length > 0){
      document.getElementById('inp-cat').value = categorias[0].id;
    } 
  }
  modal.classList.add('open');
}

function closeModal() { document.getElementById('modal-producto').classList.remove('open'); editingId = null; }

async function guardarProveedor(){
  const nombre = document.getElementById('pinp-nombre').value.trim();
  const telefono = document.getElementById('pinp-tel').value.trim();

  if(!nombre || !telefono){
    toast('El nombre y el telefono son requeridos', true);
    return;
  }
  
  try{
    if(editingProvId){
      const { error } = await supabaseClient
      .from('proveedores')
      .update({ nombre, telefono })
      .eq('id', editingProvId);

      if (error) throw error;
      toast('Proveedor actualizado ✓');

    } else {
      const { error } = await supabaseClient
        .from('proveedores')
        .insert([{ nombre: nombre, telefono: telefono }]);
      
      if (error) throw error;
      toast('Proveedor agregado ✓');
    }

    closeProvModal();
    await cargarDatosNube(); // Esto reemplaza tu vieja función save() y renderProveedores()

  } catch (error) {
    toast('Error al guardar el proveedor', true);
  }
}

async function guardarProducto() {
  const nombre = document.getElementById('inp-nombre').value.trim();
  const cantidad = parseInt(document.getElementById('inp-cantidad').value);
  const precio = parseFloat(document.getElementById('inp-precio').value);
  const minimo = parseInt(document.getElementById('inp-minimo').value) || 5;

  const categoria = document.getElementById('inp-cat').value;
  const proveedorId = document.getElementById('inp-prov').value || null;


  if (!nombre || isNaN(cantidad) || isNaN(precio)) {
    toast('Por favor llena todos los campos requeridos', true); return;
  }
try {   
   if (editingId) {
      const { error } = await supabaseClient
        .from('productos')
        .update({ nombre, cantidad, precio, categoria_id: categoria, proveedor_id: proveedorId, minimo })
        .eq('id', editingId);
        await registrarMovimiento('Actualización', `Se modificó el producto: ${nombre}.`);
      if (error) throw error;
      toast('Producto actualizado ✓');
    } else {
      const { error } = await supabaseClient
        .from('productos')
        .insert([{ 
          id: crypto.randomUUID(), // <--- EL FIX ESTÁ AQUÍ
          nombre, 
          cantidad, 
          precio, 
          categoria_id: categoria, 
          proveedor_id: proveedorId, 
          minimo 
        }]);
        await registrarMovimiento('Entrada', `Se agregó el producto nuevo: ${nombre} (${cantidad} unidades).`);

      if (error) throw error;
      toast('Producto agregado ✓');
    }

    closeModal();
    await cargarDatosNube(); // Esto reemplaza tu vieja función save() y renderInventario()
  } catch (error) {
    alert("ERROR DE SUPABASE: \n" + error.message + "\n\nDETALLES: " + error.details);
    toast('Error al guardar el producto', true);
  }
}


function editProducto(id) { navigate('inventario'); openModal(id); }

async function deleteProducto(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  try {
    const { error } = await supabaseClient
      .from('productos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    toast('Producto eliminado');
    await cargarDatosNube();
  } catch (error) {
    console.error('Error al eliminar el producto:', error);
    toast('Error al eliminar el producto', true);
  }
}

// ── PROVEEDORES ───────────────────────────────────────
function renderProveedores() {
  const q = document.getElementById('search-prov').value.toLowerCase();
  const tbl = document.getElementById('prov-table');
  const filtered = proveedores.filter(v => v.nombre.toLowerCase().includes(q));

  if (filtered.length === 0) {
    tbl.innerHTML = `<tr><td colspan="4"><div class="empty"><div class="empty-icon">🏭</div><div class="empty-text">No se encontraron proveedores</div></div></td></tr>`;
    return;
  }

  tbl.innerHTML = filtered.map(v => {
    const count = productos.filter(p => p.proveedor_id === v.id).length;
    return `<tr>
      <td><strong>${v.nombre}</strong></td>
      <td>${v.telefono || '—'}</td>
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
  } else {
    document.getElementById('modal-prov-title').textContent = 'Agregar Proveedor';
    document.getElementById('pinp-nombre').value = '';
    document.getElementById('pinp-tel').value = '';
  }
  document.getElementById('modal-proveedor').classList.add('open');
}

function closeProvModal() { document.getElementById('modal-proveedor').classList.remove('open'); editingProvId = null; }


function editProveedor(id) { openProvModal(id); }

async function deleteProveedor(id) {
  if (!confirm('¿Eliminar este proveedor?')) return;
  try {
    const { error } = await supabaseClient
      .from('proveedores')
      .delete()
      .eq('id', id);

    if (error) throw error;
    toast('Proveedor eliminado ✓');
    await cargarDatosNube();
  } catch (error) {
    toast('Error al eliminar el proveedor', true);
  }
}

// Close modals on overlay click
document.getElementById('modal-producto').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.getElementById('modal-proveedor').addEventListener('click', e => { if (e.target === e.currentTarget) closeProvModal(); });

document.addEventListener('DOMContentLoaded', () => {
  cargarDatosNube();
});

// ── MENÚ HAMBURGUESA MÓVIL ─────────────────────────────
function toggleMenu() {
  document.getElementById('nav-menu').classList.toggle('active');
}

let graficaCategorias = null;

function renderGrafica() {
  const ctx = document.getElementById('grafica-categorias').getContext('2d');

  // Agrupar stock por categoría
  const datos = {};
  productos.forEach(p => {
    const cat = categorias.find(c => c.id === p.categoria_id);
    const nombre = cat ? cat.nombre : 'Sin categoría';
    datos[nombre] = (datos[nombre] || 0) + p.cantidad;
  });

  const labels = Object.keys(datos);
  const values = Object.values(datos);

  // Si ya existe la gráfica, destruirla antes de redibujar
  if (graficaCategorias) graficaCategorias.destroy();

  graficaCategorias = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Unidades en stock',
        data: values,
        backgroundColor: '#2563eb',
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#e2e8f0' },
          ticks: { color: '#64748b' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#64748b' }
        }
      }
    }
  });
}

function exportarCSV() {
  if (productos.length === 0) {
    toast('No hay productos para exportar', true);
    return;
  }

  const encabezado = ['Nombre', 'Categoría', 'Cantidad', 'Precio', 'Stock Mínimo', 'Proveedor', 'Estado'];

  const filas = productos.map(p => {
    const cat = categorias.find(c => c.id === p.categoria_id);
    const prov = proveedores.find(v => v.id === p.proveedor_id);
    const estado = p.cantidad === 0 ? 'Sin stock' : p.cantidad <= (p.minimo || 5) ? 'Stock bajo' : 'Disponible';

    return [
      p.nombre,
      cat ? cat.nombre : '—',
      p.cantidad,
      p.precio,
      p.minimo || 5,
      prov ? prov.nombre : '—',
      estado
    ];
  });

  const csv = [encabezado, ...filas]
    .map(fila => fila.map(celda => `"${celda}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `stockmart_${new Date().toLocaleDateString('es-MX').replace(/\//g, '-')}.csv`;
  link.click();
  URL.revokeObjectURL(url);

  toast('Inventario exportado ✓');
}

async function registrarMovimiento(accion, descripcion) {
  try {
    await supabaseClient.from('historial').insert([{ accion, descripcion }]);
  } catch (error) {
    console.error('Error al guardar historial:', error);
  }
}

async function renderHistorial() {
  const tbody = document.getElementById('historial-table');
  
  const { data, error } = await supabaseClient
    .from('historial')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(50); // Muestra los últimos 50 movimientos

  if (error) {
    tbody.innerHTML = `<tr><td colspan="3">Error al cargar historial</td></tr>`;
    return;
  }

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">No hay movimientos registrados</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(mov => {
    // Formatear la fecha para que se vea bonita
    const fecha = new Date(mov.fecha).toLocaleString('es-MX', { 
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' 
    });
    
    // Ponerle color a la acción
    let colorAccion = 'var(--text)';
    if(mov.accion === 'Entrada') colorAccion = 'var(--accent)';
    if(mov.accion === 'Salida' || mov.accion === 'Eliminación') colorAccion = 'var(--danger)';
    if(mov.accion === 'Actualización') colorAccion = 'var(--warn)';

    return `
      <tr>
        <td style="color: var(--muted); font-size: 0.9em;">${fecha}</td>
        <td style="color: ${colorAccion}; font-weight: bold;">${mov.accion}</td>
        <td>${mov.descripcion}</td>
      </tr>
    `;
  }).join('');
}

