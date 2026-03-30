"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthFormProps {
  appName: string;
  appColor: string;
  appTagline: string;
  appLogo?: React.ReactNode;
  registerSubtitle?: string;
  footerText?: string;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, fullName: string, phone: string) => Promise<void>;
  onGoogleLogin?: () => Promise<void>;
  onFacebookLogin?: () => Promise<void>;
  onForgotPassword?: (email: string) => Promise<void>;
}

type FormMode = "login" | "register";

interface FormErrors {
  email?: string;
  password?: string;
  fullName?: string;
  phone?: string;
  terms?: string;
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return "O email é obrigatório";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email inválido";
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return "A palavra-passe é obrigatória";
  if (password.length < 6) return "A palavra-passe deve ter pelo menos 6 caracteres";
  return undefined;
}

function validateFullName(name: string): string | undefined {
  if (!name.trim()) return "O nome completo é obrigatório";
  if (name.trim().length < 2) return "O nome deve ter pelo menos 2 caracteres";
  return undefined;
}

function validatePhone(phone: string): string | undefined {
  if (!phone.trim()) return "O telefone é obrigatório";
  if (!/^[+]?[\d\s()-]{7,}$/.test(phone.trim())) return "Número de telefone inválido";
  return undefined;
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

const AuthForm = React.forwardRef<HTMLDivElement, AuthFormProps>(
  ({ appName, appColor, appTagline, appLogo, registerSubtitle, footerText, onLogin, onRegister, onGoogleLogin, onFacebookLogin, onForgotPassword }, ref) => {
    const [mode, setMode] = React.useState<FormMode>("login");
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [fullName, setFullName] = React.useState("");
    const [phone, setPhone] = React.useState("");
    const [showPassword, setShowPassword] = React.useState(false);
    const [acceptedTerms, setAcceptedTerms] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [socialLoading, setSocialLoading] = React.useState<"google" | "facebook" | null>(null);
    const [errors, setErrors] = React.useState<FormErrors>({});
    const [message, setMessage] = React.useState<{ type: "error" | "success"; text: string } | null>(null);
    const [forgotPasswordMode, setForgotPasswordMode] = React.useState(false);

    const isLogin = mode === "login";

    const toggleMode = React.useCallback(() => {
      setMode((prev) => (prev === "login" ? "register" : "login"));
      setErrors({});
      setMessage(null);
      setForgotPasswordMode(false);
    }, []);

    const validateForm = React.useCallback((): boolean => {
      const newErrors: FormErrors = {};
      const emailError = validateEmail(email);
      if (emailError) newErrors.email = emailError;
      if (!forgotPasswordMode) {
        const passwordError = validatePassword(password);
        if (passwordError) newErrors.password = passwordError;
      }
      if (!isLogin && !forgotPasswordMode) {
        const nameError = validateFullName(fullName);
        if (nameError) newErrors.fullName = nameError;
        const phoneError = validatePhone(phone);
        if (phoneError) newErrors.phone = phoneError;
        if (!acceptedTerms) newErrors.terms = "Deves aceitar os termos de serviço";
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }, [email, password, fullName, phone, acceptedTerms, isLogin, forgotPasswordMode]);

    const handleSubmit = React.useCallback(async (e: React.FormEvent) => {
      e.preventDefault();
      setMessage(null);
      if (!validateForm()) return;
      setLoading(true);
      try {
        if (forgotPasswordMode) {
          if (onForgotPassword) {
            await onForgotPassword(email);
            setMessage({ type: "success", text: "Email de recuperação enviado. Verifica a tua caixa de entrada." });
          }
        } else if (isLogin) {
          await onLogin(email, password);
        } else {
          await onRegister(email, password, fullName, phone);
          setMessage({ type: "success", text: "Conta criada com sucesso! Verifica o teu email para confirmar." });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Ocorreu um erro inesperado";
        setMessage({ type: "error", text: errorMessage });
      } finally {
        setLoading(false);
      }
    }, [email, password, fullName, phone, isLogin, forgotPasswordMode, onLogin, onRegister, onForgotPassword, validateForm]);

    const handleSocialLogin = React.useCallback(async (provider: "google" | "facebook") => {
      const handler = provider === "google" ? onGoogleLogin : onFacebookLogin;
      if (!handler) return;
      setSocialLoading(provider);
      setMessage(null);
      try {
        await handler();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Ocorreu um erro inesperado";
        setMessage({ type: "error", text: errorMessage });
      } finally {
        setSocialLoading(null);
      }
    }, [onGoogleLogin, onFacebookLogin]);

    const title = forgotPasswordMode ? "Recuperar palavra-passe" : isLogin ? "Que bom ter-te de volta!" : "Criar conta";
    const subtitle = forgotPasswordMode ? "Insere o teu email para receber um link de recuperação" : isLogin ? "Continua de onde paraste" : (registerSubtitle ?? "Junta-te ao BUDGY");
    const submitLabel = forgotPasswordMode ? "Enviar link de recuperação" : isLogin ? "Entrar" : "Criar Conta";

    const inputClass = (hasError: boolean) => cn(
      "flex h-11 w-full rounded-xl border bg-gray-50 px-4 text-sm text-gray-900 transition-all duration-200",
      "placeholder:text-gray-400",
      "focus:border-transparent focus:bg-white focus:outline-none focus:ring-2",
      hasError ? "border-red-300 focus:ring-red-500/30" : "border-gray-200 focus:ring-gray-900/10",
    );

    const focusHandler = (hasError: boolean) => ({
      onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
        if (!hasError) {
          e.currentTarget.style.boxShadow = `0 0 0 2px ${appColor}30`;
          e.currentTarget.style.borderColor = "transparent";
        }
      },
      onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
        e.currentTarget.style.boxShadow = "";
        e.currentTarget.style.borderColor = "";
      },
    });

    return (
      <div ref={ref} className="flex min-h-screen items-center justify-center p-4" style={{ background: `linear-gradient(135deg, ${appColor}15 0%, ${appColor}05 50%, #f8fafc 100%)` }}>
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            {appLogo ? <>{appLogo}</> : (
              <div className="mb-2 inline-flex items-center gap-1 text-3xl font-black tracking-tight" style={{ color: appColor }}>
                <span>{appName}</span>
              </div>
            )}
            <p className="text-sm text-gray-500">{appTagline}</p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-200/50 sm:p-8">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900">{title}</h1>
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            </div>

            {message && (
              <div className={cn("mb-4 rounded-lg px-4 py-3 text-sm", message.type === "error" ? "border border-red-200 bg-red-50 text-red-700" : "border border-green-200 bg-green-50 text-green-700")} role="alert">
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {!isLogin && !forgotPasswordMode && (
                <div>
                  <label htmlFor="auth-fullname" className="mb-1.5 block text-sm font-medium text-gray-700">Nome completo</label>
                  <input id="auth-fullname" type="text" value={fullName} onChange={(e) => { setFullName(e.target.value); if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined })); }} placeholder="Maria Silva" autoComplete="name" className={inputClass(!!errors.fullName)} {...focusHandler(!!errors.fullName)} />
                  {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>}
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                <input id="auth-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((prev) => ({ ...prev, email: undefined })); }} placeholder="teu@email.com" autoComplete="email" className={inputClass(!!errors.email)} {...focusHandler(!!errors.email)} />
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
              </div>

              {!forgotPasswordMode && (
                <div>
                  <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium text-gray-700">Palavra-passe</label>
                  <div className="relative">
                    <input id="auth-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((prev) => ({ ...prev, password: undefined })); }} placeholder="A tua palavra-passe" autoComplete={isLogin ? "current-password" : "new-password"} className={cn(inputClass(!!errors.password), "pr-11")} {...focusHandler(!!errors.password)} />
                    <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600" aria-label={showPassword ? "Esconder" : "Mostrar"}>
                      {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
                </div>
              )}

              {!isLogin && !forgotPasswordMode && (
                <div>
                  <label htmlFor="auth-phone" className="mb-1.5 block text-sm font-medium text-gray-700">Telefone</label>
                  <input id="auth-phone" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined })); }} placeholder="+258 84 123 4567" autoComplete="tel" className={inputClass(!!errors.phone)} {...focusHandler(!!errors.phone)} />
                  {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
                </div>
              )}

              {!isLogin && !forgotPasswordMode && (
                <div>
                  <label className="flex items-start gap-3">
                    <input type="checkbox" checked={acceptedTerms} onChange={(e) => { setAcceptedTerms(e.target.checked); if (errors.terms) setErrors((prev) => ({ ...prev, terms: undefined })); }} className="mt-0.5 h-4 w-4 rounded border-gray-300" style={{ accentColor: appColor }} />
                    <span className="text-xs leading-relaxed text-gray-500">
                      Aceito os <a href="/terms" className="font-medium underline underline-offset-2" style={{ color: appColor }}>Termos de Serviço</a> e a <a href="/privacy" className="font-medium underline underline-offset-2" style={{ color: appColor }}>Política de Privacidade</a>
                    </span>
                  </label>
                  {errors.terms && <p className="mt-1 text-xs text-red-500">{errors.terms}</p>}
                </div>
              )}

              {isLogin && !forgotPasswordMode && onForgotPassword && (
                <div className="flex justify-end">
                  <button type="button" onClick={() => { setForgotPasswordMode(true); setErrors({}); setMessage(null); }} className="text-xs font-medium transition-colors hover:underline" style={{ color: appColor }}>
                    Esqueceu a palavra-passe?
                  </button>
                </div>
              )}

              <button type="submit" disabled={loading} className={cn("flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-lg transition-all duration-200", "hover:shadow-xl hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60")} style={{ backgroundColor: appColor, boxShadow: `0 4px 14px 0 ${appColor}40` }}>
                {loading && <SpinnerIcon className="h-4 w-4" />}
                {submitLabel}
              </button>

              {forgotPasswordMode && (
                <button type="button" onClick={() => { setForgotPasswordMode(false); setErrors({}); setMessage(null); }} className="flex h-11 w-full items-center justify-center rounded-xl border border-gray-200 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 active:scale-[0.98]">
                  Voltar ao login
                </button>
              )}
            </form>

            {!forgotPasswordMode && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                  <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-gray-400">ou continuar com</span></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => handleSocialLogin("google")} disabled={socialLoading !== null || loading} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98] disabled:opacity-60">
                    {socialLoading === "google" ? <SpinnerIcon className="h-4 w-4 text-gray-500" /> : <GoogleIcon className="h-4 w-4" />}
                    Google
                  </button>
                  <button type="button" onClick={() => handleSocialLogin("facebook")} disabled={socialLoading !== null || loading} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98] disabled:opacity-60">
                    {socialLoading === "facebook" ? <SpinnerIcon className="h-4 w-4 text-gray-500" /> : <FacebookIcon className="h-4 w-4" />}
                    Facebook
                  </button>
                </div>
              </>
            )}

            {!forgotPasswordMode && (
              <p className="mt-6 text-center text-sm text-gray-500">
                {isLogin ? "Não tens uma conta?" : "Já tens uma conta?"}{" "}
                <button type="button" onClick={toggleMode} className="font-semibold transition-colors hover:underline" style={{ color: appColor }}>
                  {isLogin ? "Criar Conta" : "Entrar"}
                </button>
              </p>
            )}
          </div>

          {footerText !== "" && (
            <p className="mt-6 text-center text-xs text-gray-400">
              {footerText ?? "BUDGY - As tuas finanças, simplificadas"}
            </p>
          )}
        </div>
      </div>
    );
  },
);

AuthForm.displayName = "AuthForm";

export { AuthForm };
