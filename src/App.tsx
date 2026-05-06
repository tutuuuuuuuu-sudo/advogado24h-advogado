import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { io, Socket } from "socket.io-client";
import {
  Gavel, Bell, DollarSign, History, User, Settings,
  CheckCircle2, XCircle, MapPin, Clock, Star,
  Send, Phone, Video, ArrowLeft, ChevronRight,
  TrendingUp, Shield, AlertCircle, LogOut, Wifi, WifiOff,
  FileText, Eye, EyeOff, Upload
} from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Lawyer {
  id: string; name: string; specialty: string;
  rating: number; status: "available" | "busy" | "offline";
  lat?: number; lng?: number; price_per_minute: number; oab?: string;
  verification_status?: "pending" | "approved" | "rejected";
}
interface Emergency {
  id: string; user_id: string; status: string;
  specialty: string; lat?: number; lng?: number; created_at?: string;
}
interface Message {
  from: string; message: string; sender: string; timestamp: number;
}
interface Stats {
  totalEmergencies: number; totalEarnings: number;
}

export default function AppAdvogado() {
  const [view, setView] = useState<"login" | "register" | "home" | "emergency" | "chat" | "history" | "profile" | "settings" | "earnings">("login");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [currentLawyer, setCurrentLawyer] = useState<Lawyer | null>(null);
  const [isOnDuty, setIsOnDuty] = useState(false);
  const [incomingEmergency, setIncomingEmergency] = useState<Emergency | null>(null);
  const [activeEmergency, setActiveEmergency] = useState<Emergency | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<Stats>({ totalEmergencies: 0, totalEarnings: 0 });
  const [history, setHistory] = useState<any[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" | "warn" } | null>(null);
  const [callTimer, setCallTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const showToast = useCallback((msg: string, type: "ok" | "err" | "warn" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Socket
  useEffect(() => {
    if (!currentLawyer) return;
    const s = io(BACKEND_URL, { query: { lawyerId: currentLawyer.id, role: "lawyer" } });
    setSocket(s);
    s.on("connect", () => {
      setIsOnline(true);
      s.emit("register-lawyer", { id: currentLawyer.id });
    });
    s.on("disconnect", () => setIsOnline(false));
    s.on("new-emergency", (emergency: Emergency) => {
      if (!isOnDuty) return;
      setIncomingEmergency(emergency);
      // Vibrar dispositivo se disponível
      if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
    });
    s.on("emergency-confirmed", (emergencyId: string) => {
      setActiveEmergency(prev => prev ? { ...prev, status: "accepted" } : null);
      setIncomingEmergency(null);
      setView("chat");
      startCallTimer();
    });
    s.on("chat-message", (msg: Message) => setMessages(prev => [...prev, msg]));
    s.on("error", (e: any) => showToast(e.message, "err"));
    return () => { s.disconnect(); };
  }, [currentLawyer, isOnDuty, showToast]);

  const startCallTimer = () => {
    setCallTimer(0);
    timerRef.current = setInterval(() => setCallTimer(t => t + 1), 1000);
  };

  useEffect(() => {
    if (!currentLawyer) return;
    fetch(`${BACKEND_URL}/api/lawyer-stats/${currentLawyer.id}`)
      .then(r => r.json()).then(setStats).catch(() => {});
    fetch(`${BACKEND_URL}/api/history/${currentLawyer.id}`)
      .then(r => r.json()).then(setHistory).catch(() => {});
  }, [currentLawyer, view]);

  const handleLogin = (lawyer: Lawyer) => {
    setCurrentLawyer(lawyer);
    setView("home");
  };

  const toggleDuty = () => {
    const next = !isOnDuty;
    setIsOnDuty(next);
    if (socket && currentLawyer) {
      socket.emit(next ? "go-available" : "go-offline", { lawyerId: currentLawyer.id });
    }
    showToast(next ? "Você está de plantão!" : "Você saiu do plantão.", next ? "ok" : "warn");
  };

  const acceptEmergency = () => {
    if (!socket || !currentLawyer || !incomingEmergency) return;
    socket.emit("accept-emergency", { emergencyId: incomingEmergency.id, lawyerId: currentLawyer.id });
    setActiveEmergency(incomingEmergency);
  };

  const rejectEmergency = () => {
    setIncomingEmergency(null);
    showToast("Chamado recusado.", "warn");
  };

  const completeEmergency = () => {
    if (!socket || !currentLawyer || !activeEmergency) return;
    socket.emit("complete-emergency", { emergencyId: activeEmergency.id, lawyerId: currentLawyer.id });
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveEmergency(null);
    setMessages([]);
    setView("home");
    showToast("Atendimento finalizado!", "ok");
  };

  const sendMessage = (text: string) => {
    if (!socket || !activeEmergency) return;
    socket.emit("chat-message", {
      to: activeEmergency.user_id,
      message: text,
      sender: currentLawyer?.name ?? "Advogado",
      emergencyId: activeEmergency.id,
    });
    setMessages(prev => [...prev, { from: currentLawyer?.id ?? "", message: text, sender: "Você", timestamp: Date.now() }]);
  };

  const handleLogout = () => {
    socket?.disconnect();
    setCurrentLawyer(null);
    setIsOnDuty(false);
    setView("login");
  };

  const minutes = Math.floor(callTimer / 60).toString().padStart(2, "0");
  const seconds = (callTimer % 60).toString().padStart(2, "0");

  if (view === "login" || view === "register") {
    return <AuthView onLogin={handleLogin} defaultView={view} onSwitchView={(v) => setView(v as any)} />;
  }

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#F8F7F4",
      color: "#1a1a1a",
      fontFamily: "'DM Sans', 'Inter', sans-serif",
      maxWidth: 430,
      margin: "0 auto",
      position: "relative",
    }}>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            style={{
              position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
              zIndex: 999,
              background: toast.type === "ok" ? "#052e16" : toast.type === "warn" ? "#431407" : "#450a0a",
              color: toast.type === "ok" ? "#4ade80" : toast.type === "warn" ? "#fb923c" : "#f87171",
              padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 500,
              whiteSpace: "nowrap", border: `1px solid ${toast.type === "ok" ? "#166534" : "#7c2d12"}`,
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incoming emergency modal */}
      <AnimatePresence>
        {incomingEmergency && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          >
            <motion.div
              initial={{ scale: 0.8, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 24, overflow: "hidden", boxShadow: "0 40px 80px rgba(0,0,0,0.4)" }}
            >
              <div style={{ background: "#DC2626", padding: "20px 24px", display: "flex", alignItems: "center", gap: 12 }}>
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                  <AlertCircle size={28} color="white" />
                </motion.div>
                <div>
                  <div style={{ color: "white", fontWeight: 800, fontSize: 16 }}>CHAMADO DE EMERGÊNCIA</div>
                  <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>{incomingEmergency.specialty}</div>
                </div>
              </div>
              <div style={{ padding: 24 }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1, background: "#f8f7f4", borderRadius: 12, padding: "12px 16px" }}>
                    <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Especialidade</div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{incomingEmergency.specialty}</div>
                  </div>
                  <div style={{ flex: 1, background: "#f8f7f4", borderRadius: 12, padding: "12px 16px" }}>
                    <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Distância</div>
                    <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 4 }}>
                      <MapPin size={13} color="#DC2626" /> 1.2 km
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={rejectEmergency} style={{ flex: 1, padding: "14px", background: "#f0f0f0", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#666" }}>
                    Recusar
                  </button>
                  <button onClick={acceptEmergency} style={{ flex: 2, padding: "14px", background: "#DC2626", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: "pointer", color: "white" }}>
                    ✓ Aceitar chamado
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "#1a3a2a", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Gavel size={16} color="#4ade80" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: -0.3 }}>Advogado 24h</span>
          <span style={{ fontSize: 10, background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>PRO</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: isOnline ? "#16a34a" : "#dc2626" }}>
            {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          </div>
          <button onClick={handleLogout} style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Main */}
      <AnimatePresence mode="wait">
        <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
          {view === "home" && <LawyerHome lawyer={currentLawyer} isOnDuty={isOnDuty} onToggleDuty={toggleDuty} stats={stats} activeEmergency={activeEmergency} onOpenChat={() => setView("chat")} onComplete={completeEmergency} setView={setView} />}
          {view === "chat" && <LawyerChat messages={messages} emergency={activeEmergency} onSend={sendMessage} onBack={() => setView("home")} timer={`${minutes}:${seconds}`} onComplete={completeEmergency} />}
          {view === "history" && <LawyerHistory history={history} onBack={() => setView("home")} />}
          {view === "earnings" && <LawyerEarnings stats={stats} history={history} onBack={() => setView("home")} lawyer={currentLawyer} />}
          {view === "profile" && <LawyerProfile lawyer={currentLawyer} onBack={() => setView("home")} />}
          {view === "settings" && <LawyerSettings onBack={() => setView("home")} />}
        </motion.div>
      </AnimatePresence>

      {/* Bottom Nav */}
      {(view === "home" || view === "history" || view === "earnings" || view === "profile") && (
        <nav style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 430,
          background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(0,0,0,0.06)",
          padding: "12px 32px 24px",
          display: "flex", justifyContent: "space-around", alignItems: "center",
          zIndex: 40,
        }}>
          <NavBtn icon={<Shield size={22} />} label="Início" active={view === "home"} onClick={() => setView("home")} color="#1a3a2a" />
          <NavBtn icon={<History size={22} />} label="Histórico" active={view === "history"} onClick={() => setView("history")} color="#1a3a2a" />
          <NavBtn icon={<DollarSign size={22} />} label="Ganhos" active={view === "earnings"} onClick={() => setView("earnings")} color="#1a3a2a" />
          <NavBtn icon={<User size={22} />} label="Perfil" active={view === "profile"} onClick={() => setView("profile")} color="#1a3a2a" />
        </nav>
      )}
    </div>
  );
}

// ─── Auth View ────────────────────────────────────────────────────────────────
function AuthView({ onLogin, defaultView, onSwitchView }: any) {
  const [isRegister, setIsRegister] = useState(defaultView === "register");
  const [oabInput, setOabInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [specialtyInput, setSpecialtyInput] = useState("Criminal");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/lawyers`)
      .then(r => r.json()).then(setLawyers).catch(() => {});
  }, []);

  const handleLoginByOab = async () => {
    setIsLoading(true);
    setError("");
    const found = lawyers.find(l => l.oab?.toLowerCase() === oabInput.toLowerCase());
    if (found) {
      if (found.verification_status === "rejected") {
        setError("Sua conta foi reprovada na verificação. Entre em contato com o suporte.");
      } else if (found.verification_status === "pending") {
        setError("Sua conta está em análise. Você receberá um e-mail quando aprovada.");
      } else {
        onLogin(found);
      }
    } else {
      setError("OAB não encontrada. Verifique o número ou faça o cadastro.");
    }
    setIsLoading(false);
  };

  const handleRegister = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/lawyers/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput, oab: oabInput, specialty: specialtyInput }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro no cadastro."); return; }
      setError("");
      setIsRegister(false);
      setOabInput("");
      alert("Cadastro enviado! Aguarde a verificação do seu registro na OAB. Você será notificado por e-mail.");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, background: "#F8F7F4" }}>
      <div style={{ width: 56, height: 56, borderRadius: 18, background: "#1a3a2a", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
        <Gavel size={28} color="#4ade80" />
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6, letterSpacing: -0.5 }}>
        {isRegister ? "Cadastrar como advogado" : "Entrar como advogado"}
      </h1>
      <p style={{ fontSize: 14, color: "#888", marginBottom: 32, textAlign: "center" }}>
        {isRegister ? "Insira seus dados profissionais para verificação." : "Use seu número de OAB para acessar."}
      </p>

      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
        {isRegister && (
          <input
            value={nameInput} onChange={e => setNameInput(e.target.value)}
            placeholder="Nome completo"
            style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: "1px solid #e5e5e5", fontSize: 14, outline: "none", background: "#fff", boxSizing: "border-box" }}
          />
        )}

        <input
          value={oabInput} onChange={e => setOabInput(e.target.value)}
          placeholder="Número OAB (ex: OAB/SP 123.456)"
          style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: "1px solid #e5e5e5", fontSize: 14, outline: "none", background: "#fff", boxSizing: "border-box" }}
        />

        {isRegister && (
          <select
            value={specialtyInput} onChange={e => setSpecialtyInput(e.target.value)}
            style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: "1px solid #e5e5e5", fontSize: 14, outline: "none", background: "#fff", boxSizing: "border-box" }}
          >
            {["Criminal", "Trabalhista", "Civil", "Trânsito", "Família", "Geral"].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

        {error && <p style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>{error}</p>}

        <button
          onClick={isRegister ? handleRegister : handleLoginByOab}
          disabled={isLoading || !oabInput.trim()}
          style={{
            width: "100%", padding: "16px", background: isLoading ? "#ccc" : "#1a3a2a",
            color: "#fff", border: "none", borderRadius: 14, fontWeight: 700,
            fontSize: 15, cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? "Verificando..." : isRegister ? "Enviar para verificação" : "Entrar"}
        </button>

        <button
          onClick={() => { setIsRegister(!isRegister); setError(""); }}
          style={{ background: "none", border: "none", color: "#1a3a2a", fontWeight: 700, fontSize: 14, cursor: "pointer", padding: "8px 0" }}
        >
          {isRegister ? "Já tenho cadastro → Entrar" : "Não tenho cadastro → Cadastrar"}
        </button>
      </div>
    </div>
  );
}

// ─── Lawyer Home ──────────────────────────────────────────────────────────────
function LawyerHome({ lawyer, isOnDuty, onToggleDuty, stats, activeEmergency, onOpenChat, onComplete, setView }: any) {
  return (
    <div style={{ padding: "20px 20px 120px" }}>
      {/* Duty toggle */}
      <div style={{ background: isOnDuty ? "#052e16" : "#f5f5f0", borderRadius: 20, padding: "20px 24px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", border: isOnDuty ? "1px solid #166534" : "1px solid #e5e5e5" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: isOnDuty ? "#4ade80" : "#666" }}>
            {isOnDuty ? "● Você está de plantão" : "○ Fora do plantão"}
          </div>
          <div style={{ fontSize: 12, color: isOnDuty ? "rgba(74,222,128,0.6)" : "#aaa", marginTop: 4 }}>
            {isOnDuty ? "Recebendo chamados de emergência" : "Ative para receber chamados"}
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onToggleDuty}
          style={{
            padding: "10px 20px", borderRadius: 12, border: "none", fontWeight: 700,
            cursor: "pointer", fontSize: 13,
            background: isOnDuty ? "rgba(220,38,38,0.2)" : "#1a3a2a",
            color: isOnDuty ? "#f87171" : "#4ade80",
          }}
        >
          {isOnDuty ? "Sair" : "Ativar"}
        </motion.button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <StatCard label="Ganhos totais" value={`R$ ${(stats.totalEarnings ?? 0).toFixed(2)}`} icon={<DollarSign size={18} color="#16a34a" />} bg="#f0fdf4" />
        <StatCard label="Atendimentos" value={stats.totalEmergencies ?? 0} icon={<TrendingUp size={18} color="#1d4ed8" />} bg="#eff6ff" />
      </div>

      {/* Active call */}
      {activeEmergency ? (
        <div style={{ background: "#fff", border: "2px solid #1a3a2a", borderRadius: 20, padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: "#16a34a", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={16} /> Atendimento ativo
          </div>
          <div style={{ fontSize: 14, color: "#444", marginBottom: 16 }}>{activeEmergency.specialty}</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onOpenChat} style={{ flex: 2, padding: "12px", background: "#1a3a2a", color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>
              Abrir chat
            </button>
            <button onClick={onComplete} style={{ flex: 1, padding: "12px", background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
              Finalizar
            </button>
          </div>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px dashed #e5e5e5", borderRadius: 20, padding: 32, textAlign: "center", color: "#ccc", marginBottom: 20 }}>
          <Clock size={32} style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 14 }}>{isOnDuty ? "Aguardando chamados..." : "Ative o plantão para receber chamados."}</div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <QuickAction icon={<History size={18} />} label="Histórico" onClick={() => setView("history")} />
        <QuickAction icon={<DollarSign size={18} />} label="Meus ganhos" onClick={() => setView("earnings")} />
        <QuickAction icon={<User size={18} />} label="Meu perfil" onClick={() => setView("profile")} />
        <QuickAction icon={<Settings size={18} />} label="Configurações" onClick={() => setView("settings")} />
      </div>
    </div>
  );
}

// ─── Lawyer Chat ──────────────────────────────────────────────────────────────
function LawyerChat({ messages, emergency, onSend, onBack, timer, onComplete }: any) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input);
    setInput("");
  };

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 12, background: "#fff" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }}><ArrowLeft size={20} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Cliente em emergência</div>
          <div style={{ fontSize: 11, color: "#16a34a" }}>● {emergency?.specialty} · {timer}</div>
        </div>
        <button onClick={onComplete} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "6px 12px", color: "#16a34a", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          Finalizar
        </button>
        <button style={{ width: 36, height: 36, borderRadius: 10, background: "#f5f5f0", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Phone size={16} color="#666" />
        </button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 10, background: "#F8F7F4" }}>
        {messages.map((msg: Message, i: number) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", flexDirection: "column", alignItems: msg.sender === "Você" ? "flex-end" : "flex-start", maxWidth: "80%", alignSelf: msg.sender === "Você" ? "flex-end" : "flex-start" }}>
            <div style={{
              padding: "12px 16px",
              borderRadius: msg.sender === "Você" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: msg.sender === "Você" ? "#1a3a2a" : "#fff",
              border: msg.sender !== "Você" ? "1px solid #e5e5e5" : "none",
              fontSize: 14, lineHeight: 1.5,
              color: msg.sender === "Você" ? "#fff" : "#1a1a1a",
            }}>
              {msg.message}
            </div>
            <div style={{ fontSize: 10, color: "#aaa", marginTop: 4, padding: "0 4px" }}>
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </motion.div>
        ))}
      </div>

      <div style={{ padding: "12px 16px 32px", borderTop: "1px solid #f0f0f0", background: "#fff" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#f8f7f4", borderRadius: 16, padding: "4px 4px 4px 16px", border: "1px solid #e5e5e5" }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder="Responda ao cliente..."
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#1a1a1a", fontSize: 14, padding: "8px 0" }} />
          <button onClick={handleSend} style={{ width: 36, height: 36, borderRadius: 12, background: "#1a3a2a", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Send size={16} color="#4ade80" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Lawyer History ───────────────────────────────────────────────────────────
function LawyerHistory({ history, onBack }: any) {
  return (
    <div style={{ padding: "8px 20px 120px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 14, padding: "8px 0 24px" }}>
        <ArrowLeft size={16} /> Voltar
      </button>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>Histórico</h2>
      {history.length === 0 ? (
        <div style={{ textAlign: "center", color: "#ccc", padding: "60px 0", fontSize: 14 }}>Nenhum atendimento ainda.</div>
      ) : history.map((h: any, i: number) => (
        <div key={i} style={{ padding: 16, background: "#fff", borderRadius: 16, marginBottom: 10, border: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{h.specialty}</div>
            <div style={{ fontSize: 12, color: "#999" }}>{new Date(h.created_at).toLocaleDateString("pt-BR")}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700, color: "#16a34a", fontSize: 14 }}>+ R$ {((h.price_per_minute ?? 7) * 10).toFixed(2)}</div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: h.status === "completed" ? "#f0fdf4" : "#eff6ff", color: h.status === "completed" ? "#16a34a" : "#1d4ed8", textTransform: "uppercase" }}>
              {h.status === "completed" ? "Concluído" : "Em andamento"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Lawyer Earnings ──────────────────────────────────────────────────────────
function LawyerEarnings({ stats, history, onBack, lawyer }: any) {
  const thisMonth = history.filter((h: any) => {
    const d = new Date(h.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && h.status === "completed";
  });
  const monthEarnings = thisMonth.reduce((s: number, h: any) => s + (h.price_per_minute ?? lawyer?.price_per_minute ?? 7) * 10, 0);

  return (
    <div style={{ padding: "8px 20px 120px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 14, padding: "8px 0 24px" }}>
        <ArrowLeft size={16} /> Voltar
      </button>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>Meus Ganhos</h2>
      <div style={{ background: "#1a3a2a", borderRadius: 24, padding: 28, marginBottom: 20, color: "#fff" }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Total acumulado</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: "#4ade80", marginBottom: 16 }}>R$ {(stats.totalEarnings ?? 0).toFixed(2)}</div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Este mês</div>
            <div style={{ fontWeight: 700, color: "#86efac" }}>R$ {monthEarnings.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Atendimentos</div>
            <div style={{ fontWeight: 700, color: "#86efac" }}>{stats.totalEmergencies ?? 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Preço/min</div>
            <div style={{ fontWeight: 700, color: "#86efac" }}>R$ {(lawyer?.price_per_minute ?? 7).toFixed(2)}</div>
          </div>
        </div>
      </div>
      <div style={{ background: "#fff3cd", border: "1px solid #fde68a", borderRadius: 16, padding: 16, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, color: "#92400e", fontSize: 14, marginBottom: 4 }}>💳 Saque disponível em breve</div>
        <div style={{ fontSize: 12, color: "#a16207" }}>Integração com Pagar.me e PIX em desenvolvimento.</div>
      </div>
    </div>
  );
}

// ─── Lawyer Profile ───────────────────────────────────────────────────────────
function LawyerProfile({ lawyer, onBack }: any) {
  return (
    <div style={{ padding: "8px 20px 120px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 14, padding: "8px 0 24px" }}>
        <ArrowLeft size={16} /> Voltar
      </button>
      <div style={{ textAlign: "center", padding: "0 0 32px" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <User size={36} color="#ccc" />
        </div>
        <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>{lawyer?.name}</div>
        <div style={{ fontSize: 13, color: "#888" }}>{lawyer?.specialty} · {lawyer?.oab}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 8, color: "#f59e0b" }}>
          <Star size={14} fill="#f59e0b" />
          <span style={{ fontWeight: 700 }}>{lawyer?.rating}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <InfoRow label="OAB" value={lawyer?.oab ?? "—"} />
        <InfoRow label="Especialidade" value={lawyer?.specialty ?? "—"} />
        <InfoRow label="Preço por minuto" value={`R$ ${(lawyer?.price_per_minute ?? 0).toFixed(2)}`} />
        <InfoRow label="Status verificação" value={lawyer?.verification_status === "approved" ? "✓ Aprovado" : lawyer?.verification_status === "pending" ? "⏳ Em análise" : "✗ Reprovado"} />
      </div>
    </div>
  );
}

// ─── Lawyer Settings ──────────────────────────────────────────────────────────
function LawyerSettings({ onBack }: any) {
  return (
    <div style={{ padding: "8px 20px 40px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 14, padding: "8px 0 24px" }}>
        <ArrowLeft size={16} /> Voltar
      </button>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>Configurações</h2>
      {["Notificações", "Privacidade", "Suporte", "Termos de uso"].map(item => (
        <button key={item} style={{ width: "100%", padding: "16px 20px", background: "#fff", border: "1px solid #f0f0f0", borderRadius: 14, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", color: "#1a1a1a", fontSize: 14, fontWeight: 500 }}>
          {item} <ChevronRight size={16} color="#ccc" />
        </button>
      ))}
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────
function NavBtn({ icon, label, active, onClick, color }: any) {
  return (
    <button onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: active ? (color ?? "#1a3a2a") : "#ccc", fontSize: 10, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>
      {icon}{label}
    </button>
  );
}

function StatCard({ label, value, icon, bg }: any) {
  return (
    <div style={{ background: bg ?? "#f8f7f4", borderRadius: 16, padding: "16px 18px", border: "1px solid #f0f0f0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>{label}</span>
        {icon}
      </div>
      <div style={{ fontWeight: 800, fontSize: 20, color: "#1a1a1a" }}>{value}</div>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: any) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick} style={{ padding: "16px", background: "#fff", border: "1px solid #f0f0f0", borderRadius: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, color: "#1a1a1a", fontSize: 14, fontWeight: 600 }}>
      <span style={{ color: "#888" }}>{icon}</span>{label}
    </motion.button>
  );
}

function InfoRow({ label, value }: any) {
  return (
    <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 14, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "#999", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 14, color: "#1a1a1a" }}>{value}</span>
    </div>
  );
}
