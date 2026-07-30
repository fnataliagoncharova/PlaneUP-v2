import { LockKeyhole, LogIn, UserRound } from "lucide-react";
import { useState } from "react";

import { useAuth } from "../auth/AuthContext";

function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await login(username, password);
    } catch (error) {
      if (error?.status === 401) {
        setErrorMessage("Неверный логин или пароль.");
      } else if (error?.status === 403) {
        setErrorMessage("Пользователь отключён.");
      } else {
        setErrorMessage(error?.message || "Не удалось выполнить вход.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 text-slate-900">
      <div className="w-full max-w-[420px] overflow-hidden border border-white/70 bg-slate-50 shadow-[0_32px_90px_rgba(2,8,18,0.45)]">
        <div className="border-b border-slate-200 bg-white px-7 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center border border-cyan-200 bg-cyan-50 text-cyan-700">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-['Space_Grotesk'] text-2xl font-semibold tracking-tight text-slate-950">
                Plane<span style={{ color: "#0C92A3" }}>UP</span>
              </h1>
              <p className="mt-1 text-sm font-normal text-slate-500">Production Planning</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-7 py-7">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Логин</span>
            <span className="mt-2 flex h-11 items-center gap-3 border border-slate-300 bg-white px-3 transition focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-100">
              <UserRound className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                placeholder="admin"
              />
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Пароль</span>
            <span className="mt-2 flex h-11 items-center gap-3 border border-slate-300 bg-white px-3 transition focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-100">
              <LockKeyhole className="h-4 w-4 text-slate-400" />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                placeholder="Пароль"
              />
            </span>
          </label>

          {errorMessage ? (
            <div className="border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 w-full items-center justify-center gap-2 border border-cyan-700 bg-cyan-700 px-4 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-65"
          >
            <LogIn className="h-4 w-4" />
            {isSubmitting ? "Входим..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
