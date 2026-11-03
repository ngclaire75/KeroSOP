"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { sendAuth } from "@/lib/authEvents";
import { explain, keepPreference, logIn, remember as keepSession, resetPassword } from "@/lib/auth";
import { Social } from "@/components/auth/Social";
import { BlurText, Heading } from "@/components/BlurText";
import {
  Check,
  EMAIL,
  Field,
  PasswordField,
  Stagger,
  Submit,
  SwitchPrompt,
  type FieldHandle,
  type SubmitState,
} from "@/components/auth/fields";

type Errors = Partial<Record<"email" | "password", string>>;

export function LoginForm() {
  const [view, setView] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<SubmitState>("idle");
  const [sent, setSent] = useState(false);
  const emailRef = useRef<FieldHandle>(null);
  const passRef = useRef<FieldHandle>(null);

  useEffect(() => {
    keepPreference().then(setRemember);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!EMAIL.test(email.trim())) next.email = email ? "That email doesn’t look right." : "Enter your email.";
    if (view === "login" && !password) next.password = "Enter your password.";
    setErrors(next);
    const bad = (["email", "password"] as const).filter((k) => next[k]);
    if (bad.length) {
      const refs = { email: emailRef, password: passRef };
      refs[bad[0]].current?.focus();
      return;
    }
    setState("busy");
    try {
      if (view === "reset") await resetPassword(email.trim());
      else await logIn({ email: email.trim(), password, keep: remember });
    } catch (err) {
      const { field, message } = explain(err);
      setState("idle");
      setErrors({ [view === "reset" ? "email" : field]: message });
      return;
    }
    if (view === "reset") {
      setState("idle");
      setSent(true);
      return;
    }
    setState("done");
    sendAuth({ type: "success" });
  };

  if (view === "reset")
    return (
      <Stagger key="reset" className="flex flex-col gap-5">
        <div className="text-center">
          <Heading as="h1" lines={["Reset password"]} className="text-[clamp(2.6rem,5vw,3.6rem)]" />
          <BlurText className="mt-3 text-[16px] leading-[1.55] text-mute">We’ll email you a link to choose a new one.</BlurText>
        </div>
        {sent ? (
          <div role="status" className="rounded-2xl border border-line bg-fog/70 p-5 text-[15px] leading-[1.55]">
            <span className="font-semibold text-ink">Check your inbox.</span>{" "}
            <span className="text-mute">If {email.trim()} has a KeroSOP account, the link is on its way.</span>
          </div>
        ) : (
          <form noValidate onSubmit={submit} className="flex flex-col gap-5">
            <Field
              ref={emailRef}
              label="Email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              error={errors.email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Submit state={state} done="Sent">
              Send reset link
            </Submit>
          </form>
        )}
        <button
          type="button"
          onClick={() => {
            setView("login");
            setSent(false);
            setErrors({});
          }}
          className="self-center text-[14px] font-semibold text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink"
        >
          Back to log in
        </button>
      </Stagger>
    );

  return (
    <Stagger key="login" className="flex flex-col gap-5">
      <div className="text-center">
        <Heading as="h1" lines={["Welcome back"]} className="text-[clamp(2.6rem,5vw,3.6rem)]" />
        <BlurText className="mt-3 text-[16px] leading-[1.55] text-mute">Log in to your scans, findings and sign-offs.</BlurText>
      </div>

      <Social
        verb="Log in with"
        disabled={state !== "idle"}
        onSuccess={() => {
          setState("done");
          sendAuth({ type: "success" });
        }}
      />

      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <Field
          ref={emailRef}
          label="Email"
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          error={errors.email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((x) => ({ ...x, email: undefined }));
          }}
        />
        <PasswordField
          ref={passRef}
          label="Password"
          name="password"
          autoComplete="current-password"
          value={password}
          error={errors.password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors((x) => ({ ...x, password: undefined }));
          }}
        />
        <div className="flex items-center justify-between gap-4 py-1">
          <Check
            checked={remember}
            onChange={(v) => {
              setRemember(v);
              keepSession(v);
            }}
          >
            Keep me logged in
          </Check>
          <button
            type="button"
            onClick={() => {
              setView("reset");
              setErrors({});
              setState("idle");
            }}
            className="shrink-0 text-[14px] font-semibold text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink"
          >
            Forgot password?
          </button>
        </div>
        <Submit state={state} done="Logged in">
          Log in
        </Submit>
        <p role="status" className="sr-only">
          {state === "done" ? "Logged in." : ""}
        </p>
      </form>
      <SwitchPrompt question="Don’t have an account?" label="Sign up" href="/signup" />
    </Stagger>
  );
}
