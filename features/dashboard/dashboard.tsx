"use client";

import { useState } from "react";
import type { CSSProperties, ChangeEvent } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TriageLevel = "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
type StatusKey   = "incoming" | "acknowledged" | "preparing" | "arrived" | "completed";

interface Patient {
  name:      string;
  age:       number;
  gender:    string;
  insurance: string;
}

interface Vitals {
  hr:      number;
  bp:      string;
  spo2:    number;
  glucose: number;
}

interface Emergency {
  id:             string;
  patient:        Patient;
  triage_level:   TriageLevel;
  risk_score:     number;
  confidence:     number;
  status:         StatusKey;
  eta:            string;
  symptoms:       string[];
  vitals:         Vitals;
  ai_summary:     string;
  checklist:      string[];
  extracted_text: string | null;
  created_at:     string;
}

interface TriageMeta {
  color: string;
  bg:    string;
  label: string;
  pulse: boolean;
}

interface StatusMeta {
  label: string;
  color: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

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
    checklist: ["Activate cath lab", "Prepare defibrillator", "IV access x2", "12-lead ECG on arrival", "Cardiology on standby"],
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
    checklist: ["CT head STAT", "Neuro consult", "BP monitoring", "Dark quiet room", "Anti-emetic ready"],
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
    checklist: ["Stroke team alert", "CT + CTA head/neck", "tPA eligibility check", "Glucose correction", "NPO status"],
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
    checklist: ["Surgical consult", "Abdominal US", "CBC + CRP", "Urine pregnancy test", "NPO"],
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
    ai_summary: "Likely viral upper respiratory tract infection. Supportive care. Monitor for secondary bacterial infection.",
    checklist: ["Throat swab", "Paracetamol", "Hydration", "Follow-up if worsening"],
    extracted_text: null,
    created_at: "08:55",
  },
];

const TRIAGE_CONFIG: Record<TriageLevel, TriageMeta> = {
  CRITICAL: { color: "#ef4444", bg: "rgba(239,68,68,0.08)",  label: "CRITICAL", pulse: true  },
  HIGH:     { color: "#f97316", bg: "rgba(249,115,22,0.08)", label: "HIGH",     pulse: false },
  MODERATE: { color: "#3b82f6", bg: "rgba(59,130,246,0.08)", label: "MODERATE", pulse: false },
  LOW:      { color: "#22c55e", bg: "rgba(34,197,94,0.08)",  label: "LOW",      pulse: false },
};

const STATUS_CONFIG: Record<StatusKey, StatusMeta> = {
  incoming:     { label: "Incoming",     color: "#ef4444" },
  acknowledged: { label: "Acknowledged", color: "#3b82f6" },
  preparing:    { label: "Preparing",    color: "#f97316" },
  arrived:      { label: "Arrived",      color: "#6366f1" },
  completed:    { label: "Completed",    color: "#22c55e" },
};

const STATUSES: StatusKey[] = ["incoming", "acknowledged", "preparing", "arrived", "completed"];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface RiskBarProps {
  score: number;
  color: string;
}

function RiskBar({ score, color }: RiskBarProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontFamily: "monospace", fontSize: 12, color, fontWeight: 700, minWidth: 28, textAlign: "right" as CSSProperties["textAlign"] }}>
        {score}
      </span>
    </div>
  );
}

interface VitalBadgeProps {
  label: string;
  value: string;
  alert: boolean;
}

function VitalBadge({ label, value, alert }: VitalBadgeProps) {
  return (
    <div style={{
      background: alert ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.03)",
      border:     `1px solid ${alert ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 10,
      padding: "12px 14px",
    }}>
      <div style={{ fontSize: 9, color: alert ? "#ef4444" : "#334155", letterSpacing: "0.1em", marginBottom: 5, textTransform: "uppercase" as CSSProperties["textTransform"] }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: alert ? "#ef4444" : "#e2e8f0", fontFamily: "monospace" }}>
        {value}
      </div>
    </div>
  );
}

interface PulseDotProps {
  color: string;
}

function PulseDot({ color }: PulseDotProps) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: 0.5, animation: "ping 1.4s ease infinite" }} />
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "block" }} />
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PrepareDashboard() {
  const [selected, setSelected]     = useState<Emergency>(EMERGENCIES[0]);
  const [emergencies, setEmergencies] = useState<Emergency[]>(EMERGENCIES);

  const updateStatus = (id: string, newStatus: StatusKey): void => {
    setEmergencies(prev =>
      prev.map(e => (e.id === id ? { ...e, status: newStatus } : e))
    );
    setSelected(prev => (prev.id === id ? { ...prev, status: newStatus } : prev));
  };

  const sorted = [...emergencies].sort((a, b) => b.risk_score - a.risk_score);
  const incoming          = emergencies.filter(e => e.status === "incoming").length;
  const critical          = emergencies.filter(e => e.triage_level === "CRITICAL").length;
  const currentStatusIndex = STATUSES.indexOf(selected.status);
  const cfg               = TRIAGE_CONFIG[selected.triage_level];

  const vitAlerts = {
    hr:   selected.vitals.hr > 110 || selected.vitals.hr < 50,
    spo2: selected.vitals.spo2 < 93,
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0c111a", color: "#cbd5e1", fontFamily: "'DM Mono', 'Fira Code', monospace", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
        @keyframes ping { 75%,100% { transform:scale(2.2); opacity:0 } }
        @keyframes alertPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.25) }
          50%      { box-shadow: 0 0 0 6px rgba(239,68,68,0) }
        }
        ::-webkit-scrollbar { width: 3px }
        ::-webkit-scrollbar-track { background: transparent }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px }
        select option { background: #131c2b }
      `}</style>

      {/* ── SIDEBAR ── */}
      <div style={{ width: 265, borderRight: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", background: "#0e1520", flexShrink: 0 }}>

        {/* Brand */}
        <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div style={{ width: 34, height: 34, background: "linear-gradient(135deg, #1d4ed8, #3b82f6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 15, color: "#f1f5f9", letterSpacing: "0.1em" }}>PREPARE</div>
              <div style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: "0.1em" }}>EMERGENCY DASHBOARD</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {([ { label: "Incoming", value: incoming, alert: incoming > 0 },
                { label: "Critical", value: critical,  alert: critical  > 0 },
            ] as const).map(s => (
              <div key={s.label} style={{
                background: s.alert ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.03)",
                border:     `1px solid ${s.alert ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.05)"}`,
                borderRadius: 10, padding: "10px 12px",
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.alert ? "#ef4444" : "#1e293b", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.value}</div>
                <div style={{ fontSize: 9, color: s.alert ? "#64748b" : "#1e293b", letterSpacing: "0.08em", marginTop: 1 }}>{s.label.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Case list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
          <div style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: "0.1em", padding: "6px 8px 10px", textTransform: "uppercase" }}>
            Cases · by risk
          </div>
          {sorted.map(e => {
            const c = TRIAGE_CONFIG[e.triage_level];
            const isSelected           = selected.id === e.id;
            const isCriticalIncoming   = e.triage_level === "CRITICAL" && e.status === "incoming";
            return (
              <div
                key={e.id}
                onClick={() => setSelected(e)}
                style={{
                  padding: "11px 12px", borderRadius: 10, marginBottom: 3, cursor: "pointer",
                  background: isSelected ? "rgba(59,130,246,0.09)" : "transparent",
                  border:     `1px solid ${isSelected ? "rgba(59,130,246,0.22)" : "transparent"}`,
                  transition: "all 0.15s",
                  animation:  isCriticalIncoming ? "alertPulse 2s infinite" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 7 }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 500 }}>{e.patient.name}</div>
                    <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>{e.patient.age}y {e.patient.gender} · {e.id}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    {isCriticalIncoming && <PulseDot color="#ef4444" />}
                    <span style={{ fontSize: 9, color: c.color, fontWeight: 700, letterSpacing: "0.04em", background: c.bg, padding: "3px 7px", borderRadius: 5 }}>
                      {c.label}
                    </span>
                  </div>
                </div>
                <RiskBar score={e.risk_score} color={c.color} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: STATUS_CONFIG[e.status].color, opacity: 0.8 }}>{STATUS_CONFIG[e.status].label}</span>
                  {e.status === "incoming" && <span style={{ fontSize: 10, color: "#334155" }}>ETA {e.eta}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Doctor */}
        <div style={{ padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#3b82f6", fontWeight: 600 }}>A</div>
            <div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>Dr. A. Sharma</div>
              <div style={{ fontSize: 10, color: "#1e3a5f" }}>City General Hospital</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN PANEL ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>

        {/* Top bar */}
        <div style={{
          padding: "18px 28px", borderBottom: "1px solid rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "rgba(14,21,32,0.85)", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(12px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 3, height: 44, borderRadius: 2, background: cfg.color, flexShrink: 0, boxShadow: cfg.pulse ? `0 0 14px ${cfg.color}` : "none" }} />
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.02em" }}>
                {selected.patient.name}
              </div>
              <div style={{ fontSize: 11, color: "#334155", display: "flex", gap: 10, marginTop: 3 }}>
                <span>{selected.patient.age}y · {selected.patient.gender}</span>
                <span style={{ color: "#1e2d40" }}>·</span>
                <span>{selected.patient.insurance}</span>
                <span style={{ color: "#1e2d40" }}>·</span>
                <span>{selected.id}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ border: `1px solid ${cfg.color}`, color: cfg.color, fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 7, background: cfg.bg, letterSpacing: "0.06em" }}>
              {cfg.label}
            </div>
            <select
              value={selected.status}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                updateStatus(selected.id, e.target.value as StatusKey)
              }
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "#94a3b8", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontFamily: "inherit", cursor: "pointer", outline: "none" }}
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ padding: "22px 28px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Status timeline */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              {STATUSES.map((s, i) => {
                const done      = i <= currentStatusIndex;
                const isCurrent = i === currentStatusIndex;
                const sCfg      = STATUS_CONFIG[s];
                return (
                  <div key={s} style={{ display: "flex", alignItems: "center", flex: i < STATUSES.length - 1 ? 1 : undefined }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s",
                        background: isCurrent ? sCfg.color : done ? "rgba(255,255,255,0.1)" : "transparent",
                        border:     `2px solid ${done ? sCfg.color : "rgba(255,255,255,0.07)"}`,
                        boxShadow:  isCurrent ? `0 0 10px ${sCfg.color}55` : "none",
                      }}>
                        {done && !isCurrent && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        {isCurrent && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />}
                      </div>
                      <span style={{ fontSize: 9, color: done ? "#64748b" : "#1e3a5f", letterSpacing: "0.04em", whiteSpace: "nowrap", textTransform: "uppercase" }}>
                        {sCfg.label}
                      </span>
                    </div>
                    {i < STATUSES.length - 1 && (
                      <div style={{ flex: 1, height: 2, background: i < currentStatusIndex ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)", marginBottom: 22, transition: "background 0.3s" }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vitals */}
          <div>
            <div style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: "0.12em", marginBottom: 10, textTransform: "uppercase" }}>Vitals</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              <VitalBadge label="Heart Rate"     value={`${selected.vitals.hr} bpm`}     alert={vitAlerts.hr}   />
              <VitalBadge label="Blood Pressure" value={selected.vitals.bp}               alert={false}          />
              <VitalBadge label="SpO₂"           value={`${selected.vitals.spo2}%`}      alert={vitAlerts.spo2} />
              <VitalBadge label="Glucose"        value={`${selected.vitals.glucose} mg`}  alert={false}          />
            </div>
          </div>

          {/* AI + side panels */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 265px", gap: 14 }}>

            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1" }} />
                <span style={{ fontSize: 9, color: "#334155", letterSpacing: "0.12em", textTransform: "uppercase" }}>AI Summary</span>
                <span style={{ fontSize: 9, color: "#1e3a5f", marginLeft: "auto" }}>confidence {selected.confidence}%</span>
              </div>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.75, margin: 0 }}>{selected.ai_summary}</p>

              {selected.extracted_text !== null && (
                <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.14)", borderRadius: 8 }}>
                  <div style={{ fontSize: 9, color: "#6366f1", letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase" }}>OCR Extract</div>
                  <p style={{ fontSize: 12, color: "#64748b", margin: 0, fontStyle: "italic" }}>{selected.extracted_text}</p>
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: "0.1em", marginBottom: 8, textTransform: "uppercase" }}>Risk Score</div>
                <RiskBar score={selected.risk_score} color={cfg.color} />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: "0.12em", marginBottom: 10, textTransform: "uppercase" }}>Symptoms</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selected.symptoms.map(s => (
                    <span key={s} style={{ fontSize: 11, color: "#64748b", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", padding: "4px 10px", borderRadius: 20 }}>{s}</span>
                  ))}
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "16px 18px", flex: 1 }}>
                <div style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: "0.12em", marginBottom: 12, textTransform: "uppercase" }}>Prep Checklist</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {selected.checklist.map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                      <div style={{ width: 15, height: 15, borderRadius: 4, border: "1.5px solid rgba(59,130,246,0.3)", flexShrink: 0, marginTop: 1, background: "rgba(59,130,246,0.05)" }} />
                      <span style={{ fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}