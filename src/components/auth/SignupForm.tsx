"use client";

import { useRef, useState, type FormEvent } from "react";
import { sendAuth } from "@/lib/authEvents";
import { BlurText, Heading } from "@/components/BlurText";
import {
  Check,
  EMAIL,
  Field,
  PasswordField,
  Stagger,
  Submit,
  SwitchPrompt,
  passwordScore,
  type FieldHandle,
  type SubmitState,
} from "@/components/auth/fields";

type Key = "name" | "email" | "company" | "password" | "terms";
type Errors = Partial<Record<Key, string>>;

/** Demo submit: there is no auth backend yet, so this stands in for the request. */
const pretendRequest = () => new Promise((r) => setTimeout(r, 1500));

export function SignupForm() {
  const [form, setForm] = useState({ name: "", email: "", company: "", password: "" });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<SubmitState>("idle");
  const [verify, setVerify] = useState(false);
  const nameRef = useRef<FieldHandle>(null);
  const emailRef = useRef<FieldHandle>(null);
  const companyRef = useRef<FieldHandle>(null);
  const passRef = useRef<FieldHandle>(null);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!form.name.trim()) next.name = "Tell us your name.";
    if (!EMAIL.test(form.email.trim()))
      next.email = form.email ? "That email doesn’t look right." : "Enter your email.";
    if (!form.company.trim()) next.company = "Which team or company is this for?";
    if (passwordScore(form.password) < 2) next.password = "Use 8+ characters with a mix of letters and numbers.";
    if (!terms) next.terms = "required";
    setErrors(next);
    const refs = { name: nameRef, company: companyRef, email: emailRef, password: passRef };
    const bad = (Object.keys(refs) as (keyof typeof refs)[]).filter((k) => next[k]);
    if (bad.length) return refs[bad[0]].current?.focus();
    if (next.terms) return;

    setState("busy");
    await pretendRequest();
    setState("done");
    sendAuth({ type: "success" });
    setTimeout(() => setVerify(true), 900);
  };

  if (verify)
    return (
      <Stagger key="verify" className="flex flex-col gap-5">
        <MailArt />
        <div className="text-center">
          <Heading as="h1" lines={["Check your inbox"]} className="text-[clamp(2.6rem,5vw,3.6rem)]" />
          <p className="mt-3 text-[16px] leading-[1.55] text-mute">
            We sent a confirmation link to <span className="font-semibold text-ink">{form.email.trim()}</span>. Open it to
            set up your workspace and upload your first SOPs.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="mailto:"
            className="inline-flex h-12 items-center justify-center rounded-full bg-ink px-6 text-[15px] font-semibold text-paper transition-colors hover:bg-[#262626]"
          >
            Open email app
          </a>
          <button
            type="button"
            onClick={() => {
              setVerify(false);
              setState("idle");
            }}
            className="inline-flex h-12 items-center justify-center rounded-full border border-ink/20 px-6 text-[15px] font-semibold transition-colors hover:border-ink"
          >
            Use a different email
          </button>
        </div>
        <p role="status" className="text-center text-[13px] text-mute">
          Nothing after a few minutes? Check spam, or ask your IT team to allow mail from kerosop.site.
        </p>
      </Stagger>
    );

  return (
    <Stagger key="signup" className="flex flex-col gap-5">
      <div className="text-center">
        <Heading as="h1" lines={["Create account"]} className="text-[clamp(2.6rem,5vw,3.6rem)]" />
        <BlurText className="mt-3 text-[16px] leading-[1.55] text-mute">
          Find the SOP instructions that contradict each other, in Chinese and English.
        </BlurText>
      </div>

      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field ref={nameRef} label="Full name" autoComplete="name" value={form.name} error={errors.name} onChange={set("name")} />
          <Field
            ref={companyRef}
            label="Company"
            autoComplete="organization"
            value={form.company}
            error={errors.company}
            onChange={set("company")}
          />
        </div>
        <Field
          ref={emailRef}
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={form.email}
          error={errors.email}
          onChange={set("email")}
        />
        <PasswordField
          ref={passRef}
          label="Password"
          autoComplete="new-password"
          meter
          value={form.password}
          error={errors.password}
          onChange={set("password")}
        />
        <div className="py-1">
          <Check
            checked={terms}
            error={!!errors.terms}
            onChange={(v) => {
              setTerms(v);
              if (v) setErrors((x) => ({ ...x, terms: undefined }));
            }}
          >
            I agree to the{" "}
            <a href="/terms" target="_blank" className="font-semibold text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" target="_blank" className="font-semibold text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink">
              Privacy Policy
            </a>
            .
          </Check>
        </div>
        <Submit state={state} done="Account created">
          Create account
        </Submit>
      </form>
      <SwitchPrompt question="Already have an account?" label="Log in" href="/login" />
    </Stagger>
  );
}

/** An envelope drawn in dots, with one red dot for the unread mail. */
function MailArt() {
  const dots: [number, number][] = [];
  for (let x = 0; x <= 12; x++) dots.push([x, 0], [x, 8]);
  for (let y = 1; y < 8; y++) dots.push([0, y], [12, y]);
  for (let i = 1; i <= 5; i++) dots.push([i, i * 0.8], [12 - i, i * 0.8]);
  return (
    <svg viewBox="-1 -1 16 10" className="h-16 w-auto self-center" aria-hidden="true">
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="0.32" fill="var(--ink)" />
      ))}
      <circle cx="13.2" cy="-0.1" r="1" fill="var(--red)" className="blink" />
    </svg>
  );
}
