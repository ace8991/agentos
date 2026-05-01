export function generateChartArtifact(params: {
  title: string;
  chartType: 'bar' | 'line' | 'pie' | 'doughnut';
  labels: string[];
  datasets: Array<{ label: string; data: number[]; color?: string }>;
}): string {
  const { title, chartType, labels, datasets } = params;
  const colors = ['#6366f1','#f97316','#4ade80','#60a5fa','#f43f5e','#a855f7','#eab308'];

  const datasetsJson = datasets.map((d, i) => ({
    label: d.label,
    data: d.data,
    backgroundColor: d.color ?? colors[i % colors.length] + '80',
    borderColor: d.color ?? colors[i % colors.length],
    borderWidth: 2,
    borderRadius: chartType === 'bar' ? 6 : 0,
  }));

  return `<artifact type="html" title="${title}" language="html">
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0f0f0f;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    min-height: 100vh; padding: 32px; font-family: system-ui;
  }
  h1 { color: #e5e5e5; font-size: 18px; margin-bottom: 24px; font-weight: 600; }
  .chart-container {
    background: #1a1a1a; border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.08);
    padding: 24px; width: 100%; max-width: 700px;
  }
</style>
</head>
<body>
<h1>${title}</h1>
<div class="chart-container">
  <canvas id="chart"></canvas>
</div>
<script>
new Chart(document.getElementById('chart'), {
  type: '${chartType}',
  data: {
    labels: ${JSON.stringify(labels)},
    datasets: ${JSON.stringify(datasetsJson)}
  },
  options: {
    responsive: true,
    plugins: {
      legend: { labels: { color: '#888', font: { size: 12 } } }
    },
    scales: ${chartType === 'pie' || chartType === 'doughnut' ? 'undefined' : `{
      x: { ticks: { color: '#666' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#666' }, grid: { color: 'rgba(255,255,255,0.05)' } }
    }`}
  }
});
</script>
</body>
</html>
</artifact>`;
}
