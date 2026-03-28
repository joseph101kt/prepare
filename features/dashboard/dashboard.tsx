"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TriageLevel = "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
type StatusKey = "incoming" | "acknowledged" | "preparing" | "arrived" | "completed";

interface Patient {
  name: string;
  age: number;
  gender: string;
  insurance: string;
}

interface Vitals {
  hr: number;
  bp: string;
  spo2: number;
  glucose: number;
}

interface Emergency {
  id: string;
  patient: Patient;
  triage_level: TriageLevel;
  risk_score: number;
  confidence: number;
  status: StatusKey;
  eta: string;
  symptoms: string[];
  vitals: Vitals;
  ai_summary: string;
  checklist: string[];
  extracted_text: string | null;
  created_at: string;
}

// ─── Static Data ──────────────────────────────────────────────────────────────

const EMERGENCIES: Emergency[] = [
  {
    id: "E-001",
    patient: { name: "Arjun Mehta", age: 58, gender: "M", insurance: "INS-4821" },
    triage_level: "CRITICAL",
    risk_score: 94,
    confidence: 91,
    status: "incoming",
    eta: "4 min",
    symptoms: ["chest pain", "shortness of breath", "diaphoresis"],
    vitals: { hr: 118, bp: "88/60", spo2: 91, glucose: 142 },
    ai_summary:
      "High probability of STEMI. Hemodynamic instability noted. Immediate cath lab activation recommended. Risk of cardiogenic shock.",
    checklist: [
      "Activate cath lab",
      "Prepare defibrillator",
      "IV access x2",
      "12-lead ECG on arrival",
      "Cardiology on standby",
    ],
    extracted_text: "ECG report: ST elevation V1–V4. Troponin pending.",
    created_at: "09:14",
  },
  {
    id: "E-002",
    patient: { name: "Priya Nair", age: 34, gender: "F", insurance: "INS-9034" },
    triage_level: "HIGH",
    risk_score: 72,
    confidence: 85,
    status: "acknowledged",
    eta: "11 min",
    symptoms: ["severe headache", "vomiting", "photophobia"],
    vitals: { hr: 96, bp: "158/100", spo2: 98, glucose: 110 },
    ai_summary:
      "Presentation consistent with hypertensive crisis or subarachnoid hemorrhage. CT head required urgently. Neurological assessment on arrival.",
    checklist: [
      "CT head STAT",
      "Neuro consult",
      "BP monitoring",
      "Dark quiet room",
      "Anti-emetic ready",
    ],
    extracted_text: null,
    created_at: "09:22",
  },
  {
    id: "E-003",
    patient: { name: "Ravi Shankar", age: 72, gender: "M", insurance: "INS-2201" },
    triage_level: "HIGH",
    risk_score: 68,
    confidence: 78,
    status: "preparing",
    eta: "7 min",
    symptoms: ["sudden weakness left arm", "slurred speech", "facial droop"],
    vitals: { hr: 84, bp: "170/95", spo2: 96, glucose: 188 },
    ai_summary:
      "FAST positive. Acute ischemic stroke likely. Last known well 40 min ago — within thrombolysis window. Stroke team activation critical.",
    checklist: [
      "Stroke team alert",
      "CT + CTA head/neck",
      "tPA eligibility check",
      "Glucose correction",
      "NPO status",
    ],
    extracted_text: "Paramedic note: onset 09:00, witnessed by wife.",
    created_at: "09:27",
  },
  {
    id: "E-004",
    patient: { name: "Sneha Kulkarni", age: 28, gender: "F", insurance: "INS-7712" },
    triage_level: "MODERATE",
    risk_score: 41,
    confidence: 88,
    status: "arrived",
    eta: "—",
    symptoms: ["right lower quadrant pain", "nausea", "low-grade fever"],
    vitals: { hr: 92, bp: "118/76", spo2: 99, glucose: 95 },
    ai_summary:
      "Presentation consistent with acute appendicitis. Rebound tenderness likely. Surgical consult and abdominal ultrasound recommended.",
    checklist: [
      "Surgical consult",
      "Abdominal US",
      "CBC + CRP",
      "Urine pregnancy test",
      "NPO",
    ],
    extracted_text: null,
    created_at: "09:08",
  },
  {
    id: "E-005",
    patient: { name: "Kiran Desai", age: 19, gender: "M", insurance: "INS-3390" },
    triage_level: "LOW",
    risk_score: 18,
    confidence: 93,
    status: "completed",
    eta: "—",
    symptoms: ["mild fever", "sore throat", "fatigue"],
    vitals: { hr: 78, bp: "120/80", spo2: 99, glucose: 88 },
    ai_summary:
      "Likely viral upper respiratory tract infection. Supportive care. Monitor for secondary bacterial infection.",
    checklist: ["Throat swab", "Paracetamol", "Hydration", "Follow-up if worsening"],
    extracted_text: null,
    created_at: "08:55",
  },
];

const TRIAGE_CFG: Record<TriageLevel, { color: string; bg: string }> = {
  CRITICAL: { color: "#ef4444", bg: "rgba(239,68,68,0.10)" },
  HIGH:     { color: "#f97316", bg: "rgba(249,115,22,0.10)" },
  MODERATE: { color: "#3b82f6", bg: "rgba(59,130,246,0.10)" },
  LOW:      { color: "#22c55e", bg: "rgba(34,197,94,0.10)" },
};

const STATUS_LABELS: Record<StatusKey, string> = {
  incoming: "Incoming", acknowledged: "Acknowledged",
  preparing: "Preparing", arrived: "Arrived", completed: "Completed",
};
const STATUS_COLORS: Record<StatusKey, string> = {
  incoming: "#ef4444", acknowledged: "#3b82f6",
  preparing: "#f97316", arrived: "#6366f1", completed: "#22c55e",
};
const STATUSES: StatusKey[] = ["incoming", "acknowledged", "preparing", "arrived", "completed"];

// ─── Waveform helpers ─────────────────────────────────────────────────────────

function ecgY(x: number, bpm: number): number {
  const period = 500 * (60 / bpm);
  const n = (((x % period) + period) % period) / period;
  if (n < 0.05)  return 0.5 + n * 2;
  if (n < 0.08)  return 0.6 - (n - 0.05) * 10;
  if (n < 0.13)  return 0.3 + (n - 0.08) * 2;
  if (n < 0.17)  return 0.41 - ((n - 0.13) / 0.04) * 2.6;
  if (n < 0.22)  return -2.19 + ((n - 0.17) / 0.05) * 3.0;
  if (n < 0.27)  return 0.81 - ((n - 0.22) / 0.05) * 0.5;
  if (n < 0.32)  return 0.31 + ((n - 0.27) / 0.05) * 0.19;
  return 0.5 + Math.sin(n * Math.PI * 8) * 0.015 * (1 - n);
}

function spo2Y(x: number, bpm: number): number {
  const period = 500 * (60 / bpm);
  const n = (((x % period) + period) % period) / period;
  return 0.88 - Math.pow(Math.sin(Math.max(0, n) * Math.PI), 2.2) * 0.72;
}

function triageWaveColor(triage: TriageLevel): string {
  return TRIAGE_CFG[triage].color;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RiskBar({ score, color }: { score: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontFamily: "monospace", fontSize: 11, color, fontWeight: 700, minWidth: 22, textAlign: "right" as const }}>{score}</span>
    </div>
  );
}

function PulseDot({ color }: { color: string }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8, flexShrink: 0 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: 0.5, animation: "ping 1.4s ease infinite" }} />
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "block" }} />
    </span>
  );
}

function VitalCard({ label, value, alert }: { label: string; value: string; alert: boolean }) {
  return (
    <div style={{
      borderRadius: 10, padding: "12px 14px",
      border: `1px solid ${alert ? "rgba(239,68,68,0.25)" : "var(--bd)"}`,
      background: alert ? "rgba(239,68,68,0.07)" : "var(--bg3)",
      transition: "all 0.3s",
    }}>
      <div style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 5, color: alert ? "#ef4444" : "var(--t3)" }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 600, fontFamily: "monospace", color: alert ? "#ef4444" : "var(--t1)" }}>{value}</div>
    </div>
  );
}

// Clickable Checklist Item
function ChecklistItem({ text, checked, onToggle }: { text: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        background: "none", border: "none", cursor: "pointer",
        padding: "7px 9px", borderRadius: 8, width: "100%", textAlign: "left" as const,
        transition: "background 0.15s",
        backgroundColor: checked ? "rgba(34,197,94,0.06)" : "transparent",
      }}
      onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = checked ? "rgba(34,197,94,0.06)" : "transparent"; }}
    >
      <div style={{
        width: 17, height: 17, borderRadius: 5, flexShrink: 0, marginTop: 1,
        border: `1.5px solid ${checked ? "#22c55e" : "rgba(59,130,246,0.35)"}`,
        background: checked ? "rgba(34,197,94,0.18)" : "rgba(59,130,246,0.05)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.2s",
      }}>
        {checked && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <span style={{
        fontSize: 12, lineHeight: 1.5,
        color: checked ? "var(--t3)" : "var(--t2)",
        textDecoration: checked ? "line-through" : "none",
        transition: "all 0.2s",
      }}>{text}</span>
    </button>
  );
}

// Live Waveform Canvas
function WaveCanvas({
  id, fn, color, offsetRef, liveHrRef,
}: {
  id: string;
  fn: (x: number, bpm: number) => number;
  color: string;
  offsetRef: React.MutableRefObject<number>;
  liveHrRef: React.MutableRefObject<number>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const isLight = document.body.classList.contains("light");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let running = true;

    function draw() {
      if (!running || !canvas) return;
      const W = canvas.offsetWidth || 500;
      const H = 88;
      const DPR = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== W * DPR) { canvas.width = W * DPR; canvas.height = H * DPR; }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      const light = document.body.classList.contains("light");
      const gridColor = light ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.04)";
      const bgFill    = light ? "rgba(221,230,240,0.7)" : "rgba(19,28,43,0.7)";

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = bgFill;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= W; x += W / 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y <= H; y += H / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";
      for (let px = 0; px <= W; px++) {
        const y = fn(offsetRef.current + px, liveHrRef.current) * H;
        if (px === 0) ctx.moveTo(px, y); else ctx.lineTo(px, y);
      }
      ctx.stroke();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [fn, color]);

  return <canvas ref={canvasRef} id={id} style={{ width: "100%", height: 88, display: "block", borderRadius: 6 }} />;
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function PrepareDashboard() {
  const [emergencies, setEmergencies] = useState<Emergency[]>(EMERGENCIES);
  const [selectedId, setSelectedId]   = useState("E-001");
  const [isDark, setIsDark]           = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // checklist state: { [emergencyId]: Set<number> }
  const [checked, setChecked] = useState<Record<string, Set<number>>>({});

  // Live vitals refs (shared across canvases)
  const ecgOffsetRef  = useRef(0);
  const spo2OffsetRef = useRef(0);
  const liveHrRef     = useRef(72);
  const targetHrRef   = useRef(72);
  const liveSpo2Ref   = useRef(98);
  const targetSpo2Ref = useRef(98);

  const [displayHr, setDisplayHr]     = useState(72);
  const [displaySpo2, setDisplaySpo2] = useState(98);
  const animRef = useRef<number>(0);

  const selected = emergencies.find(e => e.id === selectedId)!;
  const sorted   = [...emergencies].sort((a, b) => b.risk_score - a.risk_score);
  const cfg      = TRIAGE_CFG[selected.triage_level];
  const ci       = STATUSES.indexOf(selected.status);
  const checkedSet = checked[selectedId] ?? new Set<number>();

  // Theme effect
  useEffect(() => {
    if (isDark) document.body.classList.remove("light");
    else document.body.classList.add("light");
  }, [isDark]);

  // Reset vitals on patient change
  useEffect(() => {
    targetHrRef.current   = selected.vitals.hr;
    targetSpo2Ref.current = selected.vitals.spo2;
    ecgOffsetRef.current  = 0;
    spo2OffsetRef.current = 0;
  }, [selectedId]);

  // Tick loop for offsets + display numbers
  useEffect(() => {
    let rafId: number;
    function tick() {
      ecgOffsetRef.current  += 2.8;
      spo2OffsetRef.current += 2.8;
      liveHrRef.current   += (targetHrRef.current   - liveHrRef.current)   * 0.015;
      liveSpo2Ref.current += (targetSpo2Ref.current - liveSpo2Ref.current) * 0.008;
      setDisplayHr(Math.round(liveHrRef.current + (Math.random() - 0.5) * 1.4));
      setDisplaySpo2(Math.round(liveSpo2Ref.current + (Math.random() - 0.5) * 0.25));
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const updateStatus = (val: StatusKey) => {
    setEmergencies(prev => prev.map(e => e.id === selectedId ? { ...e, status: val } : e));
  };

  const toggleCheck = (idx: number) => {
    setChecked(prev => {
      const s = new Set(prev[selectedId] ?? []);
      if (s.has(idx)) s.delete(idx); else s.add(idx);
      return { ...prev, [selectedId]: s };
    });
  };

  const incomingCount = emergencies.filter(e => e.status === "incoming").length;
  const criticalCount = emergencies.filter(e => e.triage_level === "CRITICAL").length;
  const doneCount = checkedSet.size;
  const totalCount = selected.checklist.length;

  // Memoized wave fns with stable identity
  const ecgFn  = useCallback(ecgY,  []);
  const spo2Fn = useCallback(spo2Y, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Plus+Jakarta+Sans:wght@700;800&display=swap');
        :root {
          --bg0:#0c111a;--bg1:#0e1520;--bg2:#131c2b;--bg3:rgba(255,255,255,0.03);
          --bd:rgba(255,255,255,0.06);--bd2:rgba(255,255,255,0.10);
          --t1:#f1f5f9;--t2:#94a3b8;--t3:#475569;--t4:#1e3a5f;
        }
        body.light {
          --bg0:#f0f4f8;--bg1:#e8eef5;--bg2:#dde6f0;--bg3:rgba(0,0,0,0.03);
          --bd:rgba(0,0,0,0.08);--bd2:rgba(0,0,0,0.14);
          --t1:#0f172a;--t2:#334155;--t3:#64748b;--t4:#94a3b8;
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body { background: var(--bg0); color: var(--t2); font-family: 'DM Mono','Fira Code',monospace; overflow: hidden; transition: background 0.35s, color 0.35s; }
        @keyframes ping { 75%,100% { transform:scale(2.2); opacity:0; } }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.4;transform:scale(0.65);} }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: var(--bd2); border-radius: 2px; }
        select option { background: var(--bg2); }
      `}</style>

      <div style={{ display: "flex", height: "100vh", background: "var(--bg0)", overflow: "hidden" }}>

        {/* ── SIDEBAR ── */}
        <div style={{
          width: sidebarOpen ? 260 : 60,
          background: "var(--bg1)",
          borderRight: "1px solid var(--bd)",
          display: "flex", flexDirection: "column",
          flexShrink: 0,
          transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
          overflow: "hidden",
        }}>

          {/* Brand + collapse button */}
          <div style={{ padding: "18px 14px 14px", borderBottom: "1px solid var(--bd)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: sidebarOpen ? 14 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, flexShrink: 0,
                  background: "linear-gradient(135deg,#1d4ed8,#3b82f6)",
                  borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                </div>
                {sidebarOpen && (
                  <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
                    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 14, color: "var(--t1)", letterSpacing: "0.1em" }}>PREPARE</div>
                    <div style={{ fontSize: 9, color: "var(--t4)", letterSpacing: "0.1em" }}>EMERGENCY DASHBOARD</div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setSidebarOpen(v => !v)}
                title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                style={{
                  background: "var(--bg3)", border: "1px solid var(--bd2)",
                  borderRadius: 7, width: 28, height: 28, display: "flex", alignItems: "center",
                  justifyContent: "center", cursor: "pointer", flexShrink: 0, color: "var(--t3)",
                  transition: "background 0.2s",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {sidebarOpen
                    ? <><polyline points="15 18 9 12 15 6"/></>
                    : <><polyline points="9 18 15 12 9 6"/></>}
                </svg>
              </button>
            </div>

            {sidebarOpen && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                {[
                  { label: "INCOMING", value: incomingCount, alert: incomingCount > 0 },
                  { label: "CRITICAL", value: criticalCount, alert: criticalCount > 0 },
                ].map(s => (
                  <div key={s.label} style={{
                    borderRadius: 9, padding: "9px 11px",
                    background: s.alert ? "rgba(239,68,68,0.07)" : "var(--bg3)",
                    border: `1px solid ${s.alert ? "rgba(239,68,68,0.2)" : "var(--bd)"}`,
                    transition: "all 0.3s",
                  }}>
                    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 22, fontWeight: 700, color: s.alert ? "#ef4444" : "var(--t4)" }}>{s.value}</div>
                    <div style={{ fontSize: 9, letterSpacing: "0.08em", color: s.alert ? "var(--t3)" : "var(--t4)", marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Case list */}
          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
            {sidebarOpen && (
              <div style={{ fontSize: 9, color: "var(--t4)", letterSpacing: "0.1em", padding: "5px 8px 10px", textTransform: "uppercase" }}>
                Cases · by risk
              </div>
            )}
            {sorted.map(e => {
              const c = TRIAGE_CFG[e.triage_level];
              const isCrit = e.triage_level === "CRITICAL" && e.status === "incoming";
              const isSelected = e.id === selectedId;
              return (
                <div
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  title={!sidebarOpen ? `${e.patient.name} · ${e.triage_level}` : undefined}
                  style={{
                    padding: sidebarOpen ? "10px 11px" : "10px 0",
                    borderRadius: 9, marginBottom: 3, cursor: "pointer",
                    border: `1px solid ${isSelected ? "rgba(59,130,246,0.22)" : "transparent"}`,
                    background: isSelected ? "rgba(59,130,246,0.09)" : "transparent",
                    transition: "all 0.15s",
                    display: "flex", flexDirection: sidebarOpen ? "column" : "column", alignItems: sidebarOpen ? "stretch" : "center",
                  }}
                >
                  {sidebarOpen ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 7 }}>
                        <div>
                          <div style={{ fontSize: 12, color: "var(--t1)", fontWeight: 500 }}>{e.patient.name}</div>
                          <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 2 }}>{e.patient.age}y {e.patient.gender} · {e.id}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          {isCrit && <PulseDot color={c.color} />}
                          <span style={{ fontSize: 9, fontWeight: 700, color: c.color, background: c.bg, padding: "3px 7px", borderRadius: 5 }}>{e.triage_level}</span>
                        </div>
                      </div>
                      <div style={{ marginBottom: 5 }}>
                        <RiskBar score={e.risk_score} color={c.color} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 9, color: STATUS_COLORS[e.status], opacity: 0.85 }}>{STATUS_LABELS[e.status]}</span>
                        {e.status === "incoming" && <span style={{ fontSize: 9, color: "var(--t3)" }}>ETA {e.eta}</span>}
                      </div>
                    </>
                  ) : (
                    <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                      {isCrit && (
                        <span style={{ position: "absolute", top: -2, right: -2, width: 5, height: 5, borderRadius: "50%", background: "#ef4444", animation: "ping 1.4s ease infinite", opacity: 0.7 }} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Doctor */}
          {sidebarOpen && (
            <div style={{ padding: "13px 16px", borderTop: "1px solid var(--bd)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#3b82f6", fontWeight: 600, flexShrink: 0 }}>A</div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--t2)" }}>Dr. A. Sharma</div>
                  <div style={{ fontSize: 9, color: "var(--t4)" }}>City General Hospital</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── MAIN ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* Topbar */}
          <div style={{
            padding: "14px 24px", borderBottom: "1px solid var(--bd)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "var(--bg1)", flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 3, height: 42, borderRadius: 2, background: cfg.color, flexShrink: 0,
                boxShadow: selected.triage_level === "CRITICAL" ? `0 0 14px ${cfg.color}` : "none",
                transition: "background 0.3s, box-shadow 0.3s",
              }} />
              <div>
                <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 19, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>
                  {selected.patient.name}
                </div>
                <div style={{ fontSize: 10, color: "var(--t3)", display: "flex", gap: 8, marginTop: 3 }}>
                  <span>{selected.patient.age}y · {selected.patient.gender}</span>
                  <span style={{ color: "var(--bd2)" }}>·</span>
                  <span>{selected.patient.insurance}</span>
                  <span style={{ color: "var(--bd2)" }}>·</span>
                  <span>{selected.id}</span>
                  <span style={{ color: "var(--bd2)" }}>·</span>
                  <span style={{ color: "var(--t4)" }}>{selected.created_at}</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Theme toggle */}
              <button
                onClick={() => setIsDark(v => !v)}
                style={{
                  background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                  border: "1px solid var(--bd2)", color: "var(--t2)",
                  borderRadius: 8, padding: "6px 12px", fontSize: 11,
                  fontFamily: "inherit", cursor: "pointer", display: "flex",
                  alignItems: "center", gap: 6, transition: "all 0.2s",
                }}
              >
                <span>{isDark ? "☀️" : "🌙"}</span>
                <span style={{ fontSize: 10 }}>{isDark ? "Light" : "Dark"}</span>
              </button>

              {/* Triage badge */}
              <div style={{
                border: `1px solid ${cfg.color}`, color: cfg.color,
                fontSize: 11, fontWeight: 700, padding: "6px 13px",
                borderRadius: 7, background: cfg.bg, letterSpacing: "0.06em",
                transition: "all 0.3s",
              }}>
                {selected.triage_level}
              </div>

              {/* Status select */}
              <select
                value={selected.status}
                onChange={e => updateStatus(e.target.value as StatusKey)}
                style={{
                  background: "var(--bg3)", border: "1px solid var(--bd2)",
                  color: "var(--t2)", borderRadius: 8, padding: "7px 12px",
                  fontSize: 11, fontFamily: "inherit", cursor: "pointer", outline: "none",
                }}
              >
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Timeline */}
            <div style={{ background: "var(--bg3)", border: "1px solid var(--bd)", borderRadius: 12, padding: "14px 20px" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                {STATUSES.map((s, i) => {
                  const done = i <= ci, isCur = i === ci;
                  const sc = STATUS_COLORS[s];
                  return (
                    <div key={s} style={{ display: "flex", alignItems: "center", flex: i < STATUSES.length - 1 ? 1 : undefined }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          border: `2px solid ${done ? sc : "var(--bd)"}`,
                          background: isCur ? sc : done ? "rgba(255,255,255,0.1)" : "transparent",
                          boxShadow: isCur ? `0 0 10px ${sc}66` : "none",
                          transition: "all 0.3s",
                        }}>
                          {done && !isCur && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                          {isCur && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "white" }} />}
                        </div>
                        <span style={{ fontSize: 9, color: done ? "var(--t3)" : "var(--t4)", letterSpacing: "0.04em", whiteSpace: "nowrap", textTransform: "uppercase" }}>
                          {STATUS_LABELS[s]}
                        </span>
                      </div>
                      {i < STATUSES.length - 1 && (
                        <div style={{ flex: 1, height: 2, marginBottom: 20, background: i < ci ? "rgba(255,255,255,0.12)" : "var(--bd)", transition: "background 0.3s" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Vitals row */}
            <div>
              <div style={{ fontSize: 9, color: "var(--t4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 9 }}>Vitals</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                <VitalCard label="Heart Rate"     value={`${selected.vitals.hr} bpm`}       alert={selected.vitals.hr > 110 || selected.vitals.hr < 50} />
                <VitalCard label="Blood Pressure" value={selected.vitals.bp}                  alert={false} />
                <VitalCard label="SpO₂"           value={`${selected.vitals.spo2}%`}          alert={selected.vitals.spo2 < 93} />
                <VitalCard label="Glucose"        value={`${selected.vitals.glucose} mg/dL`}  alert={false} />
              </div>
            </div>

            {/* Live waveforms */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* ECG */}
              <div style={{ background: "var(--bg3)", border: "1px solid var(--bd)", borderRadius: 12, padding: "13px 15px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10, color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "pulse-dot 1.5s ease infinite" }} />
                    ECG · Live Rhythm
                  </div>
                  <div>
                    <span style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, color: triageWaveColor(selected.triage_level), transition: "color 0.3s" }}>{displayHr}</span>
                    <span style={{ fontSize: 10, color: "var(--t3)", marginLeft: 2 }}>bpm</span>
                  </div>
                </div>
                <WaveCanvas id="ecg" fn={ecgFn} color={triageWaveColor(selected.triage_level)} offsetRef={ecgOffsetRef} liveHrRef={liveHrRef} />
              </div>

              {/* SpO2 */}
              <div style={{ background: "var(--bg3)", border: "1px solid var(--bd)", borderRadius: 12, padding: "13px 15px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10, color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", display: "inline-block", animation: "pulse-dot 1.5s ease infinite" }} />
                    SpO₂ · Pleth Wave
                  </div>
                  <div style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
                    <div>
                      <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: "#3b82f6" }}>{displaySpo2}</span>
                      <span style={{ fontSize: 10, color: "var(--t3)", marginLeft: 2 }}>%</span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--t3)" }}>
                      BP&nbsp;<span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>{selected.vitals.bp}</span>
                    </div>
                  </div>
                </div>
                <WaveCanvas id="spo2" fn={spo2Fn} color="#3b82f6" offsetRef={spo2OffsetRef} liveHrRef={liveHrRef} />
              </div>
            </div>

            {/* AI summary + side panels */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 250px", gap: 14 }}>

              {/* AI card */}
              <div style={{ background: "var(--bg3)", border: "1px solid var(--bd)", borderRadius: 12, padding: "15px 17px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1" }} />
                  <span style={{ fontSize: 9, color: "var(--t3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>AI Summary</span>
                  <span style={{ fontSize: 9, color: "var(--t4)", marginLeft: "auto" }}>confidence {selected.confidence}%</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.75 }}>{selected.ai_summary}</p>
                {selected.extracted_text && (
                  <div style={{ marginTop: 12, padding: "9px 12px", background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.14)", borderRadius: 8 }}>
                    <div style={{ fontSize: 9, color: "#6366f1", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>OCR Extract</div>
                    <p style={{ fontSize: 11, color: "var(--t3)", fontStyle: "italic" }}>{selected.extracted_text}</p>
                  </div>
                )}
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 9, color: "var(--t4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 7 }}>Risk Score</div>
                  <RiskBar score={selected.risk_score} color={cfg.color} />
                </div>
              </div>

              {/* Side: symptoms + checklist */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Symptoms */}
                <div style={{ background: "var(--bg3)", border: "1px solid var(--bd)", borderRadius: 12, padding: "13px 15px" }}>
                  <div style={{ fontSize: 9, color: "var(--t4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 9 }}>Symptoms</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {selected.symptoms.map(s => (
                      <span key={s} style={{ fontSize: 10, color: "var(--t3)", background: "var(--bg2)", border: "1px solid var(--bd)", padding: "3px 9px", borderRadius: 20 }}>{s}</span>
                    ))}
                  </div>
                </div>

                {/* Checklist */}
                <div style={{ background: "var(--bg3)", border: "1px solid var(--bd)", borderRadius: 12, padding: "13px 15px", flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 9, color: "var(--t4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Prep Checklist</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {/* Progress pill */}
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
                        color: doneCount === totalCount ? "#22c55e" : "var(--t3)",
                        background: doneCount === totalCount ? "rgba(34,197,94,0.10)" : "var(--bg2)",
                        border: `1px solid ${doneCount === totalCount ? "rgba(34,197,94,0.25)" : "var(--bd)"}`,
                        padding: "2px 7px", borderRadius: 5, transition: "all 0.3s",
                      }}>
                        {doneCount}/{totalCount}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 2, background: "var(--bd)", borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
                    <div style={{
                      height: "100%", borderRadius: 99,
                      background: doneCount === totalCount ? "#22c55e" : "#3b82f6",
                      width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%`,
                      transition: "width 0.4s ease, background 0.3s",
                    }} />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {selected.checklist.map((item, i) => (
                      <ChecklistItem
                        key={`${selectedId}-${i}`}
                        text={item}
                        checked={checkedSet.has(i)}
                        onToggle={() => toggleCheck(i)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>{/* /content */}
        </div>{/* /main */}
      </div>
    </>
  );
}