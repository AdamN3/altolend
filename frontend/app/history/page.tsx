"use client";

import { useState, useEffect } from "react";

interface LoanApplicationInput {
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

interface StoredApplication {
  id: number;
  timestamp_utc: string;
  applicant_email: string | null;
  input_data: LoanApplicationInput;
  decision: string;
  prediction: number;
}

const API_BASE = "http://localhost:8000";
const CORRECT_PASSWORD = "1597";

const PLACEHOLDER_CUSTOMER = {
  full_name: "Applicant",
  email: "applicant@altolend.com",
};

function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState(false);

  const [applications, setApplications] = useState<StoredApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const [expandedEmails, setExpandedEmails] = useState<Record<number, string>>(
    {},
  );
  const [loadingEmails, setLoadingEmails] = useState<Record<number, boolean>>(
    {},
  );

  function handleLogin() {
    if (password === CORRECT_PASSWORD) {
      setAuthenticated(true);
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleLogin();
  }

  useEffect(() => {
    if (!authenticated) return;
    setLoading(true);
    fetch(`${API_BASE}/applications`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        return res.json();
      })
      .then((data: StoredApplication[]) => setApplications(data))
      .catch((err) =>
        setFetchError(
          err instanceof Error ? err.message : "Failed to load applications.",
        ),
      )
      .finally(() => setLoading(false));
  }, [authenticated]);

  async function toggleEmail(app: StoredApplication) {
    if (expandedEmails[app.id] !== undefined) {
      setExpandedEmails((prev) => {
        const next = { ...prev };
        delete next[app.id];
        return next;
      });
      return;
    }

    setLoadingEmails((prev) => ({ ...prev, [app.id]: true }));
    try {
      const res = await fetch(`${API_BASE}/generate-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: app.decision,
          customer: PLACEHOLDER_CUSTOMER,
          application: app.input_data,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate email");
      const { email_text } = await res.json();
      setExpandedEmails((prev) => ({ ...prev, [app.id]: email_text }));
    } catch {
      setExpandedEmails((prev) => ({
        ...prev,
        [app.id]: "Error generating email. Please try again.",
      }));
    } finally {
      setLoadingEmails((prev) => ({ ...prev, [app.id]: false }));
    }
  }

  /* ── Password Gate ── */
  if (!authenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-primary px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Admin Access
            </h1>
            <p className="mt-2 text-sm text-white/50">
              Enter the admin password to continue.
            </p>
          </div>

          <div className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (authError) setAuthError(false);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Password"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-all duration-150 focus:border-[#F59E0B]/60 focus:ring-2 focus:ring-[#F59E0B]/20"
            />

            {authError && (
              <p className="text-sm font-medium text-red-400">Access denied</p>
            )}

            <button
              onClick={handleLogin}
              className="w-full cursor-pointer rounded-lg bg-[#F59E0B] py-3 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-[#D97706]"
            >
              Enter
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Authenticated Dashboard ── */
  return (
    <div className="flex min-h-screen flex-col bg-primary">
      {/* Banner */}
      <div className="border-b border-white/10 bg-white/[0.03]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <h1 className="text-sm font-semibold tracking-wide text-white/80">
            Admin Dashboard{" "}
            <span className="text-white/30">&mdash;</span>{" "}
            <span className="text-white/50">Application History</span>
          </h1>
          <a
            href="/"
            className="text-xs font-medium text-[#F59E0B] transition-colors duration-150 hover:text-[#D97706]"
          >
            Back to site
          </a>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#F59E0B]" />
              <p className="mt-4 text-sm text-white/40">
                Loading applications…
              </p>
            </div>
          ) : fetchError ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300">
              {fetchError}
            </div>
          ) : applications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="text-4xl text-white/20">&#8709;</div>
              <p className="mt-4 text-sm font-medium text-white/40">
                No applications yet
              </p>
              <p className="mt-1 text-xs text-white/25">
                Submitted applications will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03]">
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-white/40">
                      Date
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-white/40">
                      Loan Amount
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-white/40">
                      Decision
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-white/40">
                      Email
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {applications.map((app) => (
                    <TableRow
                      key={app.id}
                      app={app}
                      emailContent={expandedEmails[app.id]}
                      emailLoading={loadingEmails[app.id] ?? false}
                      onToggleEmail={() => toggleEmail(app)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TableRow({
  app,
  emailContent,
  emailLoading,
  onToggleEmail,
}: {
  app: StoredApplication;
  emailContent: string | undefined;
  emailLoading: boolean;
  onToggleEmail: () => void;
}) {
  const approved = app.decision === "approved";
  const expanded = emailContent !== undefined;

  return (
    <>
      <tr className="transition-colors duration-100 hover:bg-white/[0.02]">
        <td className="whitespace-nowrap px-5 py-4 text-white/70">
          {formatDate(app.timestamp_utc)}
        </td>
        <td className="whitespace-nowrap px-5 py-4 font-medium text-white/90">
          {formatUSD(app.input_data.loan_amount)}
        </td>
        <td className="px-5 py-4">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              approved
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {approved ? "Approved" : "Rejected"}
          </span>
        </td>
        <td className="px-5 py-4">
          <button
            onClick={onToggleEmail}
            disabled={emailLoading}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition-all duration-150 hover:border-white/20 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {emailLoading ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border border-white/20 border-t-[#F59E0B]" />
                Generating…
              </>
            ) : expanded ? (
              "Hide Email"
            ) : (
              "View Email"
            )}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} className="bg-white/[0.02] px-5 py-4">
            <div className="whitespace-pre-line rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-white/70">
              {emailContent}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
