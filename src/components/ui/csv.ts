// Descarga de CSV y texto (DEMO). Las comillas y los inicios tipo fórmula se neutralizan.
const cell = (v: string | number) => {
  const s = String(v).replace(/^([=+\-@])/, "'$1");
  return `"${s.replace(/"/g, '""')}"`;
};

export function downloadText(filename: string, content: string, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function downloadCsv(filename: string, comments: string[], head: string[], rows: (string | number)[][]) {
  const lines = [...comments.map((c) => `# ${c}`), head.join(","), ...rows.map((r) => r.map(cell).join(","))];
  downloadText(filename, `﻿${lines.join("\n")}`, "text/csv");
}
