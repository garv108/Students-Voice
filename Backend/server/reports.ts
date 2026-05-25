/**
 * reports.ts
 * PDF report generation for StudentVoice using pdfmake 0.3.9
 *
 * IMPORTANT — pdfmake 0.3.x is a singleton, NOT a constructor.
 * require("pdfmake") returns the instance directly.
 * Do NOT use: new PdfPrinter(...) or require("pdfmake").PdfPrinter
 * Correct usage: see initPdfMake() below.
 */

import * as path from "path";
import * as fs from "fs";

// pdfmake 0.3.x exports a singleton instance — import as plain object
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfmake = require("pdfmake");

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReportType =
  | "ugc-annual"
  | "naac-ssr"
  | "icc-annual"
  | "anti-ragging"
  | "sc-st-cell";

export interface Complaint {
  status: string;           // "resolved" | "pending" | "in-progress" | "rejected" | "under-review"
  category: string;         // e.g. "Hostel", "Academic", "Infrastructure"
  severity: string;         // "Low" | "Medium" | "High" | "Critical"
  urgency: string;          // "Low" | "Medium" | "High" | "Critical"
  createdAt: Date | string;
  solved: boolean;
  solvedAt?: Date | string; // optional — used for resolution time calculation
}

// ─── One-time font initialisation ─────────────────────────────────────────────

let _fontsLoaded = false;

function initPdfMake(): void {
  if (_fontsLoaded) return;

  // Resolve fonts directory: handles both src/ and dist/ compilation targets
  const possiblePaths = [
    path.resolve(__dirname, "../node_modules/pdfmake/fonts/Roboto"),
    path.resolve(__dirname, "../../node_modules/pdfmake/fonts/Roboto"),
    path.resolve(__dirname, "node_modules/pdfmake/fonts/Roboto"),
    path.resolve(process.cwd(), "node_modules/pdfmake/fonts/Roboto"),
  ];
  const fontsDir = possiblePaths.find((p) => {
    try { return require("fs").existsSync(p); } catch { return false; }
  }) ?? possiblePaths[0];

  // Write font files into pdfmake's virtual file system
  const fontMap: Record<string, string> = {
    "Roboto-Regular.ttf":      path.join(fontsDir, "Roboto-Regular.ttf"),
    "Roboto-Medium.ttf":       path.join(fontsDir, "Roboto-Medium.ttf"),
    "Roboto-Italic.ttf":       path.join(fontsDir, "Roboto-Italic.ttf"),
    "Roboto-MediumItalic.ttf": path.join(fontsDir, "Roboto-MediumItalic.ttf"),
  };

  for (const [virtualName, diskPath] of Object.entries(fontMap)) {
    pdfmake.virtualfs.writeFileSync(virtualName, fs.readFileSync(diskPath));
  }

  // Register the font family
  pdfmake.addFonts({
    Roboto: {
      normal:      "Roboto-Regular.ttf",
      bold:        "Roboto-Medium.ttf",
      italics:     "Roboto-Italic.ttf",
      bolditalics: "Roboto-MediumItalic.ttf",
    },
  });

  // Disable external URL and local filesystem access (security best practice)
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy(() => false);

  _fontsLoaded = true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

/** Average resolution time in hours for solved complaints */
function avgResolutionHours(complaints: Complaint[]): number {
  const solved = complaints.filter(
    (c) => c.solved && c.solvedAt && c.createdAt
  );
  if (solved.length === 0) return 0;
  const totalMs = solved.reduce((sum, c) => {
    const created = toDate(c.createdAt).getTime();
    const resolvedAt = toDate(c.solvedAt!).getTime();
    return sum + Math.max(0, resolvedAt - created);
  }, 0);
  return Math.round(totalMs / solved.length / 3_600_000);
}

/** Count occurrences of each unique value in a field */
function countBy(
  complaints: Complaint[],
  field: keyof Complaint
): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of complaints) {
    const key = String(c[field] ?? "Unknown");
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return new Map([...map.entries()].sort((a, b) => b[1] - a[1]));
}

// ─── Report metadata ──────────────────────────────────────────────────────────

interface ReportMeta {
  title: string;
  subtitle: string;
  reference: string;  // e.g. "NAAC Criterion 5.1.3"
}

const REPORT_META: Record<ReportType, ReportMeta> = {
  "ugc-annual": {
    title: "Annual Grievance Redressal Report",
    subtitle: "University Grants Commission — Annual Submission",
    reference: "UGC (Grievance Redressal) Regulations 2012",
  },
  "naac-ssr": {
    title: "Student Grievance Redressal Report",
    subtitle: "NAAC Self Study Report — Criterion 5.1.3",
    reference: "NAAC Criterion 5.1.3 — Grievance Redressal Mechanism",
  },
  "icc-annual": {
    title: "Internal Complaints Committee Annual Report",
    subtitle: "POSH Act Compliance — Annual Report",
    reference: "Sexual Harassment of Women at Workplace Act 2013",
  },
  "anti-ragging": {
    title: "Anti-Ragging Committee Report",
    subtitle: "UGC Anti-Ragging Compliance Report",
    reference: "UGC Regulations on Curbing the Menace of Ragging 2009",
  },
  "sc-st-cell": {
    title: "SC/ST Cell Grievance Report",
    subtitle: "SC/ST Cell Annual Report",
    reference: "SC/ST (Prevention of Atrocities) Act 1989",
  },
};

// ─── pdfmake style definitions ────────────────────────────────────────────────

const STYLES = {
  reportTitle: {
    fontSize: 20,
    bold: true,
    color: "#1A3C5E",
    margin: [0, 0, 0, 4] as [number,number,number,number],
  },
  subtitle: {
    fontSize: 12,
    color: "#4B5563",
    margin: [0, 0, 0, 2] as [number,number,number,number],
  },
  reference: {
    fontSize: 9,
    color: "#6B7280",
    italics: true,
    margin: [0, 0, 0, 16] as [number,number,number,number],
  },
  sectionHeader: {
    fontSize: 13,
    bold: true,
    color: "#1E3A5F",
    margin: [0, 16, 0, 6] as [number,number,number,number],
  },
  tableHeader: {
    fontSize: 10,
    bold: true,
    color: "#FFFFFF",
    fillColor: "#2E75B6",
    alignment: "center" as const,
  },
  tableCell: {
    fontSize: 10,
    color: "#374151",
  },
  statLabel: {
    fontSize: 10,
    color: "#6B7280",
  },
  statValue: {
    fontSize: 18,
    bold: true,
    color: "#1A3C5E",
  },
  footerText: {
    fontSize: 8,
    color: "#9CA3AF",
    italics: true,
  },
};

// ─── Table builders ───────────────────────────────────────────────────────────

function breakdownTable(
  title: string,
  counts: Map<string, number>,
  total: number,
  headerLabel: string
): object {
  const rows = [...counts.entries()].map(([label, count]) => [
    { text: label,  style: "tableCell" },
    { text: count,  style: "tableCell", alignment: "center" },
    {
      text: total > 0 ? `${((count / total) * 100).toFixed(1)}%` : "0%",
      style: "tableCell",
      alignment: "center",
    },
  ]);

  return {
    stack: [
      { text: title, style: "sectionHeader" },
      {
        table: {
          headerRows: 1,
          widths: ["*", "auto", "auto"],
          body: [
            [
              { text: headerLabel, style: "tableHeader" },
              { text: "Count",     style: "tableHeader" },
              { text: "% Share",   style: "tableHeader" },
            ],
            ...rows,
          ],
        },
        layout: {
          fillColor: (rowIndex: number) =>
            rowIndex === 0 ? null : rowIndex % 2 === 0 ? "#F9FAFB" : null,
          hLineColor: () => "#E5E7EB",
          vLineColor: () => "#E5E7EB",
        },
      },
    ],
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate a PDF report buffer.
 *
 * @param type        - One of the five supported report types
 * @param complaints  - Array of complaint objects
 * @param collegeName - Optional institution name (shown in header)
 * @returns Promise<Buffer> — ready to pipe or send as response
 *
 * @example
 * const buf = await generateReport("naac-ssr", complaints, "NIT Jaipur");
 * res.setHeader("Content-Type", "application/pdf");
 * res.setHeader("Content-Disposition", `attachment; filename="naac-report.pdf"`);
 * res.send(buf);
 */
export async function generateReport(
  type: ReportType,
  complaints: Complaint[],
  collegeName?: string
): Promise<Buffer> {
  initPdfMake();   // idempotent — only runs once per process

  const meta   = REPORT_META[type];
  const now    = new Date();
  const total  = complaints.length;
  const resolved   = complaints.filter((c) => c.solved || c.status === "resolved").length;
  const pending    = complaints.filter((c) => c.status === "pending").length;
  const inProgress = complaints.filter(
    (c) => c.status === "in-progress" || c.status === "under-review"
  ).length;
  const avgHours = avgResolutionHours(complaints);

  const categoryBreakdown = countBy(complaints, "category");
  const severityBreakdown = countBy(complaints, "severity");
  const urgencyBreakdown  = countBy(complaints, "urgency");

  // ── Document definition ───────────────────────────────────────────────────

  const docDefinition = {
    pageSize:    "A4" as const,
    pageMargins: [40, 60, 40, 60] as [number,number,number,number],

    defaultStyle: {
      font:     "Roboto",
      fontSize: 10,
      color:    "#374151",
    },

    styles: STYLES,

    header: {
      columns: [
        {
          text: collegeName ?? "Institution Name",
          fontSize: 9,
          color: "#9CA3AF",
          margin: [40, 20, 0, 0],
        },
        {
          text: `Generated: ${formatDate(now)}`,
          fontSize: 9,
          color: "#9CA3AF",
          alignment: "right",
          margin: [0, 20, 40, 0],
        },
      ],
    },

    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        {
          text: "Generated by StudentVoice — Campus Grievance & Governance Platform",
          style: "footerText",
          margin: [40, 0, 0, 0],
        },
        {
          text: `Page ${currentPage} of ${pageCount}`,
          style: "footerText",
          alignment: "right",
          margin: [0, 0, 40, 0],
        },
      ],
    }),

    content: [
      // ── Header block ───────────────────────────────────────────────────────
      ...(collegeName
        ? [{ text: collegeName, fontSize: 11, color: "#6B7280", bold: true }]
        : []),
      { text: meta.title,    style: "reportTitle" },
      { text: meta.subtitle, style: "subtitle" },
      { text: meta.reference, style: "reference" },
      {
        canvas: [
          { type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#BFDBFE" },
        ],
        margin: [0, 0, 0, 16],
      },

      // ── Reporting period ──────────────────────────────────────────────────
      {
        text: `Reporting Period: ${
          complaints.length > 0
            ? `${formatDate(toDate(complaints.reduce((min, c) =>
                toDate(c.createdAt) < toDate(min.createdAt) ? c : min
              ).createdAt))} — ${formatDate(now)}`
            : `As of ${formatDate(now)}`
        }`,
        fontSize: 9,
        color: "#6B7280",
        margin: [0, 0, 0, 16],
      },

      // ── Summary statistics row ─────────────────────────────────────────────
      { text: "Executive Summary", style: "sectionHeader" },
      {
        columns: [
          {
            stack: [
              { text: String(total),      style: "statValue" },
              { text: "Total Grievances", style: "statLabel" },
            ],
            alignment: "center",
          },
          {
            stack: [
              { text: String(resolved),   style: "statValue", color: "#16A34A" },
              { text: "Resolved",          style: "statLabel" },
            ],
            alignment: "center",
          },
          {
            stack: [
              { text: String(pending),    style: "statValue", color: "#D97706" },
              { text: "Pending",           style: "statLabel" },
            ],
            alignment: "center",
          },
          {
            stack: [
              { text: String(inProgress), style: "statValue", color: "#2563EB" },
              { text: "In Progress",       style: "statLabel" },
            ],
            alignment: "center",
          },
          {
            stack: [
              {
                text: avgHours > 0 ? `${avgHours}h` : "N/A",
                style: "statValue",
                color: "#7C3AED",
              },
              { text: "Avg Resolution",   style: "statLabel" },
            ],
            alignment: "center",
          },
        ],
        margin: [0, 8, 0, 16],
      },

      // Resolution rate bar
      {
        stack: [
          {
            text: `Resolution Rate: ${
              total > 0 ? ((resolved / total) * 100).toFixed(1) : "0"
            }%`,
            fontSize: 10,
            bold: true,
            color: "#1A3C5E",
          },
          {
            canvas: [
              // Background bar
              { type: "rect", x: 0, y: 4, w: 515, h: 10, r: 4, color: "#E5E7EB" },
              // Filled bar
              {
                type: "rect",
                x: 0,
                y: 4,
                w: total > 0 ? Math.round((resolved / total) * 515) : 0,
                h: 10,
                r: 4,
                color: "#16A34A",
              },
            ],
          },
        ],
        margin: [0, 0, 0, 20],
      },

      // ── Breakdown tables ──────────────────────────────────────────────────
      ...(categoryBreakdown.size > 0
        ? [breakdownTable("Category Breakdown", categoryBreakdown, total, "Category")]
        : []),

      ...(severityBreakdown.size > 0
        ? [breakdownTable("Severity Breakdown", severityBreakdown, total, "Severity Level")]
        : []),

      ...(urgencyBreakdown.size > 0
        ? [breakdownTable("Urgency Breakdown", urgencyBreakdown, total, "Urgency Level")]
        : []),

      // ── Compliance note ────────────────────────────────────────────────────
      {
        canvas: [
          { type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#BFDBFE" },
        ],
        margin: [0, 20, 0, 12],
      },
      {
        text: "Compliance Note",
        style: "sectionHeader",
      },
      {
        text:
          "This report has been auto-generated by the StudentVoice campus governance platform. " +
          "All data is derived from verified, timestamped student submissions. " +
          "This document should be reviewed and signed by the authorised institutional representative " +
          "before formal submission to the relevant regulatory authority.",
        fontSize: 9,
        color: "#6B7280",
        italics: true,
        margin: [0, 0, 0, 8],
      },
      {
        text: `Regulatory Reference: ${meta.reference}`,
        fontSize: 9,
        color: "#6B7280",
        italics: true,
      },
    ],
  };

  // ── Render to buffer ───────────────────────────────────────────────────────
  const pdfDoc = pdfmake.createPdf(docDefinition);
  return pdfDoc.getBuffer();
}