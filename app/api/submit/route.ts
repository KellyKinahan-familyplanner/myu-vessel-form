import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { edge } from "@/lib/edge";
import { buildPdf, type PdfPhoto } from "@/lib/pdf";
import { deliverReport } from "@/lib/email";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = body?.token;
  if (typeof token !== "string") return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    // 1. mark submitted (also promotes the contact to a seller) and get everything stored so far
    const sub = await edge("submit", token);
    if (!sub.ok) return NextResponse.json({ error: sub.data.error || "Submission failed" }, { status: sub.status });
    const d = sub.data as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    // 2. photos (stored privately; fetched with short-lived links)
    const photos: PdfPhoto[] = [];
    for (const p of d.photos as { url: string | null; section: string; caption: string }[]) {
      if (!p.url) continue;
      const r = await fetch(p.url);
      if (r.ok) photos.push({ sectionId: p.section, caption: p.caption ?? "", buf: Buffer.from(await r.arrayBuffer()) });
    }

    // 3. build the PDF
    const answers = (d.answers ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const str = (k: string) => (typeof answers[k] === "string" ? (answers[k] as string) : "");
    const submittedAt = new Date(d.submitted_at ?? Date.now());
    const pdf = await buildPdf(
      {
        answers, customInclusions: d.extras?.customInclusions ?? [], photos,
        declarationName: d.declaration_name ?? "", declarationAgreed: !!d.declaration_agreed,
      },
      { submittedAt, sellerName: str("sellerName") },
    );

    // 4. save the PDF to the customer's record, then log it on their timeline
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const up = await sb.storage.from("crm-files").uploadToSignedUrl(d.pdf_path, d.pdf_upload_token, pdf, { contentType: "application/pdf" });
    if (up.error) throw new Error("PDF upload failed: " + up.error.message);
    const fin = await edge("finalise", token);
    if (!fin.ok) throw new Error("Finalise failed");

    // 5. email Brendon + the seller (never blocks the save)
    const vessel = str("vesselName") || "Vessel";
    const safe = vessel.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "vessel";
    let result: { emailed: boolean; note?: string };
    try {
      result = await deliverReport({
        pdf, vessel, sellerName: str("sellerName") || "Seller", sellerEmail: str("sellerEmail"), sellerMobile: str("sellerMobile"),
        filename: `MYU-Vessel-Report-${safe}-${submittedAt.toISOString().slice(0, 10)}.pdf`,
      });
    } catch (e) {
      console.error("email failed", e);
      result = { emailed: false, note: "Your report has been saved. The email copy could not be sent, but Brendon can see it in the system." };
    }
    return NextResponse.json({ ...result, saved: true });
  } catch (e) {
    console.error("submit failed", e);
    return NextResponse.json({ error: "We couldn’t finish submitting. Your answers are saved. Please try again in a moment." }, { status: 500 });
  }
}
