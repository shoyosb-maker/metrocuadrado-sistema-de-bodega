const Exporter = (() => {
  function downloadCSV(csv, filename = 'export.csv') {
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPDF(title, columns, rows) {
    const win = window.open('', '_blank');
    if (!win) { UI.toast('Permite las ventanas emergentes para exportar', 'warning'); return; }

    const styles = `
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #333; }
        h1 { font-size: 22px; color: #1e293b; margin-bottom: 4px; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px; }
        .meta { font-size: 11px; color: #64748b; text-align: right; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
        th { background: #f8fafc; color: #475569; font-weight: bold; text-transform: uppercase; font-size: 10px; }
        tr:nth-child(even) { background: #f8fafc; }
        .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center; }
      </style>`;
      
    const html = `
      <html><head><title>${title}</title>${styles}</head><body>
        <div class="header">
          <div>
            <h1>📦 ${title}</h1>
            <div style="font-size:12px;color:#64748b;">Sistema de Inventario</div>
          </div>
          <div class="meta">
            Generado: ${new Date().toLocaleString()}<br>
            Total registros: ${rows.length}
          </div>
        </div>
        
        <table>
          <thead><tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map(r => `<tr>${r.map(c => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>

        <div class="footer">
          Documento generado automáticamente por Inventario App
        </div>
      </body></html>`;

    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 300);
  }

  return { downloadCSV, downloadPDF };
})();