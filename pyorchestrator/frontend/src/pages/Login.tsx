import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LocaleContext";
import { cn } from "@/lib/cn";

function LoginField({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-foreground-secondary">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "block w-full rounded-lg border-0 bg-input px-3.5 py-2.5 text-sm text-foreground",
          "ring-1 ring-inset ring-ring-line placeholder:text-faint",
          "outline-none transition-shadow focus:ring-2 focus:ring-inset focus:ring-cyan-400/50",
        )}
      />
    </div>
  );
}

export default function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("admin@pyorchestrator.local");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Левая половина — брендинг и фон (как у MinIO Console) */}
      <div className="relative hidden min-h-[280px] overflow-hidden lg:flex lg:min-h-screen lg:flex-col lg:justify-between">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url(/login-background.png)" }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-zinc-950/45" aria-hidden />
        <div
          className="absolute inset-0 bg-[linear-gradient(135deg,rgb(9_9_11/0.35)_0%,transparent_45%,rgb(6_182_212/0.12)_100%)]"
          aria-hidden
        />

        <div className="relative z-10 flex flex-1 flex-col justify-between p-12 xl:p-16">
          <div>
            <div className="mb-16 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-cyan-400/15 ring-1 ring-cyan-400/30">
                <span className="text-sm font-extrabold text-cyan-400">PO</span>
              </div>
              <span className="text-lg font-bold text-white">PyOrchestrator</span>
            </div>
            <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
              {t("login.headline")}
            </h2>
            <p className="mt-6 max-w-lg text-sm leading-relaxed text-zinc-300/90">{t("login.description")}</p>
          </div>
          <p className="text-xs text-zinc-400">{t("layout.brandTagline")}</p>
        </div>
      </div>

      {/* Правая половина — форма входа */}
      <div className="relative flex min-h-screen flex-col justify-center bg-canvas px-6 py-12 sm:px-12 lg:px-16 xl:px-24">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>

        <div className="mx-auto w-full max-w-md animate-in">
          <div className="mb-8 lg:mb-10">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-400/15 ring-1 ring-cyan-400/30">
                <span className="text-xs font-extrabold text-cyan-400">PO</span>
              </div>
              <div>
                <p className="text-base font-bold text-foreground">PyOrchestrator</p>
                <p className="text-xs text-muted">{t("layout.brandTagline")}</p>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">{t("login.signIn")}</h1>
            <p className="mt-2 text-sm text-muted">{t("login.subtitle")}</p>
          </div>

          {error ? (
            <div className="mb-6 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400 ring-1 ring-inset ring-red-500/20">
              {error}
            </div>
          ) : null}

          <form onSubmit={submit} className="space-y-5">
            <LoginField
              id="email"
              label={t("common.email")}
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="username"
            />
            <LoginField
              id="password"
              label={t("common.password")}
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "mt-2 w-full rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-on-accent",
                "transition-colors hover:bg-cyan-300",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {loading ? t("login.signingIn") : t("login.submit")}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-dim lg:text-left">{t("login.demoHint")}</p>
          <p className="mt-2 text-center font-mono text-[0.6875rem] text-dim lg:text-left">v0.1.0</p>
        </div>
      </div>
    </div>
  );
}
