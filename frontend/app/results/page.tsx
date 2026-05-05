"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Landmark,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
  Lightbulb,
  RotateCcw,
} from "lucide-react";

interface Application {
  no_of_dependents: number;
  education: string;
  self_employed: string;
  income_annum: number;
  loan_amount: number;
  loan_term: number;
  cibil_score: number;
  residential_assets_value: number;
  commercial_assets_value: number;
  luxury_assets_value: number;
  bank_asset_value: number;
}

interface StoredResult {
  decision: string;
  prediction: number;
  application: Application;
}

const API_BASE = "http://localhost:8000";

const PLACEHOLDER_CUSTOMER = {
  full_name: "Applicant",
  email: "applicant@altolend.com",
};

const UNDER_REVIEW_MSG =
  "Your application is under review. A representative will contact you shortly.";

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/^\d+\.\s+/gm, (m) => m)
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1");
}

export default function ResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<StoredResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailText, setEmailText] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [error, setError] = useState("");

  const runPipeline = useCallback(async (data: StoredResult) => {
    try {
      const emailRes = await fetch(`${API_BASE}/generate-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: data.decision,
          customer: PLACEHOLDER_CUSTOMER,
          application: data.application,
        }),
      });
      if (!emailRes.ok) throw new Error("Failed to generate email");
      const { email_text } = await emailRes.json();

      const biasRes = await fetch(`${API_BASE}/check-bias`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_text }),
      });
      if (!biasRes.ok) throw new Error("Failed to run bias check");
      const biasData = await biasRes.json();

      setEmailText(biasData.passed ? email_text : UNDER_REVIEW_MSG);

      if (data.decision === "rejected") {
        const nboRes = await fetch(`${API_BASE}/next-best-offer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: data.decision,
            customer: PLACEHOLDER_CUSTOMER,
            application: data.application,
          }),
        });
        if (!nboRes.ok) throw new Error("Failed to get next best offer");
        const { recommendation: rec } = await nboRes.json();
        setRecommendation(rec);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong processing your results.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("altolend_result");
    if (!raw) {
      router.replace("/");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as StoredResult;
      setResult(parsed);
      runPipeline(parsed);
    } catch {
      router.replace("/");
    }
  }, [router, runPipeline]);

  function handleNewApplication() {
    localStorage.removeItem("altolend_result");
    router.push("/");
  }

  if (!result) return null;

  const approved = result.decision === "approved";

  return (
    <div className="flex flex-col flex-1">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 bg-primary">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a
            href="/"
            className="flex items-center gap-2.5 cursor-pointer transition-opacity duration-150 hover:opacity-80"
          >
            <Landmark className="h-6 w-6 text-cta" aria-hidden="true" />
            <span className="text-lg font-bold tracking-tight text-white">
              Altolend
            </span>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-medium sm:flex">
            <a
              href="#"
              className="cursor-pointer text-white/70 transition-colors duration-150 hover:text-white"
            >
              Products
            </a>
            <a
              href="#"
              className="cursor-pointer text-white/70 transition-colors duration-150 hover:text-white"
            >
              About
            </a>
            <a
              href="#"
              className="cursor-pointer text-white/70 transition-colors duration-150 hover:text-white"
            >
              Contact
            </a>
          </nav>

          <a
            href="/"
            className="hidden items-center gap-1.5 rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-primary cursor-pointer transition-colors duration-200 hover:bg-cta-hover sm:inline-flex"
          >
            Get Started
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 pb-24 pt-12 sm:pt-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2
                className="h-10 w-10 animate-spin text-secondary"
                aria-hidden="true"
              />
              <p className="mt-5 text-sm font-medium text-muted">
                Processing your application results…
              </p>
              <p className="mt-1.5 text-xs text-muted/60">
                Generating decision email and running compliance checks
              </p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-error/30 bg-error-light p-8 text-center">
              <XCircle className="mx-auto h-12 w-12 text-error" aria-hidden="true" />
              <p className="mt-4 text-sm font-medium text-error">{error}</p>
              <button
                onClick={handleNewApplication}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white cursor-pointer transition-colors duration-200 hover:bg-primary-hover"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Start New Application
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* ── Decision Badge ── */}
              <div className="flex flex-col items-center text-center">
                <div
                  className={`inline-flex h-20 w-20 items-center justify-center rounded-full ${
                    approved
                      ? "bg-emerald-50 ring-1 ring-emerald-200"
                      : "bg-red-50 ring-1 ring-red-200"
                  }`}
                >
                  {approved ? (
                    <CheckCircle2
                      className="h-10 w-10 text-emerald-600"
                      aria-hidden="true"
                    />
                  ) : (
                    <XCircle
                      className="h-10 w-10 text-red-600"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <h1 className="mt-5 text-2xl font-bold text-foreground sm:text-3xl">
                  Application{" "}
                  <span className={approved ? "text-emerald-600" : "text-red-600"}>
                    {approved ? "Approved" : "Rejected"}
                  </span>
                </h1>
                <p className="mt-2 max-w-md text-sm text-muted">
                  {approved
                    ? "Congratulations! Your loan application has been approved."
                    : "Unfortunately, your application did not meet the approval criteria at this time."}
                </p>
              </div>

              {/* ── Email Card ── */}
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-[0_4px_32px_rgba(0,0,0,0.06)] sm:p-8">
                <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/10">
                    <Mail className="h-4.5 w-4.5 text-secondary" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      Decision Notification
                    </h2>
                    <p className="text-xs text-muted">
                      From: notifications@altolend.com
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-surface-alt p-5 sm:p-6">
                  <div className="mb-4 flex items-center justify-between border-b border-border pb-3 text-xs text-muted">
                    <span>To: applicant@altolend.com</span>
                    <span>Today</span>
                  </div>
                  <div className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                    {stripMarkdown(emailText)}
                  </div>
                </div>
              </div>

              {/* ── Next Best Offer Card (rejected only) ── */}
              {!approved && recommendation && (
                <div className="rounded-2xl border border-cta/30 bg-cta-light p-6 shadow-[0_4px_32px_rgba(0,0,0,0.06)] sm:p-8">
                  <div className="mb-5 flex items-center gap-3 border-b border-cta/20 pb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cta/15">
                      <Lightbulb className="h-4.5 w-4.5 text-cta-hover" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-foreground">
                        Alternative Options For You
                      </h2>
                      <p className="text-xs text-muted-strong">
                        Based on your application profile
                      </p>
                    </div>
                  </div>
                  <div className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                    {stripMarkdown(recommendation)}
                  </div>
                </div>
              )}

              {/* ── Start New Application ── */}
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleNewApplication}
                  className="
                    flex items-center gap-2 rounded-lg bg-primary px-6 py-3
                    text-sm font-semibold text-white cursor-pointer shadow-sm
                    transition-all duration-200
                    hover:bg-primary-hover hover:shadow-md
                    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary
                  "
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Start New Application
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 text-xs text-muted sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="font-medium text-foreground">Altolend</span>
          </div>
          <p>© {new Date().getFullYear()} Altolend, Inc. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a
              href="#"
              className="cursor-pointer transition-colors duration-150 hover:text-foreground"
            >
              Privacy
            </a>
            <a
              href="#"
              className="cursor-pointer transition-colors duration-150 hover:text-foreground"
            >
              Terms
            </a>
            <a
              href="#"
              className="cursor-pointer transition-colors duration-150 hover:text-foreground"
            >
              Security
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
