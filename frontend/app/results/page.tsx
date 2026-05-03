"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";

interface StoredResult {
  decision: string;
  prediction: number;
  application: Record<string, unknown>;
}

export default function ResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<StoredResult | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("altolend_result");
    if (!raw) {
      router.replace("/");
      return;
    }
    try {
      setResult(JSON.parse(raw) as StoredResult);
    } catch {
      router.replace("/");
    }
  }, [router]);

  if (!result) {
    return null;
  }

  const approved = result.decision === "approved";

  return (
    <div className="flex flex-col flex-1">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a
            href="/"
            className="flex items-center gap-2 cursor-pointer transition-opacity duration-150 hover:opacity-80"
          >
            <Landmark className="h-7 w-7 text-primary" aria-hidden="true" />
            <span className="text-xl font-bold tracking-tight text-foreground">
              Altolend
            </span>
          </a>
        </div>
      </header>

      {/* ── Result Card ── */}
      <main className="flex flex-1 items-start justify-center px-4 pt-16 pb-20 sm:px-6 lg:px-8">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-8 text-center shadow-sm sm:p-12">
          {approved ? (
            <CheckCircle2
              className="mx-auto h-16 w-16 text-primary"
              aria-hidden="true"
            />
          ) : (
            <XCircle
              className="mx-auto h-16 w-16 text-error"
              aria-hidden="true"
            />
          )}

          <h1 className="mt-6 text-2xl font-bold text-foreground sm:text-3xl">
            Application {approved ? "Approved" : "Rejected"}
          </h1>
          <p className="mt-3 text-sm text-muted">
            {approved
              ? "Congratulations! Your loan application has been approved. A representative will reach out with next steps."
              : "Unfortunately, your application did not meet the approval criteria at this time. You may re-apply or contact support for guidance."}
          </p>

          <button
            onClick={() => router.push("/")}
            className="
              mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5
              text-sm font-semibold text-white cursor-pointer
              transition-colors duration-200 hover:bg-primary-hover
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
            "
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Application
          </button>
        </div>
      </main>
    </div>
  );
}
