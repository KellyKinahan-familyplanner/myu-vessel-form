import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BRENDON = process.env.BRENDON_EMAIL || "brendon@motoryachtsunlimited.com.au";

type Mail = { to: string; subject: string; html: string; replyTo?: string; filename: string; pdf: Buffer };

async function sendOne(m: Mail, key: string, from: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [m.to],
      reply_to: m.replyTo,
      subject: m.subject,
      html: m.html,
      attachments: [{ filename: m.filename, content: m.pdf.toString("base64") }],
    }),
  });
  if (!res.ok) throw new Error(`Email to ${m.to} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function deliverReport(opts: {
  pdf: Buffer; vessel: string; sellerName: string; sellerEmail?: string; sellerMobile?: string; filename: string;
}): Promise<{ emailed: boolean; note?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    // Dev fallback: keep the PDF on disk so nothing is lost
    const dir = path.join(process.cwd(), "outbox");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, opts.filename), opts.pdf);
    return { emailed: false, note: "Email is not configured yet, so the report was saved on the server instead. Brendon has not been emailed." };
  }
  const validSeller = opts.sellerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(opts.sellerEmail);
  await sendOne(
    {
      to: BRENDON,
      replyTo: validSeller ? opts.sellerEmail : undefined,
      subject: `Vessel condition report: ${opts.vessel} (${opts.sellerName})`,
      html: `<p>A seller has completed the vessel walkthrough for <strong>${esc(opts.vessel)}</strong>.</p>
<p>Seller: ${esc(opts.sellerName)}<br>Mobile: ${esc(opts.sellerMobile || "-")}<br>Email: ${esc(opts.sellerEmail || "-")}</p>
<p>The full report with photos is attached as a PDF.</p>`,
      filename: opts.filename,
      pdf: opts.pdf,
    },
    key, from,
  );
  if (validSeller) {
    await sendOne(
      {
        to: opts.sellerEmail!,
        replyTo: BRENDON,
        subject: `Your vessel report for ${opts.vessel}`,
        html: `<p>Hi ${esc(opts.sellerName)},</p>
<p>Thank you for completing the vessel walkthrough for <strong>${esc(opts.vessel)}</strong>. Your copy of the report is attached. Brendon has received his copy and will be in touch.</p>
<p>Myachts Unlimited</p>`,
        filename: opts.filename,
        pdf: opts.pdf,
      },
      key, from,
    );
    return { emailed: true };
  }
  return { emailed: true, note: "Brendon was emailed, but we could not send you a copy because your email address looked incomplete." };
}
