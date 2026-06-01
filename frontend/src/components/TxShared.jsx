/**
 * 트랜잭션 폼 공유 컴포넌트 — tx-shared.jsx (Claude Design) React 버전
 * tx-design.css 클래스 사용
 */

// ── FormCard ─────────────────────────────────────────────────────────────────
export function FormCard({ step, title, en, src, children }) {
  return (
    <div className="fcard">
      <div className="fcard-head">
        <div className="lhs">
          {step && <span className="step">{step}</span>}
          <h3>
            {title}
            {en && (
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: 11, color: "var(--text-tertiary)", marginLeft: 8 }}>
                {en}
              </span>
            )}
          </h3>
        </div>
        {src === "chain" && (
          <span className="src-tag chain">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
            블록체인 저장
          </span>
        )}
        {src === "kv" && (
          <span className="src-tag kv">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M12 3L22 20H2L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
            서버(KV) · 진본증명 PDF 해시
          </span>
        )}
      </div>
      <div className="fcard-body">{children}</div>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
export function Field({ label, en, req, hint, error, children }) {
  return (
    <div className="field">
      <div className="field-row">
        <label className="field-label">
          {label}
          {req && <span className="req">*</span>}
          {en && <span className="en">{en}</span>}
        </label>
        <div>
          {children}
          {hint && !error && <div className="fld-hint">{hint}</div>}
          {error && (
            <div className="fld-error">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M12 7V13M12 16.5V16.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TxtInput ──────────────────────────────────────────────────────────────────
export function TxtInput({ value, onChange, placeholder, suffix, prefix, type, state, mono = true, disabled, onKeyDown, ...rest }) {
  return (
    <div className={"txt-input" + (state === "error" ? " is-error" : state === "ok" ? " is-ok" : "")}>
      {prefix && <span className="prefix">{prefix}</span>}
      <input
        type={type || "text"}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onKeyDown={onKeyDown}
        style={mono ? null : { fontFamily: "var(--font-sans)" }}
        onChange={(e) => onChange && onChange(e.target.value)}
        {...rest}
      />
      {suffix && <span className="suffix">{suffix}</span>}
    </div>
  );
}

// ── WeightGauge ───────────────────────────────────────────────────────────────
export function WeightGauge({ parent, child, threshold, label }) {
  const lossPct  = parent > 0 ? ((parent - child) / parent) * 100 : 0;
  const over     = child > parent;
  const lossOver = lossPct > threshold && !over;
  const fail     = over || lossOver;
  const fillPct  = parent > 0 ? Math.min(100, (child / parent) * 100) : 0;

  const verdict = over
    ? "무게 초과 — 자식이 부모보다 큼"
    : lossOver
    ? `손실 초과 (> ${threshold}%)`
    : `허용 범위 내 (≤ ${threshold}%)`;

  return (
    <div className={"weight-check " + (fail ? "fail" : "pass")}>
      <div className="wc-rows">
        <div className="wc-item">
          <span className="k">{label || "부모 무게"}</span>
          <span className="v">{parent.toLocaleString()} kg</span>
        </div>
        <div className="wc-item">
          <span className="k">자식 합계</span>
          <span className="v">{child.toLocaleString()} kg</span>
        </div>
        <div className="wc-item">
          <span className="k">손실률</span>
          <span className="v">{lossPct >= 0 ? lossPct.toFixed(1) : "—"}%</span>
        </div>
        <div className="wc-verdict">
          {fail
            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          {verdict}
        </div>
      </div>
      <div className="gauge-track">
        <div className="gauge-fill" style={{ width: fillPct + "%" }}></div>
        <div className="gauge-threshold" style={{ left: (100 - threshold) + "%" }}></div>
      </div>
      <div className="gauge-meta">
        <span>0</span>
        <span>임계 {100 - threshold}% (손실 {threshold}%)</span>
        <span>{parent.toLocaleString()} kg</span>
      </div>
    </div>
  );
}

// ── ActionFooter ──────────────────────────────────────────────────────────────
export function ActionFooter({ canSubmit, gateNote, submitLabel, onReset, onSubmit, loading }) {
  return (
    <div className="action-footer">
      <button className="btn-reset" type="button" onClick={onReset}>
        초기화
      </button>
      <div className="rhs">
        {!canSubmit && gateNote && (
          <span className="gate-note">{gateNote}</span>
        )}
        <button
          className={"btn-tx" + (canSubmit && !loading ? "" : " is-disabled")}
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <>
              <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "999px", animation: "spin 0.9s linear infinite" }} />
              트랜잭션 전송 중...
            </>
          ) : (
            <>
              <span className="btn-mm" />
              {submitLabel}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── IrreversibleWarning ───────────────────────────────────────────────────────
export function IrreversibleWarning({ children }) {
  return (
    <div className="warn-irreversible">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 3L22 20H2L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M12 10V14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="12" cy="17" r="0.8" fill="currentColor"/>
      </svg>
      <span>{children}</span>
    </div>
  );
}

// ── ConfirmModal ──────────────────────────────────────────────────────────────
export function ConfirmModal({ title, body, target, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div className="modal-scrim" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-body">
          <div className="m-ico">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 3L22 20H2L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
              <path d="M12 10V14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="12" cy="17" r="0.8" fill="currentColor"/>
            </svg>
          </div>
          <h3>{title}</h3>
          <p>{body}</p>
          {target && <div className="m-target">{target}</div>}
        </div>
        <div className="m-foot">
          <button
            style={{ display:"inline-flex",alignItems:"center",height:32,padding:"0 12px",borderRadius:6,background:"var(--bg-surface)",color:"var(--text-primary)",border:"1px solid var(--border-default)",fontSize:13,fontWeight:500,cursor:"pointer" }}
            onClick={onCancel}
          >
            취소
          </button>
          <button
            style={{ display:"inline-flex",alignItems:"center",height:32,padding:"0 12px",borderRadius:6,background:danger?"var(--tx-error)":"var(--primary)",color:"#fff",border:"none",fontSize:13,fontWeight:500,cursor:"pointer" }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TxPageHead ────────────────────────────────────────────────────────────────
export function TxPageHead({ title, en, arrow, children }) {
  return (
    <div className="tx-head">
      <div className="ttl">
        <h1>
          {title}
          {arrow && <span className="arrow">→ {arrow}</span>}
        </h1>
        {en && <span className="en">{en}</span>}
      </div>
      {children}
    </div>
  );
}

// ── PageConnectGuard ──────────────────────────────────────────────────────────
export function PageConnectGuard({ isLoading }) {
  if (isLoading) {
    return (
      <div style={{ display:"flex",alignItems:"center",justifyContent:"center",padding:"96px 0",gap:10 }}>
        <span style={{ display:"inline-block",width:18,height:18,border:"2px solid var(--border-default)",borderTop:"2px solid var(--text-secondary)",borderRadius:"999px",animation:"spin 0.9s linear infinite" }} />
        <span style={{ fontSize:13,color:"var(--text-tertiary)" }}>권한 확인 중...</span>
      </div>
    );
  }
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"96px 0",gap:8,textAlign:"center" }}>
      <div style={{ width:48,height:48,borderRadius:10,background:"var(--bg-muted)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-tertiary)",marginBottom:4 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="5" y="11" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
          <path d="M8 11V8C8 5.8 9.8 4 12 4C14.2 4 16 5.8 16 8V11" stroke="currentColor" strokeWidth="1.6"/>
        </svg>
      </div>
      <p style={{ fontSize:14,fontWeight:600,color:"var(--text-primary)",margin:0 }}>MetaMask 연결이 필요합니다</p>
      <p style={{ fontSize:13,color:"var(--text-secondary)",margin:0 }}>지갑을 연결하면 이용할 수 있습니다</p>
    </div>
  );
}
