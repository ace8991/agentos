export interface MindmapNode {
  id: string;
  label: string;
  children?: MindmapNode[];
  color?: string;
}

export function generateMindmapArtifact(params: {
  title: string;
  root: string;
  nodes: MindmapNode[];
}): string {
  const { title, root, nodes } = params;

  return `<artifact type="html" title="${title}" language="html">
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0f0f0f; font-family: system-ui;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; padding: 20px; overflow: auto;
  }
  .mindmap { position: relative; }
  .node-root {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white; padding: 14px 24px; border-radius: 50px;
    font-weight: 700; font-size: 15px; text-align: center;
    box-shadow: 0 0 30px rgba(99,102,241,0.4);
    position: relative; z-index: 2;
  }
  .branches {
    display: flex; flex-wrap: wrap; gap: 12px;
    justify-content: center; margin-top: 32px;
  }
  .branch {
    background: #1a1a1a; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px; padding: 12px 16px;
    font-size: 13px; color: #e5e5e5; cursor: default;
    transition: all 0.2s; min-width: 120px; text-align: center;
    border-left: 3px solid var(--branch-color, #6366f1);
  }
  .branch:hover { transform: translateY(-2px); background: #222; }
  .branch-children {
    margin-top: 8px; display: flex; flex-wrap: wrap;
    gap: 6px; justify-content: center;
  }
  .leaf {
    background: #111; border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px; padding: 6px 12px;
    font-size: 11px; color: #888;
  }
  .connector {
    width: 2px; height: 24px; background: rgba(255,255,255,0.1);
    margin: 0 auto;
  }
  h2 { color: #e5e5e5; font-size: 14px; text-align: center;
       margin-bottom: 24px; font-weight: 500; opacity: 0.6; }
</style>
</head>
<body>
<div class="mindmap">
  <h2>${title}</h2>
  <div class="node-root">${root}</div>
  <div class="connector"></div>
  <div class="branches">
    ${nodes.map((node, i) => {
      const colors = ['#6366f1','#f97316','#4ade80','#f43f5e','#60a5fa','#a855f7','#eab308'];
      const color = node.color ?? colors[i % colors.length];
      return `
    <div class="branch" style="--branch-color: ${color}">
      ${node.label}
      ${node.children ? `
      <div class="branch-children">
        ${node.children.map(c => `<div class="leaf">${c.label}</div>`).join('')}
      </div>` : ''}
    </div>`;
    }).join('')}
  </div>
</div>
</body>
</html>
</artifact>`;
}
