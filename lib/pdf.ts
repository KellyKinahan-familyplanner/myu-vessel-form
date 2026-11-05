import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { BAD_RATINGS, DECLARATION_TEXT, SECTIONS, UNSURE, itemVisible, sectionVisible } from "./form";
import type { CustomInclusion, RatingAnswer, Section, Answers } from "./types";

export type PdfPhoto = { sectionId: string; caption: string; buf: Buffer };
export type PdfInput = {
  answers: Answers;
  customInclusions?: CustomInclusion[];
  photos: PdfPhoto[];
  declarationName: string;
  declarationAgreed: boolean;
};

const NAVY = "#23282d";
const BRASS = "#1389d3";
const BLUE = "#0075c2";
const LOGO = path.join(process.cwd(), "public", "myu-logo-horizontal.jpg");
const GREY = "#5b6770";
const LIGHT = "#eef2f6";
const RED = "#b3261e";
const GREEN = "#1f7a4d";
const AMBER = "#a86a00";

const clean = (t: unknown) =>
  String(t ?? "")
    .replace(/[^\u0020-\u007e\u00a0-\u00ff\u2018-\u201d\u2013\u2014\u2026\u2022\n]/g, "?")
    .trim();


export async function buildPdf(state: PdfInput, meta: { submittedAt: Date; sellerName?: string }): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margins: { top: 72, bottom: 60, left: 48, right: 48 }, bufferPages: true, info: { Title: "Vessel Condition Report", Author: "Myachts Unlimited" } });
  const FONT_DIR = path.join(process.cwd(), "node_modules", "@fontsource", "rubik", "files");
  let rubik = true;
  try {
    doc.registerFont("Rubik", fs.readFileSync(path.join(FONT_DIR, "rubik-latin-400-normal.woff")));
    doc.registerFont("Rubik-Bold", fs.readFileSync(path.join(FONT_DIR, "rubik-latin-700-normal.woff")));
  } catch {
    rubik = false; // fall back to built-in Helvetica
  }
  const F_REG = rubik ? "Rubik" : "Helvetica";
  const F_BOLD = rubik ? "Rubik-Bold" : "Helvetica-Bold";
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const finished = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  const a = state.answers;
  const str = (id: string) => {
    const v = a[id];
    return typeof v === "string" ? clean(v) : "";
  };
  const W = doc.page.width - 96;
  const L = 48;
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  const need = (h: number) => {
    if (doc.y + h > bottom()) doc.addPage();
  };

  const vessel = str("vesselName") || "Unnamed vessel";

  // ---- cover ----
  doc.image(LOGO, L, 48, { width: 300 });
  doc.rect(0, 150, doc.page.width, 4).fill(BRASS);
  doc.fillColor(NAVY).font(F_REG).fontSize(30).text("Vessel Condition Report", L, 190);
  doc.font(F_BOLD).fontSize(20).fillColor(BLUE).text(clean(vessel), L, 238);
  doc.font(F_REG).fontSize(11).fillColor(GREY).text(
    clean([str("make"), str("model"), str("year")].filter(Boolean).join("  ·  ")), L, 270,
  );
  doc.fillColor(NAVY).fontSize(11);
  doc.y = 320;
  kv("Seller", str("sellerName") || meta.sellerName || "-");
  kv("Mobile", str("sellerMobile") || "-");
  kv("Email", str("sellerEmail") || "-");
  kv("Berth", str("berth") || "-");
  kv("Hull ID / reg.", str("hin") || "-");
  kv("Asking price", str("askingPrice") || "-");
  kv("Vessel type", [str("vesselType"), str("vesselTypeOther")].filter(Boolean).join(": ") || "-");
  kv("Submitted", meta.submittedAt.toLocaleString("en-AU", { timeZone: "Australia/Perth", dateStyle: "long", timeStyle: "short" }) + " (AWST)");
  doc.moveDown(1.2);
  doc.font(F_REG).fontSize(9).fillColor(GREY).text(
    "This report is a seller’s declaration prepared by the vessel’s owner. It is not a survey or an inspection by Myachts Unlimited, and has not been independently verified.",
    L, doc.y, { width: W },
  );

  function kv(k: string, v: string) {
    const y = doc.y;
    doc.font(F_BOLD).fontSize(10).fillColor(GREY).text(k.toUpperCase(), L, y, { width: 110, characterSpacing: 0.5 });
    doc.font(F_REG).fontSize(11).fillColor(NAVY).text(clean(v), L + 120, y, { width: W - 120 });
    doc.moveDown(0.5);
  }

  // ---- attention summary ----
  const flagged: { section: string; label: string; rating: string; note: string }[] = [];
  for (const sec of SECTIONS) {
    if (!sectionVisible(sec, a)) continue;
    for (const c of sec.checks ?? []) {
      const r = a[c.id] as RatingAnswer | undefined;
      if (r?.rating && (BAD_RATINGS.includes(r.rating) || r.rating === UNSURE)) {
        flagged.push({ section: sec.title, label: c.label, rating: r.rating, note: clean(r.note) });
      }
    }
  }
  doc.addPage();
  heading("Items needing attention or confirmation", true);
  if (flagged.length === 0) {
    doc.font(F_REG).fontSize(10).fillColor(GREY).text("No items were marked as not working, not supplied or not sure. See Known issues and disclosures for any other disclosed faults.", L, doc.y, { width: W });
  } else {
    for (const f of flagged) {
      need(48);
      doc.font(F_BOLD).fontSize(10).fillColor(f.rating === UNSURE ? AMBER : RED).text(clean(f.section).toUpperCase() + "  ·  " + clean(f.rating).toUpperCase(), L, doc.y, { characterSpacing: 0.5 });
      doc.font(F_BOLD).fontSize(11).fillColor(NAVY).text(clean(f.label), L, doc.y, { width: W });
      doc.font(F_REG).fontSize(10).fillColor("#222").text(f.note || "No description given.", L, doc.y, { width: W });
      doc.moveDown(0.7);
    }
  }
  const issues = ["knownFaults", "pastRepairs", "leftOut"].map((id) => ({ id, v: str(id) })).filter((x) => x.v);
  if (issues.length) {
    doc.moveDown(0.5);
    heading("Disclosures", false);
    for (const x of issues) {
      const label = SECTIONS.flatMap((s) => s.items).find((i) => i.id === x.id)?.label ?? x.id;
      field(label, x.v);
    }
  }

  // ---- condition sections ----
  for (const sec of SECTIONS) {
    if (!sectionVisible(sec, a) || sec.marketing || sec.id === "issues") continue;
    startSection((sec.part ? sec.part + ": " : "") + sec.title);
    renderItems(sec);
    renderPhotos(sec.id);
  }

  // ---- marketing ----
  for (const sec of SECTIONS) {
    if (!sec.marketing || !sectionVisible(sec, a)) continue;
    startSection(sec.title);
    doc.font(F_REG).fontSize(9).fillColor(GREY).text("Marketing material. Not part of the condition declaration.", L, doc.y, { width: W });
    doc.moveDown(0.6);
    renderItems(sec);
    renderPhotos(sec.id);
  }

  // ---- known issues photos ----
  const issuesSec = SECTIONS.find((s) => s.id === "issues")!;
  if (state.photos.some((p) => p.sectionId === "issues")) {
    startSection("Photos: faults and defects");
    renderPhotos(issuesSec.id);
  }

  // ---- declaration ----
  doc.addPage();
  heading("Seller’s declaration", true);
  doc.font(F_REG).fontSize(10.5).fillColor("#222").text(clean(DECLARATION_TEXT), L, doc.y, { width: W, lineGap: 2 });
  doc.moveDown(1.2);
  kv("Signed (typed)", state.declarationName || "-");
  kv("Date", meta.submittedAt.toLocaleString("en-AU", { timeZone: "Australia/Perth", dateStyle: "long", timeStyle: "short" }) + " (AWST)");
  kv("Declaration confirmed", state.declarationAgreed ? "Yes" : "No");

  // ---- header / footer on every page ----
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    if (i > 0) {
      doc.image(LOGO, L, 14, { height: 28 });
      doc.rect(0, 50, doc.page.width, 2).fill(BRASS);
      doc.fillColor(GREY).font(F_BOLD).fontSize(9).text(clean(vessel), L, 24, { width: W, align: "right", lineBreak: false });
    }
    doc.fillColor(GREY).font(F_REG).fontSize(8).text(`Seller’s declaration, not a survey  ·  Page ${i + 1} of ${range.count}`, L, doc.page.height - 36, { width: W, align: "center", lineBreak: false });
  }

  doc.end();
  return finished;

  // ---- helpers ----
  function startSection(t: string) {
    if (doc.y > bottom() - 180) doc.addPage();
    else doc.moveDown(1.6);
    heading(t, true);
  }
  function heading(t: string, big: boolean) {
    need(50);
    if (big) {
      doc.font(F_BOLD).fontSize(18).fillColor(NAVY).text(clean(t), L, doc.y);
      doc.rect(L, doc.y + 2, 48, 3).fill(BRASS);
      doc.y += 14;
    } else {
      doc.font(F_BOLD).fontSize(12).fillColor(NAVY).text(clean(t), L, doc.y);
      doc.moveDown(0.3);
    }
  }
  function field(label: string, value: string) {
    need(36);
    doc.font(F_BOLD).fontSize(9.5).fillColor(GREY).text(clean(label), L, doc.y, { width: W });
    doc.font(F_REG).fontSize(10.5).fillColor("#222").text(clean(value), L, doc.y, { width: W });
    doc.moveDown(0.6);
  }
  function renderRow(label: string, hint: string | undefined, r: RatingAnswer | undefined) {
    const rating = r?.rating ?? "Not answered";
    const col = ["Working", "Supplied", "Yes"].includes(rating) ? GREEN : BAD_RATINGS.includes(rating) ? RED : rating === "Not answered" || rating === "N/A" ? GREY : AMBER;
    const note = clean(r?.note);
    const h = doc.heightOfString(clean(label), { width: W - 130 }) + (note ? doc.heightOfString(note, { width: W - 130 }) : 0) + 14;
    need(Math.min(h, 120));
    const y = doc.y;
    doc.font(F_BOLD).fontSize(10).fillColor(NAVY).text(clean(label), L, y, { width: W - 130 });
    doc.font(F_BOLD).fontSize(9).fillColor(col).text(rating.toUpperCase(), L + W - 120, y, { width: 120, align: "right", characterSpacing: 0.4 });
    doc.y = Math.max(doc.y, y + 12);
    if (note) doc.font(F_REG).fontSize(10).fillColor("#222").text(note, L, doc.y, { width: W - 130 });
    doc.moveDown(0.4);
    doc.moveTo(L, doc.y).lineTo(L + W, doc.y).lineWidth(0.4).strokeColor("#d5dbe0").stroke();
    doc.moveDown(0.4);
  }
  function renderItems(sec: Section) {
    for (const c of sec.checks ?? []) {
      renderRow(c.label, c.hint, (typeof a[c.id] === "object" ? a[c.id] : undefined) as RatingAnswer | undefined);
    }
    for (const it of sec.items) {
      if (!itemVisible(it, a)) continue;
      const v = a[it.id];
      const val = typeof v === "string" && v.trim() ? v : "Not answered";
      field(it.label, val);
    }
  }
  function renderPhotos(sectionId: string) {
    const mine = state.photos.filter((p) => p.sectionId === sectionId);
    if (!mine.length) return;
    doc.moveDown(0.6);
    need(30);
    doc.font(F_BOLD).fontSize(11).fillColor(NAVY).text("Photos", L, doc.y);
    doc.moveDown(0.3);
    const cw = (W - 12) / 2;
    const ch = cw * 0.72;
    for (let i = 0; i < mine.length; i += 2) {
      need(ch + 30);
      const y = doc.y;
      for (let j = 0; j < 2 && i + j < mine.length; j++) {
        const p = mine[i + j];
        const x = L + j * (cw + 12);
        const buf: Buffer | null = p.buf && p.buf.length > 0 ? p.buf : null;
        doc.rect(x, y, cw, ch).fill(LIGHT);
        if (buf) {
          try {
            doc.image(buf, x, y, { fit: [cw, ch], align: "center", valign: "center" });
          } catch {}
        }
        doc.font(F_REG).fontSize(8.5).fillColor(GREY).text(clean(p.caption) || " ", x, y + ch + 3, { width: cw, lineBreak: false, ellipsis: true });
      }
      doc.y = y + ch + 20;
    }
  }
}
