/**
 * Módulo de códigos QR y de Barras (1D): generación, descarga, impresión y escaneo.
 */
const QR = (() => {
  let scanner = null;
  let isScanning = false;

  function buildProductUrl(id) {
    const base = window.location.origin + window.location.pathname;
    return base + '#/producto/' + encodeURIComponent(id);
  }

  function render(container, text, size) {
    if (!container) return;
    size = size || 200;
    container.innerHTML = '';
    if (typeof QRCode === 'undefined') {
      container.innerHTML = '<p style="color:red">⚠️ Librería QR no cargada</p>';
      return;
    }
    new QRCode(container, {
      text: text, width: size, height: size,
      colorDark: '#0f172a', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M
    });
  }

  /**
   * Genera el SVG de un código de barras 1D
   */
  function generateBarcodeSVG(text, format = 'CODE128') {
    if (!text || typeof JsBarcode === 'undefined') return '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    try {
      // Si el texto tiene 13 dígitos, usamos EAN13, si no, CODE128
      const formatoFinal = (format === 'auto' && text.length === 13) ? 'EAN13' : 'CODE128';
      
      JsBarcode(svg, text, {
        format: formatoFinal,
        width: 1.5,
        height: 40,
        displayValue: true,
        fontSize: 12,
        margin: 0
      });
      return svg.outerHTML;
    } catch (e) {
      console.warn('Error generando barcode:', e);
      return ''; // Si falla (ej. letras en EAN13), devuelve vacío
    }
  }

  function downloadPNG(text, filename, size) {
    filename = filename || 'qr.png';
    size = size || 300;
    return new Promise(function (resolve, reject) {
      var tmp = document.createElement('div');
      tmp.style.position = 'absolute'; tmp.style.left = '-9999px';
      document.body.appendChild(tmp);
      new QRCode(tmp, { text: text, width: size, height: size });

      setTimeout(function () {
        var canvas = tmp.querySelector('canvas');
        var img = tmp.querySelector('img');
        var dataUrl = canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);
        document.body.removeChild(tmp);
        if (!dataUrl) return reject(new Error('No se pudo generar el QR'));
        var a = document.createElement('a');
        a.href = dataUrl; a.download = filename; a.click();
        resolve(true);
      }, 120);
    });
  }

  /**
   * Imprime etiqueta térmica (50x30mm) con Código de Barras 1D + QR
   */
  function printLabel(product, bodegaName) {
    var win = window.open('', '_blank');
    if (!win) { UI.toast('Permite ventanas emergentes para imprimir', 'warning'); return; }

    var url = buildProductUrl(product.ID);
    var barcodeHTML = '';
    
    // Si el producto tiene código de barras, lo generamos
    if (product.Codigo_Barras) {
      barcodeHTML = generateBarcodeSVG(product.Codigo_Barras);
    }

    var styles = ''
      + '<style>'
      + '@page { size: 50mm 30mm; margin: 0; }'
      + 'body { font-family: Arial, sans-serif; margin: 0; padding: 0; display: flex; flex-wrap: wrap; }'
      + '.label { width: 50mm; height: 30mm; padding: 1mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; page-break-inside: avoid; overflow: hidden; }'
      + '.name { font-size: 9px; font-weight: bold; margin: 0; line-height: 1; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }'
      + '.barcode { width: 100%; max-height: 12mm; margin: 1mm 0; }'
      + '.qr { width: 12mm; height: 12mm; margin: 0; }'
      + '.sku { font-size: 7px; color: #333; margin: 0; line-height: 1; }'
      + '@media print { body { -webkit-print-color-adjust: exact; } }'
      + '</style>';

    var tmp = document.createElement('div');
    tmp.style.position = 'absolute'; tmp.style.left = '-9999px';
    document.body.appendChild(tmp);
    new QRCode(tmp, { text: url, width: 90, height: 90 });

    setTimeout(function () {
      var canvas = tmp.querySelector('canvas');
      var img = tmp.querySelector('img');
      var qrData = canvas ? canvas.toDataURL('image/png') : (img ? img.src : '');
      document.body.removeChild(tmp);

      var labelHtml = ''
        + '<div class="label">'
        +   '<div class="name">' + escapeHtml(product.Nombre) + '</div>'
        +   (barcodeHTML ? '<div class="barcode">' + barcodeHTML + '</div>' : '<div style="height: 5mm"></div>')
        +   '<div style="display:flex; align-items:center; gap:2mm;">'
        +      '<div class="sku">SKU: ' + escapeHtml(product.SKU || '—') + '</div>'
        +      '<div class="qr"><img src="' + qrData + '" width="45" height="45" /></div>'
        +   '</div>'
        + '</div>';

      win.document.write(''
        + '<html><head><title>Etiqueta ' + escapeHtml(product.Nombre) + '</title>' + styles + '</head>'
        + '<body>' + labelHtml + '</body></html>');
      win.document.close();
      setTimeout(function() { win.print(); }, 300);
    }, 150);
  }

  /**
   * Modal con QR y Código de Barras
   */
  function showProductQR(product, bodegaName) {
    var url = buildProductUrl(product.ID);
    var barcodeHTML = product.Codigo_Barras ? generateBarcodeSVG(product.Codigo_Barras) : '';

    var body = ''
      + '<div style="text-align:center">'
      +   (barcodeHTML ? '<div style="margin-bottom:16px; background:#fff; padding:10px; border-radius:10px; border:1px solid #e2e8f0; display:inline-block; max-width:100%">' + barcodeHTML + '</div><br>' : '')
      +   '<div id="qr-canvas" style="display:inline-block;padding:14px;background:#fff;border-radius:10px;border:1px solid #e2e8f0"></div>'
      +   '<p style="margin-top:12px;font-weight:600">' + escapeHtml(product.Nombre) + '</p>'
      +   '<p class="form-hint">SKU: ' + escapeHtml(product.SKU || '—') + ' · Bodega: ' + escapeHtml(bodegaName || '—') + '</p>'
      + '</div>';

    var footer = ''
      + '<button class="btn btn-ghost" data-modal-cancel>Cerrar</button>'
      + '<button class="btn btn-ghost" id="qr-print-btn">🖨 Imprimir etiqueta</button>'
      + '<button class="btn btn-primary" id="qr-download-btn">⬇ Descargar QR</button>';

    var ref = Modal.open({ title: 'Códigos del producto', body: body, footer: footer });
    var f = ref.footer;

    setTimeout(function () { render(document.getElementById('qr-canvas'), url, 180); }, 50);

    f.querySelector('[data-modal-cancel]').addEventListener('click', function () { Modal.close(true); });
    f.querySelector('#qr-print-btn').addEventListener('click', function () { printLabel(product, bodegaName); });
    f.querySelector('#qr-download-btn').addEventListener('click', async function () {
      try {
        await downloadPNG(url, 'qr-' + (product.SKU || product.ID) + '.png', 400);
        UI.toast('QR descargado', 'success');
      } catch (e) { UI.toast('Error: ' + e.message, 'error'); }
    });
  }

  // ... (El resto de funciones: startScanner, stopScanner, handleScanResult, escapeHtml se mantienen igual) ...
  async function startScanner() {
    if (isScanning) return;
    if (typeof Html5Qrcode === 'undefined') { UI.toast('Librería de escaneo no cargada', 'error'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { UI.toast('Tu navegador no soporta cámara.', 'error', 6000); return; }

    var body = '<div id="qr-reader" style="width:100%;max-width:420px;margin:0 auto;border-radius:10px;overflow:hidden"></div><p class="form-hint" style="text-align:center;margin-top:10px">Apunta al QR o Código de Barras</p>';
    var footer = '<button class="btn btn-ghost" data-modal-cancel>Cerrar</button>';

    var ref = Modal.open({ title: 'Escanear código', body: body, footer: footer, onClose: function () { stopScanner(); } });
    var f = ref.footer;
    f.querySelector('[data-modal-cancel]').addEventListener('click', function () { stopScanner(); Modal.close(true); });

    scanner = new Html5Qrcode('qr-reader');
    isScanning = true;

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        function (decodedText) { handleScanResult(decodedText); stopScanner(); Modal.close(true); },
        function () { }
      );
    } catch (err) {
      isScanning = false;
      UI.toast('No se pudo acceder a la cámara.', 'error', 5000);
      Modal.close(true);
    }
  }

  async function stopScanner() {
    if (!scanner) { isScanning = false; return; }
    try { try { await scanner.stop(); } catch (e) {} try { await scanner.clear(); } catch (e) {} } catch (e) {}
    scanner = null; isScanning = false;
  }

  function handleScanResult(text) {
    var id = null;
    // Intentar buscar por ID o por Código de Barras
    var match = String(text).match(/#\/producto\/([^\/\?#]+)/);
    if (match) { id = decodeURIComponent(match[1]); } 
    else if (/^[A-Z]+-/.test(text) || /^\d+$/.test(text)) { id = text; }
    else { try { var obj = JSON.parse(text); if (obj && obj.id) id = obj.id; } catch (e) {} }

    if (id) {
      UI.toast('Código detectado: ' + id, 'success', 2000);
      // Si es un código de barras (solo números), buscar el producto por ese campo
      if (/^\d+$/.test(id)) {
        const prod = App.state.products.find(p => String(p.Codigo_Barras) === String(id));
        if (prod) return Router.navigate('producto/' + encodeURIComponent(prod.ID));
      }
      Router.navigate('producto/' + encodeURIComponent(id));
    } else {
      UI.toast('Código no reconocido: ' + text, 'warning', 4000);
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }

  return {
    buildProductUrl, render, downloadPNG, printLabel, showProductQR, startScanner, stopScanner
  };
})();