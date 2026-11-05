import Walkthrough from "@/components/Walkthrough";
import { edge } from "@/lib/edge";

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="shell">
      <main className="card center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo-hero" src="/myu-logo-horizontal.jpg" alt="Myachts Unlimited" />
        <h1>{title}</h1>
        <p className="muted">{text}</p>
      </main>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = decodeURIComponent(token);
  let r;
  try {
    r = await edge("load", t);
  } catch {
    return <Notice title="We can’t load this page right now" text="Please check your connection and try again in a moment." />;
  }
  if (!r.ok) return <Notice title="This link isn’t valid" text="It may have expired or been copied incorrectly. Please contact Brendon for a new link." />;
  if (r.data.submitted) return <Notice title="Already submitted" text="Thank you. This report has already been sent to Brendon. If you need to change anything, please contact him." />;
  return <Walkthrough token={t} initial={r.data} />;
}
