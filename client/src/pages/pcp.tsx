import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth, authHeaders } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Save, Loader2, Eye, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PcpPage() {
  const { user, isAuthenticated, isLoading, isAdmin, isGuest, logout } = useAuth();
  const [, navigate] = useLocation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const stateResolverRef = useRef<((state: any) => void) | null>(null);
  const liveCoverageRef = useRef<any>(null);
  const { toast } = useToast();

  const { data: fullState } = useQuery({
    queryKey: ["/api/pcp/full-state"],
    queryFn: async () => {
      const res = await fetch("/api/pcp/full-state", { headers: authHeaders() });
      if (!res.ok) return null;
      return await res.json();
    },
    staleTime: Infinity,
  });

  const { data: coverageData } = useQuery({
    queryKey: ["/api/pcp/coverage"],
    queryFn: async () => {
      const res = await fetch("/api/pcp/coverage", { headers: authHeaders() });
      if (!res.ok) return null;
      const result = await res.json();
      return result.data;
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated && !isGuest) {
      navigate("/login");
    }
  }, [isAuthenticated, isGuest, isLoading, navigate]);

  const sendToIframe = useCallback((msg: any) => {
    iframeRef.current?.contentWindow?.postMessage(msg, "*");
  }, []);

  useEffect(() => {
    if (!iframeReady) return;

    sendToIframe({ type: "PCP_MODE", isAdmin: isAdmin && !isGuest });

    if (fullState) {
      sendToIframe({
        type: "PCP_SET_STATE",
        payload: {
          version: 1,
          weeks: fullState.weeks || {},
          comments: fullState.comments || {},
          params: fullState.params || {},
          notes: fullState.notes || {},
        },
      });
    }

    const cov = fullState?.coverage || coverageData;
    if (cov) {
      sendToIframe({ type: "PCP_SET_COVERAGE", payload: cov });
    }
  }, [iframeReady, isAdmin, isGuest, fullState, coverageData, sendToIframe]);

  useEffect(() => {
    const handleMessage = (ev: MessageEvent) => {
      const d = ev.data;
      if (!d || !d.type) return;

      if (d.type === "PCP_IFRAME_READY") {
        setIframeReady(true);
        return;
      }

      if (d.type === "PCP_FULL_STATE") {
        if (stateResolverRef.current) {
          stateResolverRef.current(d.payload);
          stateResolverRef.current = null;
        }
        return;
      }

      if (d.type === "PCP_COVERAGE" || d.type === "PCP_SET_STATE") {
        if (d.payload?.coverage) {
          liveCoverageRef.current = d.payload.coverage;
        }
        return;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const requestStateFromIframe = useCallback((): Promise<any> => {
    return new Promise((resolve, reject) => {
      const tryDirectAccess = () => {
        try {
          const iframeWin = iframeRef.current?.contentWindow as any;
          if (iframeWin && typeof iframeWin.pcpState !== 'undefined') {
            const pcpState = iframeWin.pcpState;
            if (typeof iframeWin.isoWeekKey !== 'undefined' && iframeWin.isoWeekKey && typeof iframeWin.captureState === 'function') {
              pcpState.weeks[iframeWin.isoWeekKey] = iframeWin.captureState();
            }
            if (typeof iframeWin.pcpParams !== 'undefined') {
              pcpState.params = iframeWin.pcpParams;
            }
            const notesEl = iframeWin.document?.getElementById('skuNotes');
            if (notesEl && iframeWin.isoWeekKey) {
              if (!pcpState.notes) pcpState.notes = {};
              pcpState.notes[iframeWin.isoWeekKey] = notesEl.value || '';
            }
            pcpState.updatedAt = new Date().toISOString();
            const result = JSON.parse(JSON.stringify(pcpState));
            if (typeof iframeWin.coverageData !== 'undefined' && iframeWin.coverageData) {
              result.coverage = JSON.parse(JSON.stringify(iframeWin.coverageData));
            }
            return result;
          }
        } catch (e) {
          console.log("[Save] Direct iframe access failed, using postMessage", e);
        }
        return null;
      };

      const directState = tryDirectAccess();
      if (directState) {
        resolve(directState);
        return;
      }

      stateResolverRef.current = resolve;
      sendToIframe({ type: "PCP_GET_STATE" });
      setTimeout(() => {
        if (stateResolverRef.current) {
          stateResolverRef.current = null;
          const fallbackState = tryDirectAccess();
          if (fallbackState) {
            resolve(fallbackState);
          } else {
            reject(new Error("Não foi possível capturar o estado do PCP. Tente recarregar a página."));
          }
        }
      }, 3000);
    });
  }, [sendToIframe]);

  const handleSave = useCallback(async () => {
    if (!isAdmin || isGuest || saving) return;

    setSaving(true);
    try {
      const state = await requestStateFromIframe();

      if (!state) {
        throw new Error("Estado vazio retornado pelo PCP");
      }

      const res = await fetch("/api/pcp/save-all", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          weeks: state.weeks || {},
          comments: state.comments || {},
          params: state.params || {},
          notes: state.notes || {},
          coverage: state.coverage || liveCoverageRef.current || coverageData || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Erro ao salvar");
      }

      setLastSaved(new Date().toLocaleTimeString("pt-BR"));
      toast({
        title: "Salvo com sucesso",
        description: "Todos os dados do PCP foram salvos no servidor.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/pcp/full-state"] });
    } catch (err: any) {
      toast({
        title: "Erro ao salvar",
        description: err.message || "Falha ao salvar dados.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [isAdmin, isGuest, saving, requestStateFromIframe, coverageData, toast]);

  const handleLogout = useCallback(async () => {
    try {
      await logout.mutateAsync();
      navigate("/login");
    } catch {
      navigate("/login");
    }
  }, [logout, navigate]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f5f5",
        }}
      >
        <Loader2 size={40} className="animate-spin" style={{ color: "#1a7c2f" }} />
      </div>
    );
  }

  if (!isAuthenticated && !isGuest) return null;

  return (
    <div
      data-testid="pcp-page"
      style={{ display: "flex", flexDirection: "column", height: "100vh" }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          height: 52,
          background: "linear-gradient(90deg, #1a7c2f 0%, #15803d 100%)",
          color: "#fff",
          fontFamily: "'Barlow Condensed', sans-serif",
          flexShrink: 0,
          zIndex: 100,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: 2,
              textShadow: "0 1px 4px rgba(0,0,0,0.2)",
            }}
          >
            BRASFRUT PCP
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: isAdmin && !isGuest
                ? "rgba(245,200,0,0.25)"
                : "rgba(255,255,255,0.15)",
              padding: "3px 10px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            {isGuest ? (
              <>
                <Eye size={13} />
                <span data-testid="text-role">VISITANTE</span>
              </>
            ) : isAdmin ? (
              <>
                <Shield size={13} />
                <span data-testid="text-role">ADMIN</span>
              </>
            ) : (
              <>
                <Eye size={13} />
                <span data-testid="text-role">VISUALIZAÇÃO</span>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastSaved && (
            <span
              data-testid="text-last-saved"
              style={{ fontSize: 11, opacity: 0.8 }}
            >
              Salvo às {lastSaved}
            </span>
          )}

          {isAdmin && !isGuest && (
            <button
              data-testid="button-save"
              onClick={handleSave}
              disabled={saving}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 16px",
                background: saving
                  ? "rgba(255,255,255,0.2)"
                  : "linear-gradient(135deg, #f5c800, #ff9800)",
                color: saving ? "#fff" : "#1a1a2e",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 800,
                cursor: saving ? "wait" : "pointer",
                letterSpacing: 1,
                fontFamily: "'Barlow Condensed', sans-serif",
                textTransform: "uppercase",
              }}
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Save size={15} />
              )}
              {saving ? "Salvando..." : "Salvar"}
            </button>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginLeft: 4,
            }}
          >
            <span
              data-testid="text-username"
              style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}
            >
              {isGuest ? "Visitante" : user?.username}
            </span>
            <button
              data-testid="button-logout"
              onClick={handleLogout}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 12px",
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Barlow Condensed', sans-serif",
              }}
            >
              <LogOut size={14} />
              Sair
            </button>
          </div>
        </div>
      </header>

      <iframe
        ref={iframeRef}
        src="/api/pcp.html"
        data-testid="iframe-pcp"
        style={{
          flex: 1,
          width: "100%",
          border: "none",
          background: "#fff",
        }}
        title="PCP Brasfrut"
      />
    </div>
  );
}
