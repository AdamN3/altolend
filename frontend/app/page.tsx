"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Landmark,
  ShieldCheck,
  Clock,
  Lock,
  Loader2,
  ChevronDown,
  ArrowRight,
} from "lucide-react";

const FIELD_DEFS = [
  {
    name: "no_of_dependents",
    label: "Number of Dependents",
    type: "number",
    placeholder: "e.g. 2",
  },
  {
    name: "education",
    label: "Education",
    type: "select",
    options: ["Graduate", "Not Graduate"],
    placeholder: "Select education level",
  },
  {
    name: "self_employed",
    label: "Self Employed",
    type: "select",
    options: ["Yes", "No"],
    placeholder: "Select employment status",
  },
  {
    name: "income_annum",
    label: "Annual Income",
    type: "number",
    placeholder: "e.g. 5000000",
  },
  {
    name: "loan_amount",
    label: "Loan Amount Requested",
    type: "number",
    placeholder: "e.g. 15000000",
  },
  {
    name: "loan_term",
    label: "Loan Term (Months)",
    type: "number",
    placeholder: "e.g. 12",
  },
  {
    name: "cibil_score",
    label: "Credit Score",
    type: "number",
    placeholder: "300 – 900",
    min: 300,
    max: 900,
  },
  {
    name: "residential_assets_value",
    label: "Residential Assets Value",
    type: "number",
    placeholder: "e.g. 5000000",
  },
  {
    name: "commercial_assets_value",
    label: "Commercial Assets Value",
    type: "number",
    placeholder: "e.g. 3000000",
  },
  {
    name: "luxury_assets_value",
    label: "Luxury Assets Value",
    type: "number",
    placeholder: "e.g. 2000000",
  },
  {
    name: "bank_asset_value",
    label: "Bank Asset Value",
    type: "number",
    placeholder: "e.g. 4000000",
  },
] as const;

type FieldName = (typeof FIELD_DEFS)[number]["name"];
type FormData = Record<FieldName, string>;
type FormErrors = Partial<Record<FieldName, string>>;

const INITIAL: FormData = {
  no_of_dependents: "",
  education: "",
  self_employed: "",
  income_annum: "",
  loan_amount: "",
  loan_term: "",
  cibil_score: "",
  residential_assets_value: "",
  commercial_assets_value: "",
  luxury_assets_value: "",
  bank_asset_value: "",
};

function validate(data: FormData): FormErrors {
  const errors: FormErrors = {};

  for (const field of FIELD_DEFS) {
    const val = data[field.name].trim();
    if (!val) {
      errors[field.name] = `${field.label} is required`;
      continue;
    }
    if (field.type === "number") {
      const n = Number(val);
      if (Number.isNaN(n)) {
        errors[field.name] = `${field.label} must be a number`;
      } else if ("min" in field && field.min !== undefined && n < field.min) {
        errors[field.name] = `Minimum value is ${field.min}`;
      } else if ("max" in field && field.max !== undefined && n > field.max) {
        errors[field.name] = `Maximum value is ${field.max}`;
      }
    }
  }
  return errors;
}

function buildPayload(data: FormData) {
  return {
    no_of_dependents: Number(data.no_of_dependents),
    education: data.education,
    self_employed: data.self_employed,
    income_annum: Number(data.income_annum),
    loan_amount: Number(data.loan_amount),
    loan_term: Number(data.loan_term),
    cibil_score: Number(data.cibil_score),
    residential_assets_value: Number(data.residential_assets_value),
    commercial_assets_value: Number(data.commercial_assets_value),
    luxury_assets_value: Number(data.luxury_assets_value),
    bank_asset_value: Number(data.bank_asset_value),
  };
}

export default function Home() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  function onChange(name: FieldName, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    const payload = buildPayload(form);

    try {
      const res = await fetch("http://localhost:8000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.detail ?? `Server responded with status ${res.status}`,
        );
      }

      const result = await res.json();
      localStorage.setItem(
        "altolend_result",
        JSON.stringify({ ...result, application: payload }),
      );
      router.push("/results");
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      setSubmitting(false);
    }
  }

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
            href="#apply"
            className="hidden items-center gap-1.5 rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-primary cursor-pointer transition-colors duration-200 hover:bg-cta-hover sm:inline-flex"
          >
            Get Started
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-primary">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-7xl px-4 pb-28 pt-16 sm:px-6 sm:pb-36 sm:pt-24 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold tracking-widest text-cta uppercase">
              Fast, fair, transparent
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Apply for a Loan
              <br />
              in Minutes
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/60">
              Instant decisions powered by machine learning. No long waits, no
              hidden criteria — just transparent lending built on trust.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 text-sm text-white/50">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-cta" aria-hidden="true" />
                Bank-grade encryption
              </span>
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-cta" aria-hidden="true" />
                Results in seconds
              </span>
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-cta" aria-hidden="true" />
                SOC 2 compliant
              </span>
            </div>
          </div>
        </div>

        {/* Curved transition into light section */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg
            viewBox="0 0 1440 56"
            fill="none"
            className="block w-full"
            preserveAspectRatio="none"
          >
            <path
              d="M0 56h1440V28C1200 0 240 0 0 28v28Z"
              className="fill-background"
            />
          </svg>
        </div>
      </section>

      {/* ── Form ── */}
      <main id="apply" className="flex-1 pb-24 pt-4">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-[0_4px_32px_rgba(0,0,0,0.06)] sm:p-10">
            <div className="mb-8 border-b border-border pb-6">
              <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
                Loan Application
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                Complete every field below. Your data is encrypted end-to-end.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2"
            >
              {FIELD_DEFS.map((field) => (
                <div key={field.name} className="flex flex-col">
                  <label
                    htmlFor={field.name}
                    className="mb-1.5 text-sm font-medium text-foreground"
                  >
                    {field.label}
                  </label>

                  {field.type === "select" ? (
                    <div className="relative">
                      <select
                        id={field.name}
                        value={form[field.name]}
                        onChange={(e) =>
                          onChange(field.name, e.target.value)
                        }
                        aria-invalid={!!errors[field.name]}
                        className={`
                          w-full appearance-none rounded-lg border bg-surface py-3 pl-3.5 pr-10 text-sm text-foreground
                          outline-none transition-all duration-150
                          cursor-pointer
                          hover:border-border-hover
                          focus:border-border-focus focus:ring-2 focus:ring-secondary/15
                          ${errors[field.name] ? "border-error bg-error-light" : "border-border"}
                        `}
                      >
                        <option value="" disabled>
                          {field.placeholder}
                        </option>
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                        aria-hidden="true"
                      />
                    </div>
                  ) : (
                    <input
                      id={field.name}
                      type="number"
                      inputMode="numeric"
                      value={form[field.name]}
                      onChange={(e) =>
                        onChange(field.name, e.target.value)
                      }
                      placeholder={field.placeholder}
                      aria-invalid={!!errors[field.name]}
                      min={"min" in field ? field.min : undefined}
                      max={"max" in field ? field.max : undefined}
                      className={`
                        w-full rounded-lg border bg-surface py-3 px-3.5 text-sm text-foreground
                        placeholder:text-muted/50 outline-none transition-all duration-150
                        hover:border-border-hover
                        focus:border-border-focus focus:ring-2 focus:ring-secondary/15
                        ${errors[field.name] ? "border-error bg-error-light" : "border-border"}
                      `}
                    />
                  )}

                  {errors[field.name] && (
                    <p className="mt-1 text-xs text-error" role="alert">
                      {errors[field.name]}
                    </p>
                  )}
                </div>
              ))}

              {serverError && (
                <div
                  className="col-span-full rounded-lg border border-error/30 bg-error-light px-4 py-3 text-sm text-error"
                  role="alert"
                >
                  {serverError}
                </div>
              )}

              <div className="col-span-full pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="
                    flex w-full items-center justify-center gap-2 rounded-lg bg-primary
                    py-3.5 text-sm font-semibold text-white
                    cursor-pointer shadow-sm transition-all duration-200
                    hover:bg-primary-hover hover:shadow-md
                    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary
                    disabled:cursor-not-allowed disabled:opacity-50
                  "
                >
                  {submitting ? (
                    <>
                      <Loader2
                        className="h-5 w-5 animate-spin"
                        aria-hidden="true"
                      />
                      Analyzing your application…
                    </>
                  ) : (
                    <>
                      Submit Application
                      <ArrowRight
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
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
