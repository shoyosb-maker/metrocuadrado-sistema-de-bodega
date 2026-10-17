/**
 * Módulo de Eventos y Alquiler (Metro Cuadrado)
 */
const Eventos = (() => {
  let currentProductos = [];

  async function renderList() {
    const container = document.getElementById('eventos-table-container');
    UI.loading(container);
    try {
      const res = await API.getEventos({});
      const eventos = res.eventos || [];
      
      if (eventos.length === 0) {
        UI.emptyState(container, { icon: '🎪', title: 'Sin eventos', message: 'Crea tu primer evento con "Nuevo Evento"' });
        document.getElementById('new-evento-btn').onclick = openEventForm;
        return;
      }

      UI.renderTable(container, {
        columns: [
          { key: 'ID', label: 'ID' },
          { key: 'Cliente', label: 'Cliente' },
          { key: 'Fecha_Inicio', label: 'Inicio', render: r => r.Fecha_Inicio ? new Date(r.Fecha_Inicio).toLocaleDateString() : '—' },
          { key: 'Fecha_Fin', label: 'Fin', render: r => r.Fecha_Fin ? new Date(r.Fecha_Fin).toLocaleDateString() : '—' },
          { key: 'Estado', label: 'Estado', render: r => {
            const m = { Pendiente: 'badge-warning', 'En Progreso': 'badge-info', Finalizado: 'badge-success', Cancelado: 'badge-danger' };
            return `<span class="badge ${m[r.Estado] || 'badge-secondary'}">${r.Estado}</span>`;
          }},
          { label: 'Acciones', render: r => `
            <div class="row-actions">
              <a href="#/evento-detalle/${r.ID}" class="btn btn-sm btn-ghost" title="Ver detalle">👁</a>
              <button class="btn btn-sm btn-danger" data-del-evento="${r.ID}" title="Cancelar" ${r.Estado !== 'Pendiente' ? 'disabled' : ''}>🗑</button>
            </div>
          `}
        ],
        rows: eventos
      });

      container.querySelectorAll('[data-del-evento]').forEach(b => b.addEventListener('click', () => handleDelete(b.dataset.delEvento)));
      document.getElementById('new-evento-btn').onclick = openEventForm;
    } catch (e) {
      UI.error(container, e.message);
    }
  }

  async function handleDelete(id) {
    const ok = await Modal.confirm('¿Cancelar este evento? Esta acción no se puede deshacer.', { title: 'Cancelar Evento', confirmText: 'Sí, cancelar', danger: true });
    if (!ok) return;
    try {
      await API.deleteEvento({ ID: id });
      UI.toast('Evento cancelado', 'success');
      renderList();
    } catch (e) {
      UI.toast('Error: ' + e.message, 'error');
    }
  }

  function openEventForm() {
    currentProductos = [];
    const prodsActivos = App.state.products.filter(p => p.Activo !== false && p.Activo !== 'FALSE');
    
    if (prodsActivos.length === 0) {
      UI.toast('Primero debes crear productos en el inventario.', 'warning', 4000);
      return;
    }

    const prodOpts = prodsActivos.map(p => {
      return `<option value="${p.ID}">${p.Nombre} [SKU: ${p.SKU || '—'}]</option>`;
    }).join('');

    const body = `
      <form id="evento-form" class="form">
        <div class="form-row">
          <div class="form-group"><label>Cliente *</label><input name="Cliente" class="input" required placeholder="Nombre del cliente o evento" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Fecha Inicio *</label><input name="Fecha_Inicio" type="date" class="input" required /></div>
          <div class="form-group"><label>Fecha Fin *</label><input name="Fecha_Fin" type="date" class="input" required /></div>
        </div>
        <div class="form-group"><label>Notas</label><textarea name="Notas" class="input" rows="2" placeholder="Detalles del montaje..."></textarea></div>
        
        <div style="border-top: 1px solid var(--color-border); margin: 16px 0; padding-top: 16px;">
          <label style="font-weight:bold; margin-bottom:8px; display:block;">Añadir Materiales</label>
          
          <div style="background: var(--color-bg); padding: 12px; border-radius: 8px; margin-bottom: 12px; border: 1px solid var(--color-border);">
            <div class="form-group">
              <select id="evt-prod-select" class="input">
                <option value="">-- Selecciona un producto --</option>
                ${prodOpts}
              </select>
            </div>
            
            <!-- Panel de info que aparece al seleccionar producto -->
            <div id="prod-info-panel" style="display:none; margin-top: 8px; padding: 8px; background: #fff; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 13px;">
              <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                <span>Stock Físico: <b id="info-stock-fisico">0</b></span>
                <span>Disponible en fechas: <b id="info-stock-disponible" style="color:var(--color-primary);">0</b></span>
              </div>
            </div>

            <div class="form-row" style="margin-top: 8px;">
              <div class="form-group">
                <label>Uso en este evento</label>
                <select id="evt-tipo-select" class="input">
                  <option value="Alquiler">Alquiler (Retornable)</option>
                  <option value="Venta">Venta (Consumible)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Cantidad</label>
                <input id="evt-cant-input" type="number" min="1" class="input" placeholder="0" />
              </div>
              <div class="form-group">
                <label>Precio Unit.</label>
                <input id="evt-precio-input" type="number" min="0" step="0.01" class="input" value="0" />
              </div>
            </div>
            
            <button type="button" class="btn btn-primary" id="add-prod-btn" style="width: 100%; margin-top: 8px;">Añadir a la lista</button>
          </div>

          <div id="evento-productos-lista" style="margin-top: 12px; max-height: 200px; overflow: auto;"></div>
        </div>
      </form>
    `;

    const footer = `<button class="btn btn-ghost" data-modal-cancel>Cancelar</button><button class="btn btn-primary" id="save-evento-btn">Guardar Evento</button>`;
    const { footer: f } = Modal.open({ title: 'Nuevo Evento', body, footer });
    
    f.querySelector('[data-modal-cancel]').onclick = () => Modal.close(true);
    
    const selProd = document.getElementById('evt-prod-select');
    const selTipo = document.getElementById('evt-tipo-select');
    const inputCant = document.getElementById('evt-cant-input');
    const inputPrecio = document.getElementById('evt-precio-input');
    const infoPanel = document.getElementById('prod-info-panel');
    const infoFisico = document.getElementById('info-stock-fisico');
    const infoDisponible = document.getElementById('info-stock-disponible');

    // Función para actualizar el panel de información
    const updateProductInfo = async () => {
      const prodId = selProd.value;
      if (!prodId) {
        infoPanel.style.display = 'none';
        return;
      }

      const prod = App.state.products.find(p => String(p.ID) === String(prodId));
      if (!prod) return;

      // Actualizar Precio
      const tipo = selTipo.value;
      const precio = tipo === 'Alquiler' ? (prod.Precio_Alquiler || 0) : (prod.Precio || 0);
      inputPrecio.value = precio;

      // Mostrar stock físico
      infoFisico.textContent = prod.Stock || 0;
      infoDisponible.textContent = '...';
      infoPanel.style.display = 'block';

      // Consultar disponibilidad (si hay fechas)
      const fInicio = document.querySelector('[name="Fecha_Inicio"]').value;
      const fFin = document.querySelector('[name="Fecha_Fin"]').value;
      
      if (fInicio && fFin) {
        try {
          const check = await API.checkDisponibilidad({
            ID_Producto: prodId,
            Cantidad: 1,
            Fecha_Inicio: fInicio,
            Fecha_Fin: fFin
          });
          infoDisponible.textContent = check.disponible;
          if (check.disponible <= 0) infoDisponible.style.color = 'var(--color-danger)';
          else infoDisponible.style.color = 'var(--color-primary)';
        } catch(e) {
          infoDisponible.textContent = 'Error';
        }
      } else {
        infoDisponible.textContent = 'Faltan fechas';
      }
    };

    selProd.addEventListener('change', updateProductInfo);
    selTipo.addEventListener('change', updateProductInfo);
    document.querySelector('[name="Fecha_Inicio"]').addEventListener('change', updateProductInfo);
    document.querySelector('[name="Fecha_Fin"]').addEventListener('change', updateProductInfo);

    const renderProductosLista = () => {
      const container = document.getElementById('evento-productos-lista');
      if (currentProductos.length === 0) {
        container.innerHTML = '<p class="muted-sm" style="text-align:center;">No hay materiales añadidos.</p>';
        return;
      }
      container.innerHTML = `
        <table style="width:100%; font-size:13px;">
          <thead><tr><th>Producto</th><th>Tipo</th><th>Cant.</th><th>Precio</th><th>Subtotal</th><th></th></tr></thead>
          <tbody>
            ${currentProductos.map((p, idx) => `
              <tr>
                <td>${p.Nombre}</td>
                <td><span class="badge badge-${p.Tipo_Producto === 'Alquiler' ? 'warning' : 'info'}">${p.Tipo_Producto}</span></td>
                <td>${p.Cantidad}</td>
                <td>$${p.Precio_Unitario.toLocaleString()}</td>
                <td>$${p.Subtotal.toLocaleString()}</td>
                <td><button type="button" class="btn btn-sm btn-danger" data-rm-idx="${idx}">X</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      
      container.querySelectorAll('[data-rm-idx]').forEach(btn => {
        btn.onclick = () => {
          currentProductos.splice(Number(btn.dataset.rmIdx), 1);
          renderProductosLista();
        };
      });
    };
    renderProductosLista();

    document.getElementById('add-prod-btn').onclick = async () => {
      if (!selProd.value || Number(inputCant.value) < 1) return UI.toast('Selecciona un producto y una cantidad válida', 'warning');
      
      const opt = selProd.options[selProd.selectedIndex];
      const nombreReal = opt.text.split('[')[0].trim();
      const cant = Number(inputCant.value);
      const precio = Number(inputPrecio.value);
      const tipo = selTipo.value;

      currentProductos.push({
        ID_Producto: selProd.value,
        Nombre: nombreReal,
        Cantidad: cant,
        Precio_Unitario: precio,
        Subtotal: cant * precio,
        Tipo_Producto: tipo // <-- SE GUARDA EL TIPO SELECCIONADO
      });
      
      renderProductosLista();
      inputCant.value = '';
      selProd.value = '';
      infoPanel.style.display = 'none';
    };

    f.querySelector('#save-evento-btn').onclick = async () => {
      const form = document.getElementById('evento-form');
      if (!form.reportValidity()) return;
      if (currentProductos.length === 0) return UI.toast('Añade al menos un material al evento', 'warning');

      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      payload.productos = currentProductos;

      const btn = f.querySelector('#save-evento-btn');
      btn.disabled = true; btn.textContent = 'Guardando...';

      try {
        const res = await API.createEvento(payload);
        UI.toast(`Evento creado. Total: $${res.totalFacturado.toLocaleString()}`, 'success', 4000);
        Modal.close(true);
        Router.navigate('eventos');
      } catch (e) {
        UI.toast('Error: ' + e.message, 'error');
      } finally {
        btn.disabled = false; btn.textContent = 'Guardar Evento';
      }
    };
  }

  async function renderDetail(id) {
    const container = document.getElementById('evento-detalle-container');
    UI.loading(container);
    try {
      const resEvts = await API.getEventos({});
      const evt = (resEvts.eventos || []).find(e => String(e.ID) === String(id));
      if (!evt) throw new Error('Evento no encontrado');

      const resDet = await API.getEventoDetalle({ ID_Evento: id });
      const lineas = resDet.lineas || [];

      let total = 0;
      const rowsHtml = lineas.map(l => {
        const prod = App.state.products.find(p => String(p.ID) === String(l.ID_Producto)) || {};
        total += Number(l.Subtotal);
        return `
          <tr>
            <td>${prod.Nombre || l.ID_Producto}</td>
            <td><span class="badge badge-${l.Tipo_Producto === 'Alquiler' ? 'warning' : 'info'}">${l.Tipo_Producto || 'Venta'}</span></td>
            <td>${l.Cantidad}</td>
            <td>$${Number(l.Precio_Unitario).toLocaleString()}</td>
            <td>$${Number(l.Subtotal).toLocaleString()}</td>
          </tr>
        `;
      }).join('');

      let actionButtons = '';
      if (evt.Estado === 'Pendiente') {
        actionButtons = `<button class="btn btn-primary" id="btn-despachar">🚚 Despachar Material</button>`;
      } else if (evt.Estado === 'En Progreso') {
        actionButtons = `<button class="btn btn-success" id="btn-devolver">📥 Recibir Devolución</button>`;
      }

      container.innerHTML = `
        <div class="card" style="margin-bottom: 16px;">
          <div class="card-header card-header-flex">
            <div>
              <h3 style="font-size: 20px;">${evt.Cliente}</h3>
              <p class="muted-sm">ID: ${evt.ID} | Del ${new Date(evt.Fecha_Inicio).toLocaleDateString()} al ${new Date(evt.Fecha_Fin).toLocaleDateString()}</p>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span class="badge ${evt.Estado === 'En Progreso' ? 'badge-info' : evt.Estado === 'Finalizado' ? 'badge-success' : 'badge-warning'}">${evt.Estado}</span>
              ${actionButtons}
              <a href="#/eventos" class="btn btn-ghost btn-sm">← Volver</a>
            </div>
          </div>
          <div class="card-body">
            <p><strong>Notas:</strong> ${evt.Notas || 'Sin notas'}</p>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Materiales y Facturación</h3></div>
          <div class="card-body">
            <div class="table-wrapper">
              <table style="width:100%">
                <thead><tr><th>Producto</th><th>Tipo</th><th>Cant.</th><th>Precio Unit.</th><th>Subtotal</th></tr></thead>
                <tbody>${rowsHtml || '<tr><td colspan="5" style="text-align:center">Sin materiales</td></tr>'}</tbody>
              </table>
            </div>
            <div style="text-align: right; margin-top: 16px;">
              <h3 style="color: var(--color-primary);">Total Facturado: $${total.toLocaleString()}</h3>
            </div>
          </div>
        </div>
      `;

      document.getElementById('btn-despachar')?.addEventListener('click', async () => {
        const ok = await Modal.confirm('¿Despachar este evento? Se restará el stock físico del inventario. Esta acción no se puede deshacer.', { title: 'Despachar Evento', confirmText: 'Sí, despachar' });
        if (!ok) return;
        try {
          await API.despacharEvento({ ID_Evento: id });
          UI.toast('Evento despachado correctamente', 'success');
          await App.loadAllData();
          renderDetail(id);
        } catch (e) {
          UI.toast(e.message, 'error', 5000);
        }
      });

      document.getElementById('btn-devolver')?.addEventListener('click', async () => {
        let tablaRows = lineas.map((l) => {
          const prod = App.state.products.find(p => String(p.ID) === String(l.ID_Producto)) || {};
          // Usa el tipo guardado en el evento, o el del producto como fallback
          const tipoProd = String(l.Tipo_Producto || prod.Tipo_Producto || 'Venta').trim().toLowerCase();
          const isAlquiler = tipoProd === 'alquiler';
          
          return `
            <tr>
              <td>${prod.Nombre || l.ID_Producto}</td>
              <td>${l.Cantidad}</td>
              <td>
                <!-- SE QUITÓ EL DISABLED, AHORA SIEMPRE ES EDITABLE -->
                <input type="number" class="input dev-input" data-id="${l.ID_Producto}" 
                       value="${isAlquiler ? l.Cantidad : 0}" min="0" max="${l.Cantidad}" 
                       style="width:90px; padding:6px;" />
              </td>
              <td><span class="badge ${isAlquiler ? 'badge-warning' : 'badge-info'}">${l.Tipo_Producto || 'Venta'}</span></td>
            </tr>
          `;
        }).join('');

        const modalBody = `
          <p class="form-hint" style="margin-bottom: 12px;">
            Ingresa la cantidad real que volvió a bodega. Si es menor a la despachada, la diferencia se registrará como <b>merma</b>. Los productos de <b>Venta</b> no vuelven al stock.
          </p>
          <div class="table-wrapper" style="max-height: 300px; overflow-y: auto;">
            <table>
              <thead><tr><th>Producto</th><th>Despachado</th><th>Cant. Devuelta</th><th>Tipo</th></tr></thead>
              <tbody>${tablaRows}</tbody>
            </table>
          </div>
        `;

        const modalFooter = `
          <button class="btn btn-ghost" data-modal-cancel>Cancelar</button>
          <button class="btn btn-success" id="confirm-devolucion-btn">Procesar Devolución</button>
        `;

        const { footer: mf } = Modal.open({ title: 'Recibir Devolución', body: modalBody, footer: modalFooter });
        
        mf.querySelector('[data-modal-cancel]').onclick = () => Modal.close(true);

        mf.querySelector('#confirm-devolucion-btn').onclick = async () => {
          const inputs = document.querySelectorAll('.dev-input');
          const devoluciones = [];
          
          inputs.forEach(inp => {
            devoluciones.push({
              ID_Producto: inp.dataset.id,
              Cantidad_Devuelta: Number(inp.value) || 0
            });
          });

          const btn = mf.querySelector('#confirm-devolucion-btn');
          btn.disabled = true; btn.textContent = 'Procesando...';

          try {
            await API.devolverEvento({ ID_Evento: id, devoluciones: devoluciones });
            UI.toast('Devolución procesada y evento finalizado', 'success');
            Modal.close(true);
            await App.loadAllData(); 
            renderDetail(id); 
          } catch (e) {
            UI.toast('Error: ' + e.message, 'error');
            btn.disabled = false; btn.textContent = 'Procesar Devolución';
          }
        };
      });

    } catch (e) {
      UI.error(container, e.message);
    }
  }

  return { renderList, renderDetail };
})();