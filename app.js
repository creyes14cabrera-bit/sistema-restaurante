/* ============================================================
   Sistema Restaurante — todo en el navegador (localStorage)
   ============================================================ */

const KEY = 'restaurante_v1';
const ESTADOS = ['nuevo', 'pendiente', 'preparando', 'listo', 'entregado'];
const METODOS = ['Efectivo', 'Tarjeta', 'Transferencia', 'Nequi / Daviplata'];
const MINUTOS_ALERTA = 20;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmt = (n) => '$' + Math.round(n || 0).toLocaleString('es-CO');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ymd = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const hora = (d) => new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
const minutosDesde = (d) => Math.floor((Date.now() - new Date(d)) / 60000);
const etiquetaMesa = (m) => (m.startsWith('L') ? `Para llevar #${m.slice(1)}` : `Mesa ${m}`);

/* ---------------- Datos ---------------- */

function datosIniciales() {
  const cats = [
    { id: 'c1', nombre: 'Entradas', cocina: true },
    { id: 'c2', nombre: 'Platos fuertes', cocina: true },
    { id: 'c3', nombre: 'Comidas rápidas', cocina: true },
    { id: 'c4', nombre: 'Bebidas', cocina: false },
    { id: 'c5', nombre: 'Postres', cocina: true },
  ];
  const p = (nombre, categoria, precio) => ({ id: uid(), nombre, categoria, precio, activo: true });
  return {
    config: {
      nombre: 'Mi Restaurante', nit: '', direccion: '', telefono: '',
      mesas: 12, propina: 10, mensaje: '¡Gracias por su visita!',
    },
    categorias: cats,
    productos: [
      p('Empanadas x3', 'c1', 9000), p('Patacones con hogao', 'c1', 12000), p('Arepa con queso', 'c1', 7000),
      p('Bandeja paisa', 'c2', 32000), p('Ajiaco santafereño', 'c2', 28000), p('Pechuga a la plancha', 'c2', 26000),
      p('Churrasco', 'c2', 38000), p('Mojarra frita', 'c2', 34000),
      p('Hamburguesa de la casa', 'c3', 22000), p('Salchipapa', 'c3', 16000),
      p('Limonada natural', 'c4', 6000), p('Limonada de coco', 'c4', 10000), p('Jugo natural', 'c4', 7000),
      p('Gaseosa', 'c4', 5000), p('Cerveza', 'c4', 7000), p('Agua', 'c4', 4000),
      p('Torta tres leches', 'c5', 9000), p('Brownie con helado', 'c5', 11000),
    ],
    pedidos: [],
    ventas: [],
    seqVenta: 0,
    seqLlevar: 0,
    seqComanda: 0,
  };
}

function cargar() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.productos)) return s;
  } catch (e) { /* datos corruptos: se reinicia */ }
  return datosIniciales();
}

let state = cargar();
const guardar = () => localStorage.setItem(KEY, JSON.stringify(state));

const categoria = (id) => state.categorias.find((c) => c.id === id);
const pedidoDeMesa = (m) => state.pedidos.find((p) => p.mesa === m);
const subtotal = (items) => items.reduce((s, i) => s + i.precio * i.cant, 0);

/* ---------------- UI utilidades ---------------- */

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2200);
}

function abrirModal(titulo, html, alMontar) {
  $('#modalTitulo').textContent = titulo;
  $('#modalCuerpo').innerHTML = html;
  $('#modal').hidden = false;
  alMontar?.($('#modalCuerpo'));
  $('#modalCuerpo').querySelector('input:not([type=hidden]), select')?.focus();
}
const cerrarModal = () => ($('#modal').hidden = true);
$('#modalCerrar').onclick = cerrarModal;
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') cerrarModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModal(); });

/* ---------------- Navegación ---------------- */

let vistaActual = 'mesas';
let mesaActual = null;
let categoriaFiltro = 'todas';

function irA(vista) {
  vistaActual = vista;
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${vista}`));
  const tab = vista === 'pedido' ? 'mesas' : vista;
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === tab));
  render();
  window.scrollTo(0, 0);
}
$$('.tab').forEach((t) => (t.onclick = () => irA(t.dataset.view)));

function render() {
  $('#nombreRestaurante').textContent = state.config.nombre;
  document.title = `${state.config.nombre} · Sistema`;
  renderBadgeCocina();
  ({ mesas: renderMesas, pedido: renderPedido, cocina: renderCocina, menu: renderMenu, ventas: renderVentas, config: renderConfig })[vistaActual]();
}

/* ---------------- Mesas ---------------- */

function estadoMesa(p) {
  if (!p || p.items.length === 0) return 'libre';
  return p.items.some((i) => i.estado === 'listo') ? 'listo' : 'ocupada';
}

function tarjetaMesa(m) {
  const p = pedidoDeMesa(m);
  const est = estadoMesa(p);
  const textos = { libre: 'Libre', ocupada: 'Ocupada', listo: '🔔 Pedido listo' };
  const info = p && p.items.length
    ? `${fmt(subtotal(p.items))} · ${minutosDesde(p.creado)} min${p.mesero ? ' · ' + esc(p.mesero) : ''}`
    : '';
  const nombre = m.startsWith('L') ? `🛍️ #${m.slice(1)}` : m;
  return `<button class="mesa ${est} ${m.startsWith('L') ? 'llevar' : ''}" data-mesa="${m}">
    <span class="n">${nombre}</span>
    <span class="estado">${textos[est]}</span>
    <span class="info">${info}</span>
  </button>`;
}

function renderMesas() {
  const mesas = Array.from({ length: state.config.mesas }, (_, i) => String(i + 1));
  const llevar = state.pedidos.filter((p) => p.mesa.startsWith('L')).map((p) => p.mesa);
  $('#mesasGrid').innerHTML =
    mesas.map(tarjetaMesa).join('') +
    llevar.map(tarjetaMesa).join('') +
    `<button class="mesa llevar" id="btnNuevoLlevar"><span class="n">＋</span><span class="estado">Pedido para llevar</span></button>`;
  $$('#mesasGrid .mesa[data-mesa]').forEach((b) => (b.onclick = () => abrirMesa(b.dataset.mesa)));
  $('#btnNuevoLlevar').onclick = () => {
    state.seqLlevar += 1;
    const mesa = 'L' + state.seqLlevar;
    state.pedidos.push({ id: uid(), mesa, mesero: '', personas: 1, items: [], creado: new Date().toISOString() });
    guardar();
    abrirMesa(mesa);
  };
}

function abrirMesa(m) {
  mesaActual = m;
  $('#buscarProducto').value = '';
  irA('pedido');
}

/* ---------------- Pedido ---------------- */

function obtenerOCrearPedido() {
  let p = pedidoDeMesa(mesaActual);
  if (!p) {
    p = { id: uid(), mesa: mesaActual, mesero: $('#inputMesero').value.trim(), personas: +$('#inputPersonas').value || 1, items: [], creado: new Date().toISOString() };
    state.pedidos.push(p);
  }
  return p;
}

function limpiarPedidoVacio() {
  const p = pedidoDeMesa(mesaActual);
  if (p && p.items.length === 0 && !p.mesa.startsWith('L')) {
    state.pedidos = state.pedidos.filter((x) => x !== p);
  }
}

function renderPedido() {
  const p = pedidoDeMesa(mesaActual);
  $('#tituloPedido').textContent = etiquetaMesa(mesaActual) + (p ? ` · abierta ${hora(p.creado)}` : '');
  $('#inputMesero').value = p?.mesero || '';
  $('#inputPersonas').value = p?.personas || 1;

  // Categorías
  const cats = [{ id: 'todas', nombre: 'Todo' }, ...state.categorias];
  $('#chipsCategorias').innerHTML = cats
    .map((c) => `<button class="chip ${categoriaFiltro === c.id ? 'active' : ''}" data-cat="${c.id}">${esc(c.nombre)}</button>`)
    .join('');
  $$('#chipsCategorias .chip').forEach((b) => (b.onclick = () => { categoriaFiltro = b.dataset.cat; renderPedido(); }));

  renderCatalogo();
  renderItems();
}

function renderCatalogo() {
  const q = $('#buscarProducto').value.trim().toLowerCase();
  const lista = state.productos.filter((x) =>
    x.activo &&
    (categoriaFiltro === 'todas' || x.categoria === categoriaFiltro) &&
    (!q || x.nombre.toLowerCase().includes(q)));
  $('#productosGrid').innerHTML = lista.length
    ? lista.map((x) => `<button class="producto" data-id="${x.id}">
        <span class="nombre">${esc(x.nombre)}</span>
        <span class="muted">${esc(categoria(x.categoria)?.nombre || '')}</span>
        <span class="precio">${fmt(x.precio)}</span>
      </button>`).join('')
    : `<p class="muted">No hay productos que coincidan.</p>`;
  $$('#productosGrid .producto').forEach((b) => (b.onclick = () => agregarProducto(b.dataset.id)));
}
$('#buscarProducto').addEventListener('input', renderCatalogo);

function agregarProducto(pid) {
  const prod = state.productos.find((x) => x.id === pid);
  const p = obtenerOCrearPedido();
  const existente = p.items.find((i) => i.pid === pid && i.estado === 'nuevo' && !i.nota);
  if (existente) existente.cant += 1;
  else p.items.push({ id: uid(), pid, nombre: prod.nombre, precio: prod.precio, cant: 1, nota: '', estado: 'nuevo' });
  guardar();
  renderItems();
  $('#tituloPedido').textContent = etiquetaMesa(mesaActual) + ` · abierta ${hora(p.creado)}`;
}

function renderItems() {
  const p = pedidoDeMesa(mesaActual);
  const items = p?.items || [];
  $('#listaItems').innerHTML = items.length
    ? items.map((i) => {
        const editable = i.estado === 'nuevo';
        return `<li class="item" data-id="${i.id}">
          <div class="top">
            <span class="nombre">${esc(i.nombre)}</span>
            <span class="estado-tag ${i.estado}" ${i.estado === 'listo' ? 'role="button" title="Marcar como entregado" style="cursor:pointer"' : ''}>${i.estado === 'nuevo' ? 'sin enviar' : i.estado}</span>
          </div>
          <span class="sub">${fmt(i.precio * i.cant)}</span>
          <div class="controles">
            ${editable
              ? `<button data-acc="menos">−</button><strong>${i.cant}</strong><button data-acc="mas">+</button>
                 <button data-acc="nota" title="Agregar nota">✎</button>`
              : `<strong>${i.cant} ×</strong> <span class="muted">${fmt(i.precio)}</span>`}
            <button data-acc="quitar" title="Quitar">🗑</button>
          </div>
          ${i.nota ? `<div class="nota">📝 ${esc(i.nota)}</div>` : ''}
        </li>`;
      }).join('')
    : `<li class="vacio">Toca un producto para agregarlo</li>`;

  const nuevos = items.filter((i) => i.estado === 'nuevo').length;
  $('#subtotalPedido').textContent = fmt(subtotal(items));
  $('#btnEnviarCocina').disabled = nuevos === 0;
  $('#btnEnviarCocina').textContent = nuevos ? `Enviar a cocina (${nuevos})` : 'Enviar a cocina';
  $('#btnCobrar').disabled = items.length === 0;
  $('#btnCancelarPedido').disabled = !p;
  $('#btnMoverMesa').disabled = !p || items.length === 0 || mesaActual.startsWith('L');

  $$('#listaItems .item').forEach((li) => {
    const item = items.find((i) => i.id === li.dataset.id);
    li.querySelectorAll('[data-acc]').forEach((b) => (b.onclick = () => accionItem(p, item, b.dataset.acc)));
    const tag = li.querySelector('.estado-tag.listo');
    if (tag) tag.onclick = () => { item.estado = 'entregado'; guardar(); renderItems(); };
  });
}

function accionItem(p, item, acc) {
  if (acc === 'mas') item.cant += 1;
  if (acc === 'menos') item.cant -= 1;
  if (acc === 'quitar') {
    if (item.estado !== 'nuevo' && !confirm(`"${item.nombre}" ya fue enviado a cocina. ¿Anularlo de todas formas?`)) return;
    item.cant = 0;
  }
  if (acc === 'nota') {
    abrirModal(`Nota para ${item.nombre}`,
      `<form class="form" id="formNota">
        <label>Indicaciones <input name="nota" value="${esc(item.nota)}" placeholder="Ej: sin cebolla, término medio..." /></label>
        <button class="btn primary">Guardar</button>
      </form>`,
      (c) => c.querySelector('form').onsubmit = (e) => {
        e.preventDefault();
        item.nota = e.target.nota.value.trim();
        guardar(); cerrarModal(); renderItems();
      });
    return;
  }
  if (item.cant <= 0) p.items = p.items.filter((i) => i !== item);
  guardar();
  renderItems();
}

$('#inputMesero').addEventListener('change', (e) => {
  const p = pedidoDeMesa(mesaActual);
  if (p) { p.mesero = e.target.value.trim(); guardar(); }
});
$('#inputPersonas').addEventListener('change', (e) => {
  const p = pedidoDeMesa(mesaActual);
  if (p) { p.personas = Math.max(1, +e.target.value || 1); guardar(); }
});

$('#btnVolverMesas').onclick = () => { limpiarPedidoVacio(); guardar(); irA('mesas'); };

$('#btnEnviarCocina').onclick = () => {
  const p = pedidoDeMesa(mesaActual);
  const nuevos = p.items.filter((i) => i.estado === 'nuevo');
  if (!nuevos.length) return;
  state.seqComanda += 1;
  const ahora = new Date().toISOString();
  let aCocina = 0;
  nuevos.forEach((i) => {
    const prod = state.productos.find((x) => x.id === i.pid);
    const vaACocina = categoria(prod?.categoria)?.cocina !== false;
    i.estado = vaACocina ? 'pendiente' : 'entregado';
    i.comanda = state.seqComanda;
    i.enviado = ahora;
    if (vaACocina) aCocina++;
  });
  guardar();
  renderItems();
  toast(aCocina ? `Comanda #${state.seqComanda} enviada a cocina` : 'Bebidas registradas como entregadas');
};

$('#btnCancelarPedido').onclick = () => {
  const p = pedidoDeMesa(mesaActual);
  if (!p) return;
  if (p.items.length && !confirm(`¿Anular todo el pedido de ${etiquetaMesa(p.mesa)}? Esta acción no se puede deshacer.`)) return;
  state.pedidos = state.pedidos.filter((x) => x !== p);
  guardar();
  toast('Pedido anulado');
  irA('mesas');
};

$('#btnMoverMesa').onclick = () => {
  const p = pedidoDeMesa(mesaActual);
  const mesas = Array.from({ length: state.config.mesas }, (_, i) => String(i + 1));
  abrirModal(`Mover ${etiquetaMesa(p.mesa)} a…`,
    `<div class="mesas-mini">${mesas.map((m) => {
      const ocupada = pedidoDeMesa(m)?.items.length;
      return `<button data-m="${m}" ${ocupada || m === p.mesa ? 'disabled' : ''}>${m}</button>`;
    }).join('')}</div>`,
    (c) => c.querySelectorAll('button[data-m]').forEach((b) => (b.onclick = () => {
      state.pedidos = state.pedidos.filter((x) => x === p || x.mesa !== b.dataset.m); // quita pedido vacío si existía
      p.mesa = b.dataset.m;
      mesaActual = p.mesa;
      guardar(); cerrarModal(); renderPedido();
      toast(`Pedido movido a ${etiquetaMesa(p.mesa)}`);
    })));
};

/* ---------------- Cobro ---------------- */

$('#btnCobrar').onclick = () => {
  const p = pedidoDeMesa(mesaActual);
  const sinEnviar = p.items.filter((i) => i.estado === 'nuevo').length;
  if (sinEnviar && !confirm(`Hay ${sinEnviar} producto(s) sin enviar a cocina. ¿Cobrar de todas formas?`)) return;
  abrirCobro(p);
};

function abrirCobro(p) {
  const sub = subtotal(p.items);
  let metodo = METODOS[0];
  abrirModal(`Cobrar ${etiquetaMesa(p.mesa)}`,
    `<div class="fila"><span>Subtotal</span><strong>${fmt(sub)}</strong></div>
     <div class="fila"><label class="inline"><input type="checkbox" id="chkPropina" ${state.config.propina > 0 ? 'checked' : ''}/> Propina
       <input type="number" id="pctPropina" min="0" max="100" value="${state.config.propina}" style="width:70px"/> %</label>
       <strong id="valPropina"></strong></div>
     <div class="fila"><label class="inline">Descuento $ <input type="number" id="valDescuento" min="0" value="0" style="width:110px"/></label>
       <strong id="txtDescuento"></strong></div>
     <div class="fila total"><span>Total</span><span id="valTotal"></span></div>
     ${p.personas > 1 ? `<p class="muted" id="porPersona"></p>` : ''}
     <h3 style="margin-top:14px">Método de pago</h3>
     <div class="metodos">${METODOS.map((m, i) => `<button class="metodo ${i === 0 ? 'active' : ''}" data-m="${m}">${m}</button>`).join('')}</div>
     <div id="bloqueEfectivo" style="margin-top:12px">
       <label class="muted">Recibido <input type="number" id="valRecibido" min="0" placeholder="Monto entregado por el cliente"/></label>
       <div class="cambio" id="txtCambio" style="margin-top:8px" hidden></div>
     </div>
     <div class="cuenta-acciones" style="margin-top:16px">
       <button class="btn ghost" id="btnPrecuenta">🖨 Precuenta</button>
       <button class="btn success" id="btnConfirmarCobro">Confirmar pago</button>
     </div>`,
    (c) => {
      const calc = () => {
        const propina = c.querySelector('#chkPropina').checked ? Math.round(sub * (+c.querySelector('#pctPropina').value || 0) / 100) : 0;
        const descuento = Math.min(sub, Math.max(0, +c.querySelector('#valDescuento').value || 0));
        const total = sub + propina - descuento;
        const recibido = +c.querySelector('#valRecibido').value || 0;
        c.querySelector('#valPropina').textContent = fmt(propina);
        c.querySelector('#txtDescuento').textContent = descuento ? '−' + fmt(descuento) : '';
        c.querySelector('#valTotal').textContent = fmt(total);
        const pp = c.querySelector('#porPersona');
        if (pp) pp.textContent = `Dividido entre ${p.personas} personas: ${fmt(total / p.personas)} c/u`;
        c.querySelector('#bloqueEfectivo').hidden = metodo !== 'Efectivo';
        const cambio = c.querySelector('#txtCambio');
        cambio.hidden = !recibido || metodo !== 'Efectivo';
        cambio.classList.toggle('falta', recibido < total);
        cambio.textContent = recibido >= total ? `Cambio: ${fmt(recibido - total)}` : `Faltan ${fmt(total - recibido)}`;
        return { propina, descuento, total, recibido };
      };
      c.querySelectorAll('input').forEach((i) => i.addEventListener('input', calc));
      c.querySelectorAll('.metodo').forEach((b) => (b.onclick = () => {
        metodo = b.dataset.m;
        c.querySelectorAll('.metodo').forEach((x) => x.classList.toggle('active', x === b));
        calc();
      }));
      calc();

      c.querySelector('#btnPrecuenta').onclick = () => {
        const v = calc();
        imprimirRecibo({ ...v, subtotal: sub, mesa: p.mesa, mesero: p.mesero, items: p.items, fecha: new Date().toISOString(), precuenta: true });
      };
      c.querySelector('#btnConfirmarCobro').onclick = () => {
        const v = calc();
        if (metodo === 'Efectivo' && v.recibido && v.recibido < v.total) return toast('El monto recibido es menor al total');
        state.seqVenta += 1;
        const venta = {
          id: uid(), numero: state.seqVenta, fecha: new Date().toISOString(),
          mesa: p.mesa, mesero: p.mesero, personas: p.personas,
          items: p.items.map(({ pid, nombre, precio, cant }) => ({ pid, nombre, precio, cant })),
          subtotal: sub, propina: v.propina, descuento: v.descuento, total: v.total,
          metodo, recibido: metodo === 'Efectivo' ? v.recibido || v.total : v.total,
          cambio: metodo === 'Efectivo' && v.recibido ? v.recibido - v.total : 0,
          anulada: false,
        };
        state.ventas.push(venta);
        state.pedidos = state.pedidos.filter((x) => x !== p);
        guardar();
        cerrarModal();
        toast(`Cuenta #${venta.numero} cobrada · ${fmt(venta.total)}`);
        if (confirm('¿Imprimir recibo?')) imprimirRecibo(venta);
        irA('mesas');
      };
    });
}

function imprimirRecibo(v) {
  const c = state.config;
  const agrupados = {};
  v.items.forEach((i) => {
    const k = i.nombre + '|' + i.precio;
    agrupados[k] = agrupados[k] || { ...i, cant: 0 };
    agrupados[k].cant += i.cant;
  });
  $('#recibo').innerHTML = `
    <h4>${esc(c.nombre)}</h4>
    ${c.nit ? `<div class="c">NIT ${esc(c.nit)}</div>` : ''}
    ${c.direccion ? `<div class="c">${esc(c.direccion)}</div>` : ''}
    ${c.telefono ? `<div class="c">Tel. ${esc(c.telefono)}</div>` : ''}
    <hr/>
    <div>${v.precuenta ? '<strong>PRECUENTA — NO ES FACTURA</strong>' : `Recibo #${v.numero}`}</div>
    <div>${new Date(v.fecha).toLocaleString('es-CO')}</div>
    <div>${etiquetaMesa(v.mesa)}${v.mesero ? ' · Mesero: ' + esc(v.mesero) : ''}</div>
    <hr/>
    ${Object.values(agrupados).map((i) => `<div class="l"><span>${i.cant} ${esc(i.nombre)}</span><span>${fmt(i.precio * i.cant)}</span></div>`).join('')}
    <hr/>
    <div class="l"><span>Subtotal</span><span>${fmt(v.subtotal)}</span></div>
    ${v.propina ? `<div class="l"><span>Propina (voluntaria)</span><span>${fmt(v.propina)}</span></div>` : ''}
    ${v.descuento ? `<div class="l"><span>Descuento</span><span>-${fmt(v.descuento)}</span></div>` : ''}
    <div class="l"><strong>TOTAL</strong><strong>${fmt(v.total)}</strong></div>
    ${v.metodo ? `<div class="l"><span>${esc(v.metodo)}</span><span>${fmt(v.recibido)}</span></div>` : ''}
    ${v.cambio ? `<div class="l"><span>Cambio</span><span>${fmt(v.cambio)}</span></div>` : ''}
    <hr/>
    <div class="c">${esc(c.mensaje || '')}</div>`;
  setTimeout(() => window.print(), 50);
}

/* ---------------- Cocina ---------------- */

function comandasActivas() {
  const grupos = {};
  state.pedidos.forEach((p) => p.items.forEach((i) => {
    if (!['pendiente', 'preparando', 'listo'].includes(i.estado)) return;
    const k = p.id + '#' + i.comanda;
    grupos[k] = grupos[k] || { key: k, numero: i.comanda, pedido: p, enviado: i.enviado, items: [] };
    grupos[k].items.push(i);
  }));
  return Object.values(grupos).map((g) => {
    const idx = Math.min(...g.items.map((i) => ESTADOS.indexOf(i.estado)));
    return { ...g, estado: ESTADOS[idx] };
  }).sort((a, b) => a.enviado.localeCompare(b.enviado));
}

function renderBadgeCocina() {
  const n = comandasActivas().filter((c) => c.estado !== 'listo').length;
  $('#badgeCocina').hidden = n === 0;
  $('#badgeCocina').textContent = n;
}

function renderCocina() {
  const comandas = comandasActivas();
  const siguiente = { pendiente: ['preparando', '🔥 Preparar'], preparando: ['listo', '✅ Listo'], listo: ['entregado', '🍽 Entregado'] };
  $('#comandasGrid').innerHTML = comandas.length
    ? comandas.map((c) => {
        const min = minutosDesde(c.enviado);
        const [, texto] = siguiente[c.estado];
        return `<article class="comanda ${c.estado}">
          <div class="comanda-head">
            <div><strong>${etiquetaMesa(c.pedido.mesa)}</strong><div class="muted">Comanda #${c.numero}${c.pedido.mesero ? ' · ' + esc(c.pedido.mesero) : ''}</div></div>
            <span class="tiempo ${min >= MINUTOS_ALERTA && c.estado !== 'listo' ? 'tarde' : ''}">⏱ ${min} min</span>
          </div>
          <ul>${c.items.map((i) => `<li><span class="cant">${i.cant}×</span>${esc(i.nombre)}
            ${i.estado !== c.estado ? `<span class="estado-tag ${i.estado}">${i.estado}</span>` : ''}
            ${i.nota ? `<span class="nota">⚠ ${esc(i.nota)}</span>` : ''}</li>`).join('')}</ul>
          <div class="comanda-foot">
            <span class="estado-tag ${c.estado}" style="align-self:center">${c.estado}</span>
            <button class="btn ${c.estado === 'listo' ? 'success' : 'primary'}" data-k="${c.key}">${texto}</button>
          </div>
        </article>`;
      }).join('')
    : `<div class="vacio-grande">👨‍🍳<br/>No hay comandas pendientes</div>`;

  $$('#comandasGrid [data-k]').forEach((b) => (b.onclick = () => {
    const c = comandas.find((x) => x.key === b.dataset.k);
    const [nuevo] = siguiente[c.estado];
    c.items.forEach((i) => { if (i.estado === c.estado) i.estado = nuevo; });
    guardar();
    renderCocina();
    renderBadgeCocina();
  }));
}

/* ---------------- Menú ---------------- */

function renderMenu() {
  const filas = state.categorias.map((c) => {
    const prods = state.productos.filter((p) => p.categoria === c.id);
    return `<tr class="cat-row"><td colspan="4">${esc(c.nombre)} ${c.cocina ? '' : '<span class="muted">(no pasa por cocina)</span>'}</td>
      <td><div class="acciones-fila"><button class="btn ghost sm" data-editcat="${c.id}">Editar</button></div></td></tr>` +
      (prods.length ? prods.map((p) => `<tr>
        <td>${esc(p.nombre)}</td>
        <td class="muted">${esc(c.nombre)}</td>
        <td class="num">${fmt(p.precio)}</td>
        <td><label class="switch"><input type="checkbox" data-toggle="${p.id}" ${p.activo ? 'checked' : ''}/><span></span></label></td>
        <td><div class="acciones-fila">
          <button class="btn ghost sm" data-edit="${p.id}">Editar</button>
          <button class="btn danger ghost sm" data-del="${p.id}">Eliminar</button>
        </div></td></tr>`).join('')
        : `<tr><td colspan="5" class="muted">Sin productos en esta categoría</td></tr>`);
  }).join('');
  $('#tablaMenu').innerHTML = filas || `<tr><td colspan="5" class="muted">Crea una categoría para empezar</td></tr>`;

  $$('[data-toggle]').forEach((i) => (i.onchange = () => {
    state.productos.find((p) => p.id === i.dataset.toggle).activo = i.checked;
    guardar();
    toast(i.checked ? 'Producto disponible' : 'Producto marcado como agotado');
  }));
  $$('[data-edit]').forEach((b) => (b.onclick = () => formProducto(state.productos.find((p) => p.id === b.dataset.edit))));
  $$('[data-del]').forEach((b) => (b.onclick = () => {
    const p = state.productos.find((x) => x.id === b.dataset.del);
    if (!confirm(`¿Eliminar "${p.nombre}" del menú?`)) return;
    state.productos = state.productos.filter((x) => x !== p);
    guardar(); renderMenu();
  }));
  $$('[data-editcat]').forEach((b) => (b.onclick = () => formCategoria(categoria(b.dataset.editcat))));
}

function formProducto(prod) {
  if (!state.categorias.length) return toast('Primero crea una categoría');
  abrirModal(prod ? 'Editar producto' : 'Nuevo producto',
    `<form class="form">
      <label>Nombre <input name="nombre" required value="${esc(prod?.nombre || '')}" /></label>
      <label>Categoría <select name="categoria">${state.categorias.map((c) =>
        `<option value="${c.id}" ${prod?.categoria === c.id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>
      <label>Precio <input name="precio" type="number" min="0" step="100" required value="${prod?.precio ?? ''}" /></label>
      <button class="btn primary">Guardar</button>
    </form>`,
    (c) => c.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      const datos = { nombre: f.nombre.value.trim(), categoria: f.categoria.value, precio: +f.precio.value };
      if (prod) Object.assign(prod, datos);
      else state.productos.push({ id: uid(), activo: true, ...datos });
      guardar(); cerrarModal(); renderMenu();
      toast('Producto guardado');
    });
}

function formCategoria(cat) {
  const enUso = cat && state.productos.some((p) => p.categoria === cat.id);
  abrirModal(cat ? 'Editar categoría' : 'Nueva categoría',
    `<form class="form">
      <label>Nombre <input name="nombre" required value="${esc(cat?.nombre || '')}" /></label>
      <label class="inline" style="flex-direction:row"><input type="checkbox" name="cocina" style="width:auto" ${!cat || cat.cocina ? 'checked' : ''}/> Se prepara en cocina (aparece en comandas)</label>
      <button class="btn primary">Guardar</button>
      ${cat ? `<button type="button" class="btn danger ghost" id="btnBorrarCat" ${enUso ? 'disabled title="Tiene productos"' : ''}>Eliminar categoría</button>` : ''}
    </form>`,
    (c) => {
      c.querySelector('form').onsubmit = (e) => {
        e.preventDefault();
        const datos = { nombre: e.target.nombre.value.trim(), cocina: e.target.cocina.checked };
        if (cat) Object.assign(cat, datos);
        else state.categorias.push({ id: uid(), ...datos });
        guardar(); cerrarModal(); renderMenu();
      };
      const borrar = c.querySelector('#btnBorrarCat');
      if (borrar) borrar.onclick = () => {
        state.categorias = state.categorias.filter((x) => x !== cat);
        guardar(); cerrarModal(); renderMenu();
      };
    });
}

$('#btnNuevoProducto').onclick = () => formProducto(null);
$('#btnNuevaCategoria').onclick = () => formCategoria(null);

/* ---------------- Ventas ---------------- */

$('#fechaDesde').value = $('#fechaHasta').value = ymd(new Date());
$('#fechaDesde').onchange = $('#fechaHasta').onchange = () => renderVentas();

function ventasFiltradas() {
  const d = $('#fechaDesde').value, h = $('#fechaHasta').value;
  return state.ventas.filter((v) => { const f = ymd(v.fecha); return (!d || f >= d) && (!h || f <= h); });
}

function barras(filas, max) {
  if (!filas.length) return `<p class="muted">Sin datos en este periodo</p>`;
  return filas.map(([nombre, valor, etiqueta]) => `<div class="barra">
    <span>${esc(nombre)}</span>
    <div class="track"><div class="fill" style="width:${max ? (valor / max) * 100 : 0}%"></div></div>
    <span class="v">${etiqueta}</span></div>`).join('');
}

function renderVentas() {
  const todas = ventasFiltradas();
  const validas = todas.filter((v) => !v.anulada);
  const total = validas.reduce((s, v) => s + v.total, 0);
  const propinas = validas.reduce((s, v) => s + v.propina, 0);
  const clientes = validas.reduce((s, v) => s + (v.personas || 1), 0);
  $('#kpis').innerHTML = [
    ['Total vendido', fmt(total)],
    ['Cuentas cerradas', validas.length],
    ['Ticket promedio', fmt(validas.length ? total / validas.length : 0)],
    ['Propinas', fmt(propinas)],
    ['Clientes atendidos', clientes],
  ].map(([l, v]) => `<div class="kpi"><div class="label">${l}</div><div class="valor">${v}</div></div>`).join('');

  const porMetodo = {};
  validas.forEach((v) => (porMetodo[v.metodo] = (porMetodo[v.metodo] || 0) + v.total));
  const m = Object.entries(porMetodo).sort((a, b) => b[1] - a[1]);
  $('#porMetodo').innerHTML = barras(m.map(([k, v]) => [k, v, fmt(v)]), m[0]?.[1]);

  const prods = {};
  validas.forEach((v) => v.items.forEach((i) => {
    prods[i.nombre] = prods[i.nombre] || { cant: 0, monto: 0 };
    prods[i.nombre].cant += i.cant;
    prods[i.nombre].monto += i.cant * i.precio;
  }));
  const top = Object.entries(prods).sort((a, b) => b[1].cant - a[1].cant).slice(0, 8);
  $('#topProductos').innerHTML = barras(top.map(([k, v]) => [k, v.cant, `${v.cant} · ${fmt(v.monto)}`]), top[0]?.[1].cant);

  $('#tablaVentas').innerHTML = todas.length
    ? todas.slice().reverse().map((v) => `<tr style="${v.anulada ? 'opacity:.45;text-decoration:line-through' : ''}">
        <td>${v.numero}</td>
        <td>${new Date(v.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</td>
        <td>${etiquetaMesa(v.mesa)}</td>
        <td>${esc(v.mesero || '—')}</td>
        <td>${esc(v.metodo)}</td>
        <td class="num">${fmt(v.total)}</td>
        <td><div class="acciones-fila">
          <button class="btn ghost sm" data-print="${v.id}">🖨</button>
          ${v.anulada ? '' : `<button class="btn danger ghost sm" data-anular="${v.id}">Anular</button>`}
        </div></td></tr>`).join('')
    : `<tr><td colspan="7" class="muted">No hay ventas en este periodo</td></tr>`;

  $$('[data-print]').forEach((b) => (b.onclick = () => imprimirRecibo(state.ventas.find((v) => v.id === b.dataset.print))));
  $$('[data-anular]').forEach((b) => (b.onclick = () => {
    const v = state.ventas.find((x) => x.id === b.dataset.anular);
    if (!confirm(`¿Anular la cuenta #${v.numero} por ${fmt(v.total)}?`)) return;
    v.anulada = true;
    guardar(); renderVentas();
  }));
}

function descargar(nombre, contenido, tipo) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

$('#btnExportarCSV').onclick = () => {
  const cols = ['numero', 'fecha', 'mesa', 'mesero', 'personas', 'subtotal', 'propina', 'descuento', 'total', 'metodo', 'anulada', 'productos'];
  const q = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
  const filas = ventasFiltradas().map((v) => cols.map((c) =>
    q(c === 'productos' ? v.items.map((i) => `${i.cant}x ${i.nombre}`).join('; ')
      : c === 'fecha' ? new Date(v.fecha).toLocaleString('es-CO')
      : c === 'mesa' ? etiquetaMesa(v.mesa)
      : c === 'anulada' ? (v.anulada ? 'SI' : 'NO') : v[c])).join(','));
  descargar(`ventas_${$('#fechaDesde').value}_${$('#fechaHasta').value}.csv`, '﻿' + [cols.join(','), ...filas].join('\n'), 'text/csv');
};

/* ---------------- Ajustes ---------------- */

function renderConfig() {
  const f = $('#formConfig');
  Object.entries(state.config).forEach(([k, v]) => { if (f[k]) f[k].value = v; });
}

$('#formConfig').onsubmit = (e) => {
  e.preventDefault();
  const f = e.target;
  const mesas = Math.max(1, +f.mesas.value);
  const ocupadasFuera = state.pedidos.some((p) => !p.mesa.startsWith('L') && +p.mesa > mesas && p.items.length);
  if (ocupadasFuera) return toast('Hay mesas ocupadas por encima de ese número');
  state.config = {
    nombre: f.nombre.value.trim(), nit: f.nit.value.trim(), direccion: f.direccion.value.trim(),
    telefono: f.telefono.value.trim(), mesas, propina: Math.max(0, +f.propina.value || 0), mensaje: f.mensaje.value.trim(),
  };
  guardar(); render();
  toast('Ajustes guardados');
};

$('#btnBackup').onclick = () => descargar(`respaldo_restaurante_${ymd(new Date())}.json`, JSON.stringify(state, null, 2), 'application/json');

$('#inputRestore').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const datos = JSON.parse(await file.text());
    if (!Array.isArray(datos.productos) || !datos.config) throw new Error();
    if (!confirm('Esto reemplazará todos los datos actuales. ¿Continuar?')) return;
    state = datos;
    guardar(); render();
    toast('Copia restaurada');
  } catch {
    toast('El archivo no es una copia válida');
  } finally {
    e.target.value = '';
  }
};

$('#btnReset').onclick = () => {
  if (!confirm('Se borrarán el menú, pedidos y ventas. ¿Seguro?')) return;
  if (prompt('Escribe BORRAR para confirmar') !== 'BORRAR') return;
  state = datosIniciales();
  guardar(); render();
  toast('Datos reiniciados');
};

/* ---------------- Arranque ---------------- */

function tic() {
  $('#reloj').textContent = new Date().toLocaleString('es-CO', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}
tic();
setInterval(() => {
  tic();
  if (vistaActual === 'mesas' || vistaActual === 'cocina') render();
}, 30000);

// Sincroniza entre pestañas (p. ej. una pantalla para cocina y otra para meseros)
window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return;
  state = cargar();
  if (!$('#modal').hidden) return; // no interrumpir un formulario abierto
  render();
});

guardar();
render();
