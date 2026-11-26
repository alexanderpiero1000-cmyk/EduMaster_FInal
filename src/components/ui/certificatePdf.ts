// Certificado en PDF generado a mano (A4 horizontal, vectorial), sin librerías.
// Usa las fuentes estándar Helvetica con codificación WinAnsi (cubre tildes y ñ).

export interface CertificateData {
  student: string; course: string; instructor: string; lessons: number; score: number | null;
  issuedAt: string; folio: string; code: string;
}

const W = 842, H = 595, CX = W / 2;
type RGB = [number, number, number];
const NAVY: RGB = [0.04, 0.12, 0.24], CYAN: RGB = [0.04, 0.55, 0.72], VIOLET: RGB = [0.36, 0.22, 0.78], GRAY: RGB = [0.36, 0.42, 0.52], LIGHT: RGB = [0.82, 0.86, 0.92], PAPER: RGB = [0.985, 0.99, 1];

// Anchos AFM (milésimas) de los caracteres 32-126; las letras con tilde miden como su letra base.
const REGULAR = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

function width(text: string, size: number, bold: boolean, spacing = 0): number {
  const table = bold ? BOLD : REGULAR;
  let total = 0;
  for (const ch of text) {
    const base = ch.normalize("NFD").charCodeAt(0);
    total += base >= 32 && base <= 126 ? table[base - 32] : 556;
  }
  return (total * size) / 1000 + spacing * Math.max(0, text.length - 1);
}
/** Texto seguro para una cadena PDF en WinAnsi. */
const encode = (text: string) => text.normalize("NFC").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/[^\x20-\xff]/g, "?").replace(/([\\()])/g, "\\$1");

const n = (v: number) => Number(v.toFixed(2)).toString();
const fill = (c: RGB) => `${c.map(n).join(" ")} rg`;
const stroke = (c: RGB) => `${c.map(n).join(" ")} RG`;

/** Las coordenadas `top` se miden desde el borde superior. */
function drawing() {
  const ops: string[] = [];
  return {
    ops,
    rect(x: number, top: number, w: number, h: number, c: RGB) { ops.push(`${fill(c)} ${n(x)} ${n(H - top - h)} ${n(w)} ${n(h)} re f`); },
    frame(inset: number, c: RGB, line: number) { ops.push(`${stroke(c)} ${n(line)} w ${inset} ${inset} ${W - inset * 2} ${H - inset * 2} re S`); },
    line(x1: number, x2: number, top: number, c: RGB, line = 1) { ops.push(`${stroke(c)} ${n(line)} w ${n(x1)} ${n(H - top)} m ${n(x2)} ${n(H - top)} l S`); },
    polygon(points: [number, number][], c: RGB) { ops.push(`${fill(c)} ${points.map(([x, top], i) => `${n(x)} ${n(H - top)} ${i ? "l" : "m"}`).join(" ")} h f`); },
    circle(x: number, top: number, r: number, c: RGB, line: number, filled?: RGB) {
      const y = H - top, k = r * 0.5523;
      const path = `${n(x + r)} ${n(y)} m ${n(x + r)} ${n(y + k)} ${n(x + k)} ${n(y + r)} ${n(x)} ${n(y + r)} c ${n(x - k)} ${n(y + r)} ${n(x - r)} ${n(y + k)} ${n(x - r)} ${n(y)} c ${n(x - r)} ${n(y - k)} ${n(x - k)} ${n(y - r)} ${n(x)} ${n(y - r)} c ${n(x + k)} ${n(y - r)} ${n(x + r)} ${n(y - k)} ${n(x + r)} ${n(y)} c h`;
      ops.push(`${stroke(c)} ${n(line)} w ${filled ? `${fill(filled)} ${path} B` : `${path} S`}`);
    },
    /** Texto centrado en x; reduce el tamaño si no cabe en `max`. */
    text(value: string, x: number, top: number, size: number, c: RGB, opts: { bold?: boolean; spacing?: number; max?: number } = {}) {
      const { bold = false, spacing = 0, max } = opts;
      let s = size;
      while (max && s > 8 && width(value, s, bold, spacing) > max) s -= 0.5;
      ops.push(`BT /${bold ? "F2" : "F1"} ${n(s)} Tf ${fill(c)} ${n(spacing)} Tc ${n(x - width(value, s, bold, spacing) / 2)} ${n(H - top)} Td (${encode(value)}) Tj ET`);
    },
  };
}

function content(d: CertificateData): string {
  const g = drawing();
  const date = new Date(d.issuedAt).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
  g.rect(0, 0, W, H, PAPER);
  g.frame(22, NAVY, 2.5);
  g.frame(31, LIGHT, 0.8);
  // esquinas decorativas, por encima del marco
  g.polygon([[0, 0], [170, 0], [0, 170]], NAVY);
  g.polygon([[0, 185], [185, 0], [212, 0], [0, 212]], CYAN);
  g.polygon([[W, H], [W - 170, H], [W, H - 170]], NAVY);
  g.polygon([[W, H - 185], [W - 185, H], [W - 212, H], [W, H - 212]], CYAN);

  // marca: "EduMaster" + ".ai" en dos colores, centradas como una sola palabra
  const a = width("EduMaster", 24, true), b = width(".ai", 24, true), left = CX - (a + b) / 2;
  g.text("EduMaster", left + a / 2, 82, 24, NAVY, { bold: true });
  g.text(".ai", left + a + b / 2, 82, 24, CYAN, { bold: true });

  g.text("CERTIFICADO DE FINALIZACIÓN", CX, 142, 30, NAVY, { bold: true, spacing: 1.5, max: 600 });
  g.line(CX - 45, CX + 45, 160, CYAN, 3);
  g.text("Se otorga a", CX, 200, 13, GRAY);
  g.text(d.student, CX, 248, 40, NAVY, { bold: true, max: 620 });
  g.line(CX - 220, CX + 220, 266, LIGHT, 1);
  g.text("por haber completado satisfactoriamente el curso", CX, 298, 13, GRAY);
  g.text(d.course, CX, 334, 25, VIOLET, { bold: true, max: 640 });
  g.text([`${d.lessons} lecciones`, d.score === null ? null : `Nota oficial: ${d.score} de 100`, `Emitido el ${date}`].filter(Boolean).join("   ·   "), CX, 366, 12, GRAY, { max: 640 });

  // firmas
  for (const [x, name, role] of [[212, d.instructor, "Docente del curso"], [W - 212, "EduMaster.ai", "Plataforma de aprendizaje"]] as const) {
    g.line(x - 100, x + 100, 458, GRAY, 0.8);
    g.text(name, x, 476, 13, NAVY, { bold: true, max: 200 });
    g.text(role, x, 491, 10, GRAY);
  }
  // sello
  g.circle(CX, 452, 44, CYAN, 2.5, [1, 1, 1]);
  g.circle(CX, 452, 36, LIGHT, 1);
  g.text("DEMO", CX, 450, 17, NAVY, { bold: true, spacing: 1 });
  g.text("VERIFICABLE", CX, 464, 7.5, CYAN, { bold: true, spacing: 0.8 });

  g.text(`Folio ${d.folio}   ·   Código de verificación ${d.code}`, CX, 528, 11, NAVY, { bold: true });
  g.text("Certificado de demostración generado con datos simulados. Sin validez académica oficial.", CX, 546, 9, GRAY);
  return g.ops.join("\n");
}

export function buildCertificatePdf(d: CertificateData): Uint8Array {
  const stream = content(d);
  const font = (name: string) => `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    font("Helvetica"),
    font("Helvetica-Bold"),
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    `<< /Title (${encode(`Certificado ${d.folio}`)}) /Producer (EduMaster.ai DEMO) >>`,
  ];
  let pdf = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets = objects.map((body, i) => { const at = pdf.length; pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; return at; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(pdf, (ch) => ch.charCodeAt(0) & 0xff);       // todo es de un byte: las posiciones coinciden
}

const blobUrl = (d: CertificateData) => URL.createObjectURL(new Blob([buildCertificatePdf(d).slice().buffer], { type: "application/pdf" }));

export function downloadCertificate(d: CertificateData): void {
  const a = document.createElement("a");
  a.href = blobUrl(d);
  a.download = `Certificado ${d.folio} - ${d.student}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
/** Abre el mismo PDF en una pestaña nueva para verlo antes de descargarlo. */
export function previewCertificate(d: CertificateData): void {
  const url = blobUrl(d);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
