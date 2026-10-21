// Requiere Chart.js cargado en index.html
const Charts = (() => {
  const instances = {};

  function destroy(id) {
    if (instances[id]) { instances[id].destroy(); delete instances[id]; }
  }

  function renderTopProducts(canvasId, data) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.nombre),
        datasets: [{
          label: 'Unidades solicitadas',
          data: data.map(d => d.cantidad),
          backgroundColor: '#2563eb',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  function renderStatusDoughnut(canvasId, byStatus) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Pendiente', 'Aprobada', 'Rechazada'],
        datasets: [{
          data: [byStatus.Pendiente, byStatus.Aprobada, byStatus.Rechazada],
          backgroundColor: ['#f59e0b', '#10b981', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        cutout: '65%'
      }
    });
  }

  function renderFinanceChart(canvasId, data) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Ingresos ($)',
            data: data.ingresos,
            backgroundColor: '#10b981', // Verde
            borderRadius: 4
          },
          {
            label: 'Gastos ($)',
            data: data.gastos,
            backgroundColor: '#ef4444', // Rojo
            borderRadius: 4
          },
          {
            label: 'Utilidad ($)',
            data: data.utilidad,
            type: 'line',
            borderColor: '#2563eb', // Azul
            backgroundColor: '#2563eb',
            borderWidth: 2,
            fill: false,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  return { renderTopProducts, renderStatusDoughnut, renderFinanceChart };
})();