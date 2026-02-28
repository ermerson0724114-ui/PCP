import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2, Lock, User, Eye } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, enterAsGuest, isAuthenticated, isGuest } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isAuthenticated || isGuest) {
      navigate("/");
    }
  }, [isAuthenticated, isGuest, navigate]);

  if (isAuthenticated || isGuest) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login.mutateAsync({ username, password });
      navigate("/");
    } catch (err: any) {
      const msg = err.message || "Erro ao fazer login";
      if (msg.includes("401") || msg.includes("Usuário") || msg.includes("Senha") || msg.includes("Credenciais")) {
        setError("Usuário ou senha incorretos");
      } else {
        setError(msg);
      }
    }
  };

  const handleGuest = async () => {
    await enterAsGuest.mutateAsync();
    navigate("/");
  };

  return (
    <div
      data-testid="login-page"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        fontFamily: "'Barlow Condensed', 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          margin: "0 16px",
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 4px 30px rgba(0,0,0,0.08)",
          overflow: "hidden",
          border: "1px solid #e8e8e8",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #1a7c2f 0%, #2db04a 100%)",
            padding: "36px 32px 28px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 42,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: 3,
              textShadow: "0 2px 8px rgba(0,0,0,0.25)",
              lineHeight: 1,
            }}
          >
            BRASFRUT
          </div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.85)",
              marginTop: 8,
              letterSpacing: 4,
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            Planejamento e Controle de Produção
          </div>
          <div
            style={{
              width: 50,
              height: 3,
              background: "#f5c800",
              margin: "14px auto 0",
              borderRadius: 2,
            }}
          />
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "32px 32px 24px" }}>
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 700,
                color: "#37474f",
                marginBottom: 6,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Usuário
            </label>
            <div style={{ position: "relative" }}>
              <User
                size={18}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#90a4ae",
                }}
              />
              <input
                data-testid="input-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite seu usuário"
                autoComplete="username"
                style={{
                  width: "100%",
                  padding: "12px 12px 12px 40px",
                  border: "2px solid #e0e0e0",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                  outline: "none",
                  transition: "border-color 0.2s",
                  boxSizing: "border-box",
                  fontFamily: "'Barlow Condensed', sans-serif",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#1a7c2f")}
                onBlur={(e) => (e.target.style.borderColor = "#e0e0e0")}
              />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 700,
                color: "#37474f",
                marginBottom: 6,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Senha
            </label>
            <div style={{ position: "relative" }}>
              <Lock
                size={18}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#90a4ae",
                }}
              />
              <input
                data-testid="input-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                style={{
                  width: "100%",
                  padding: "12px 12px 12px 40px",
                  border: "2px solid #e0e0e0",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                  outline: "none",
                  transition: "border-color 0.2s",
                  boxSizing: "border-box",
                  fontFamily: "'Barlow Condensed', sans-serif",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#1a7c2f")}
                onBlur={(e) => (e.target.style.borderColor = "#e0e0e0")}
              />
            </div>
          </div>

          {error && (
            <div
              data-testid="text-error"
              style={{
                background: "#ffebee",
                color: "#c62828",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          <button
            data-testid="button-login"
            type="submit"
            disabled={login.isPending || !username || !password}
            style={{
              width: "100%",
              padding: "14px",
              background: login.isPending
                ? "#81c784"
                : "linear-gradient(135deg, #1a7c2f, #2db04a)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: 2,
              cursor: login.isPending ? "wait" : "pointer",
              textTransform: "uppercase",
              fontFamily: "'Barlow Condensed', sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: !username || !password ? 0.6 : 1,
            }}
          >
            {login.isPending ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        <div style={{ padding: "0 32px 32px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ flex: 1, height: 1, background: "#e0e0e0" }} />
            <span style={{ fontSize: 11, color: "#90a4ae", fontWeight: 600, letterSpacing: 1 }}>
              OU
            </span>
            <div style={{ flex: 1, height: 1, background: "#e0e0e0" }} />
          </div>

          <button
            data-testid="button-guest"
            type="button"
            onClick={handleGuest}
            disabled={enterAsGuest.isPending}
            style={{
              width: "100%",
              padding: "12px",
              background: "#fff",
              color: "#546e7a",
              border: "2px solid #cfd8dc",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 1,
              cursor: "pointer",
              textTransform: "uppercase",
              fontFamily: "'Barlow Condensed', sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.2s",
            }}
          >
            <Eye size={16} />
            Entrar como Visitante
          </button>

          <div
            style={{
              marginTop: 16,
              textAlign: "center",
              fontSize: 11,
              color: "#90a4ae",
              letterSpacing: 0.5,
            }}
          >
            Visitantes podem visualizar, mas não editar o PCP
          </div>
        </div>
      </div>
    </div>
  );
}
