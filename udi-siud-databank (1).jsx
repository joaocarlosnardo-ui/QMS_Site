import { useState, useMemo, useRef } from "react";

/* ─── CONSTANTS ─────────────────────────────────────────── */
const ISSUERS = ["GS1", "HIBCC", "ICCBBA"];
const COUNTRIES = ["Brasil","United States","Germany","France","China","Japan","Italy","United Kingdom","Canada","Australia","India","South Korea","Netherlands","Switzerland","Sweden","Spain","Mexico","Argentina","Portugal","Other"];
const STERILIZATION_METHODS = ["EO - Ethylene Oxide","Steam Autoclaving","Dry Heat","Radiation (Gamma)","Radiation (E-Beam)","Plasma (H2O2)","Chemical","Formaldehyde","No Sterilization Required"];
const MRI_OPTIONS = ["Condicional","Seguro","Não seguro","Não aplicável"];
const DEVICE_CATEGORIES = ["Equipamento","Equipamento implantável","IVD","Software (SaMD)","Material","Material implantável"];
const STATUSES = ["Ativo","Inativo","Recall","Pendente","Descontinuado"];

const statusStyle = {
  "Ativo":        { bg:"#0a1f10", border:"#1a5c30", text:"#2ecc71" },
  "Inativo":      { bg:"#12121e", border:"#2a2a50", text:"#7777aa" },
  "Recall":       { bg:"#1f0a0a", border:"#5c1a1a", text:"#e74c3c" },
  "Pendente":     { bg:"#1a1400", border:"#4a3800", text:"#f0c030" },
  "Descontinuado":{ bg:"#111118", border:"#222230", text:"#555580" },
};

const emptyForm = {
  // Fixed UDI identifier
  udi_fixed: "",
  // Section 1 – Premarket
  reg_number: "", trade_name: "", refurbished: "Não",
  // Section 2 – UDI-DI info
  udi_di: "", issuing_agency: "GS1", brand_name: "", version_model: "",
  catalog_number: "", manufacturer_name: "", manufacturer_address: "",
  manufacturer_country: "Brasil", qty_primary_pack: "",
  // Section 3 – Device characteristics
  device_category: "Equipamento", single_use: "Não", reusable: "Não",
  no_reuse_limit: false, max_reuses: "", sterile_labeled: "Não",
  requires_sterilization: "Não", sterilization_method: "", lay_user: "Não",
  contains_ai: "Não", combination_product: "Não", biological_material: "Não",
  storage_conditions: "", clinical_sizes: "",
  // Section 4 – Warnings
  contains_latex: "Não", mri_safety: "Não aplicável", other_warnings: "",
  // Section 5 – Technical terms
  gmdn_code: "", gmdn_name: "", gmdn_definition: "",
  // Section 6 – Package DI
  no_packaging_levels: false, package_udi_di: "", package_issuing_agency: "GS1",
  package_level: "", qty_per_pack: "",
  has_uou: "Não", uou_di: "",
  // Section 7 – PI types
  has_lot: "Sim", has_serial: "Sim", has_expiry: "Sim",
  has_manufacture_date: "Sim", has_refurbish_date: "Não",
  has_samd_release: "Não", has_samd_version: "Não",
  // PI actual values
  lot_number: "", serial_number: "", expiry_date: "",
  manufacture_date: "", refurbish_date: "", samd_version: "",
  // Section 8 – Supplementary
  url_info: "", customer_service: "", distribution_end_date: "", publication_date: "",
  // Status
  status: "Ativo",
};

/* ─── HELPERS ───────────────────────────────────────────── */
function Badge({ s }) {
  const c = statusStyle[s] || statusStyle["Inativo"];
  return <span style={{ background:c.bg, border:`1px solid ${c.border}`, color:c.text, padding:"2px 10px", borderRadius:4, fontSize:10, fontWeight:700, letterSpacing:1.2, textTransform:"uppercase", fontFamily:"monospace" }}>{s}</span>;
}
const inp = { width:"100%", background:"#0e1320", border:"1px solid #1e2840", color:"#c8d4f0", borderRadius:6, padding:"8px 11px", fontSize:12, fontFamily:"'IBM Plex Mono',monospace", boxSizing:"border-box", outline:"none" };
const sel = { ...inp };
const ta  = { ...inp, resize:"vertical", minHeight:64 };

function Field({ label, req, children, span }) {
  return (
    <div style={{ gridColumn: span ? "1/-1" : undefined, marginBottom:12 }}>
      <label style={{ display:"block", color:"#4a6080", fontSize:10, fontFamily:"monospace", letterSpacing:1.4, textTransform:"uppercase", marginBottom:4 }}>
        {label}{req && <span style={{ color:"#e74c3c", marginLeft:2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function SectionHeader({ icon, title, sub }) {
  return (
    <div style={{ gridColumn:"1/-1", display:"flex", alignItems:"center", gap:10, padding:"14px 0 8px", borderBottom:"1px solid #141c2c", marginBottom:4 }}>
      <span style={{ fontSize:16 }}>{icon}</span>
      <div>
        <div style={{ color:"#c0d4f8", fontSize:13, fontWeight:600, fontFamily:"'Syne',sans-serif" }}>{title}</div>
        {sub && <div style={{ color:"#3a5070", fontSize:10, marginTop:1 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ─── ZPL LABEL GENERATOR ──────────────────────────────── */
function buildZPL(item) {
  const lotStr  = item.lot_number    ? `LOT: ${item.lot_number}`   : "";
  const snStr   = item.serial_number ? `SN:  ${item.serial_number}` : "";
  const expStr  = item.expiry_date   ? `EXP: ${item.expiry_date}`  : "";
  const mfgStr  = item.manufacture_date ? `MFG: ${item.manufacture_date}` : "";
  const udiLine = item.udi_fixed || item.udi_di;
  return `^XA
^CI28
^PW800
^LL400
^FO20,20^GB760,360,3^FS
^FO30,28^A0N,18,18^FD${(item.brand_name||item.trade_name||"").substring(0,50)}^FS
^FO30,52^A0N,13,13^FD${(item.manufacturer_name||"").substring(0,60)}^FS
^FO30,70^GB740,1,1^FS
^FO30,80^A0N,12,12^FDUDI-DI: ${item.udi_di||""}^FS
^FO30,96^A0N,12,12^FDUDI (Fixed): ${item.udi_fixed||""}^FS
^FO30,116^GB740,1,1^FS
^FO30,126^A0N,12,12^FD${lotStr}^FS
^FO30,142^A0N,12,12^FD${snStr}^FS
^FO400,126^A0N,12,12^FD${expStr}^FS
^FO400,142^A0N,12,12^FD${mfgStr}^FS
^FO30,164^GB740,1,1^FS
^FO30,172^A0N,11,11^FDGMDN: ${item.gmdn_code||"-"}  Cat.: ${item.device_category||"-"}^FS
^FO30,188^A0N,11,11^FDLote/Série/Validade: ${item.has_lot}/${item.has_serial}/${item.has_expiry}  Estéril: ${item.sterile_labeled}  Uso único: ${item.single_use}^FS
^FO30,210^BY2,3,60^BCN,60,Y,N,N
^FD>;${udiLine}^FS
^FO500,210^BQN,2,5
^FDQA,${udiLine}^FS
^XZ`;
}

/* ─── MAIN APP ──────────────────────────────────────────── */
export default function App() {
  const [records, setRecords]   = useState([]);
  const [view, setView]         = useState("list"); // list | form | detail
  const [editId, setEditId]     = useState(null);
  const [viewRec, setViewRec]   = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [search, setSearch]     = useState("");
  const [filterStatus, setFilt] = useState("Todos");
  const [toast, setToast]       = useState(null);
  const [zebraIP, setZebraIP]   = useState("192.168.1.100");
  const [zebraPort, setZebraPort] = useState("9100");
  const [showZebraModal, setShowZebraModal] = useState(false);
  const [labelRec, setLabelRec] = useState(null);
  const [tab, setTab]           = useState("registro"); // registro | embalagem | pi | suplementar
  const printRef = useRef();

  function showToast(msg, type="ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target ? e.target.value : e })); }
  function setCheck(k) { return e => setForm(f => ({ ...f, [k]: e.target.checked })); }

  function openNew() {
    setForm(emptyForm);
    setEditId(null);
    setTab("registro");
    setView("form");
  }

  function openEdit(rec) {
    setForm({ ...emptyForm, ...rec });
    setEditId(rec.id);
    setTab("registro");
    setView("form");
  }

  function openDetail(rec) {
    setViewRec(rec);
    setView("detail");
  }

  function saveForm() {
    if (!form.udi_fixed) return showToast("UDI (número fixo) é obrigatório.", "err");
    if (!form.udi_di)    return showToast("UDI-DI é obrigatório.", "err");
    if (!form.brand_name && !form.trade_name) return showToast("Nome comercial é obrigatório.", "err");
    const now = new Date().toISOString().slice(0,10);
    if (editId) {
      setRecords(r => r.map(x => x.id === editId
        ? { ...x, ...form, updated: now, history:[...(x.history||[]), { date:now, event:"Atualizado", user:"Usuário" }] }
        : x));
      showToast("Registro atualizado com sucesso.");
    } else {
      const id = Date.now();
      setRecords(r => [...r, { ...form, id, created:now, history:[{ date:now, event:"Registrado", user:"Usuário" }] }]);
      showToast("Novo UDI registrado com sucesso.");
    }
    setView("list");
  }

  function deleteRec(id) {
    if (!confirm("Excluir este registro UDI?")) return;
    setRecords(r => r.filter(x => x.id !== id));
    showToast("Registro excluído.");
    if (view === "detail") setView("list");
  }

  /* EXTRACT – copies all fields as JSON */
  function extractData(rec) {
    const out = { ...rec };
    delete out.history;
    const blob = new Blob([JSON.stringify(out, null, 2)], { type:"application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `UDI_${rec.udi_fixed||rec.id}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast("Dados exportados como JSON.");
  }

  /* PRINT LABEL – ZPL via Zebra Browser Print or raw TCP simulation */
  function printLabel(rec) {
    setLabelRec(rec);
    setShowZebraModal(true);
  }

  function sendToZebra() {
    const zpl = buildZPL(labelRec);
    // Try Zebra Browser Print API (installed on client machine)
    if (window.BrowserPrint) {
      window.BrowserPrint.getDefaultDevice("printer", device => {
        device.send(zpl,
          () => showToast("Etiqueta enviada para a impressora Zebra!"),
          err => showToast("Erro ao enviar: " + err, "err")
        );
      }, err => showToast("Zebra Browser Print não encontrado: " + err, "err"));
    } else {
      // Fallback: show ZPL + instructions
      showToast("Zebra Browser Print não detectado. Veja o ZPL abaixo.", "warn");
    }
    setShowZebraModal(false);
  }

  function copyZPL(rec) {
    const zpl = buildZPL(rec);
    navigator.clipboard.writeText(zpl);
    showToast("ZPL copiado para a área de transferência.");
    setShowZebraModal(false);
  }

  function printPreview(rec) {
    const zpl = buildZPL(rec);
    const win = window.open("","_blank","width=700,height=520");
    win.document.write(`<!DOCTYPE html><html><head><title>ZPL Label Preview</title>
<style>body{margin:0;background:#111;color:#ccc;font-family:monospace;padding:20px}
pre{background:#1a1a2a;border:1px solid #333;padding:20px;border-radius:8px;font-size:12px;overflow:auto}
h2{color:#4af;margin-bottom:8px}
.info{color:#888;font-size:11px;margin-bottom:16px}
</style></head><body>
<h2>ZPL — ${rec.brand_name||rec.trade_name}</h2>
<div class="info">UDI: ${rec.udi_fixed||rec.udi_di} · Para enviar: use Zebra Browser Print ou copie o ZPL abaixo.</div>
<pre>${zpl.replace(/</g,"&lt;")}</pre>
<p style="color:#888;font-size:11px">Você também pode testar em: <a style="color:#4af" href="https://labelary.com/viewer.html" target="_blank">labelary.com/viewer.html</a></p>
</body></html>`);
    win.document.close();
  }

  /* FILTERED LIST */
  const filtered = useMemo(() => {
    let d = records;
    if (search) {
      const q = search.toLowerCase();
      d = d.filter(r =>
        (r.udi_fixed||"").toLowerCase().includes(q) ||
        (r.udi_di||"").toLowerCase().includes(q) ||
        (r.brand_name||"").toLowerCase().includes(q) ||
        (r.trade_name||"").toLowerCase().includes(q) ||
        (r.manufacturer_name||"").toLowerCase().includes(q) ||
        (r.lot_number||"").toLowerCase().includes(q)
      );
    }
    if (filterStatus !== "Todos") d = d.filter(r => r.status === filterStatus);
    return d;
  }, [records, search, filterStatus]);

  const stats = useMemo(() => ({
    total: records.length,
    ativos: records.filter(r => r.status === "Ativo").length,
    recalls: records.filter(r => r.status === "Recall").length,
    expiring: records.filter(r => {
      if (!r.expiry_date) return false;
      const d = (new Date(r.expiry_date) - new Date()) / 86400000;
      return d >= 0 && d <= 90;
    }).length,
  }), [records]);

  /* ── STYLES ── */
  const S = {
    app:  { minHeight:"100vh", background:"#070b14", fontFamily:"'IBM Plex Mono',monospace", color:"#c0cce8" },
    hdr:  { borderBottom:"1px solid #111c2e", background:"linear-gradient(90deg,#070b14,#0c1220)", padding:"16px 28px", display:"flex", alignItems:"center", justifyContent:"space-between" },
    body: { padding:"24px 28px" },
    card: { background:"#0b1020", border:"1px solid #141c2e", borderRadius:10, overflow:"hidden" },
    btn:  (c="#2a4a8a",t="#8ac0ff") => ({ background:`linear-gradient(135deg,${c},${c}cc)`, border:`1px solid ${c}88`, color:t, borderRadius:6, padding:"8px 18px", cursor:"pointer", fontFamily:"monospace", fontSize:11, fontWeight:600, letterSpacing:0.5, whiteSpace:"nowrap" }),
    btnSm:(c,t) => ({ ...S.btn(c,t), padding:"5px 12px", fontSize:10 }),
    ghost:{ background:"none", border:"1px solid #1e2840", color:"#5a7090", borderRadius:6, padding:"8px 16px", cursor:"pointer", fontFamily:"monospace", fontSize:11 },
    grid2:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 20px" },
    grid3:{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"0 16px" },
  };

  /* ── FORM TABS ── */
  const FORM_TABS = [
    { id:"registro",    label:"Registro" },
    { id:"dispositivo", label:"Dispositivo" },
    { id:"embalagem",   label:"Embalagem & PI" },
    { id:"suplementar", label:"Suplementar" },
  ];

  /* ═══════════════════════════════════════════════════════ */
  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Syne:wght@600;700;800&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#080c16}
        ::-webkit-scrollbar-thumb{background:#1e2c44;border-radius:3px}
        input::placeholder,textarea::placeholder{color:#2a3850}
        select option{background:#0b1020}
        .trh:hover{background:#0d1628!important}
        .tab-btn{background:none;border:none;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:1px;padding:8px 16px;border-radius:6px;transition:all .2s}
        .tab-btn.active{background:#111e38;color:#6ab0ff;border-bottom:2px solid #3a80ff}
        .tab-btn:not(.active){color:#3a5070}
        .tab-btn:not(.active):hover{color:#6a90b0}
      `}</style>

      {/* HEADER */}
      <div style={S.hdr}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:38, height:38, background:"linear-gradient(135deg,#0d3a6a,#0a5a50)", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>⚕</div>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:"#e0ecff", fontFamily:"'Syne',sans-serif", letterSpacing:-0.5 }}>UDI DataBank <span style={{ color:"#2a5a9a", fontSize:12 }}>SIUD</span></div>
            <div style={{ fontSize:9, color:"#2a4060", letterSpacing:2 }}>SISTEMA DE IDENTIFICAÇÃO ÚNICA DE DISPOSITIVOS — ANVISA</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {view !== "list" && <button style={S.ghost} onClick={() => setView("list")}>← Voltar</button>}
          {view === "list" && <button style={S.btn()} onClick={openNew}>+ Novo UDI</button>}
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{ position:"fixed", top:20, right:24, zIndex:9999, background: toast.type==="err"?"#2a0808": toast.type==="warn"?"#1a1400":"#0a1f10", border:`1px solid ${toast.type==="err"?"#5c1a1a":toast.type==="warn"?"#4a3800":"#1a5c30"}`, color: toast.type==="err"?"#e74c3c":toast.type==="warn"?"#f0c030":"#2ecc71", padding:"10px 20px", borderRadius:8, fontFamily:"monospace", fontSize:12, boxShadow:"0 4px 20px #00000080" }}>
          {toast.msg}
        </div>
      )}

      <div style={S.body}>

        {/* ══════════ LIST VIEW ══════════ */}
        {view === "list" && (<>

          {/* Stats */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:22 }}>
            {[
              { l:"Total Dispositivos", v:stats.total,    c:"#4a9eff", i:"⬡" },
              { l:"Ativos",             v:stats.ativos,   c:"#2ecc71", i:"●" },
              { l:"Recalls",            v:stats.recalls,  c:"#e74c3c", i:"▲" },
              { l:"Vencendo (90d)",     v:stats.expiring, c:"#f0c030", i:"◈" },
            ].map(s => (
              <div key={s.l} style={{ ...S.card, padding:"18px 20px" }}>
                <div style={{ fontSize:20, color:s.c, opacity:.8 }}>{s.i}</div>
                <div style={{ fontSize:26, fontWeight:700, color:s.c, fontFamily:"'Syne',sans-serif", lineHeight:1.1 }}>{s.v}</div>
                <div style={{ fontSize:9, color:"#3a5070", marginTop:3, letterSpacing:1.5, textTransform:"uppercase" }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap", alignItems:"center" }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar UDI, DI, lote, nome..." style={{ ...inp, width:280, flex:"0 0 280px" }} />
            <select value={filterStatus} onChange={e=>setFilt(e.target.value)} style={{ ...sel, width:140, flex:"0 0 140px" }}>
              <option>Todos</option>
              {STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
            <div style={{ flex:1 }} />
            <span style={{ fontSize:10, color:"#2a3850", fontFamily:"monospace" }}>{filtered.length} registro(s)</span>
          </div>

          {/* Table */}
          <div style={{ ...S.card }}>
            {records.length === 0 ? (
              <div style={{ padding:"60px 0", textAlign:"center", color:"#1e2c44" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>⊕</div>
                <div style={{ fontSize:13 }}>Nenhum dispositivo registrado.</div>
                <div style={{ fontSize:11, marginTop:6, color:"#162030" }}>Clique em "+ Novo UDI" para iniciar.</div>
              </div>
            ) : (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead>
                    <tr style={{ background:"#080c18", borderBottom:"1px solid #111c2c" }}>
                      {["UDI (Fixo)","UDI-DI","Nome Comercial","Fabricante","Lote / Série","Validade","Status","Ações"].map(h=>(
                        <th key={h} style={{ padding:"11px 14px", textAlign:"left", color:"#3a5070", fontWeight:700, letterSpacing:1, fontSize:10, textTransform:"uppercase", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => {
                      const expW = r.expiry_date && ((new Date(r.expiry_date)-new Date())/86400000) <= 90 && ((new Date(r.expiry_date)-new Date())/86400000) >= 0;
                      return (
                        <tr key={r.id} className="trh" style={{ borderBottom:"1px solid #0c1420" }}>
                          <td style={{ padding:"12px 14px" }}>
                            <code style={{ color:"#60a0ff", background:"#0a1428", padding:"2px 7px", borderRadius:4, fontSize:11 }}>{r.udi_fixed||"—"}</code>
                          </td>
                          <td style={{ padding:"12px 14px" }}>
                            <code style={{ color:"#3a70b0", fontSize:11 }}>{r.udi_di||"—"}</code>
                            <div style={{ fontSize:9, color:"#2a4060", marginTop:2 }}>{r.issuing_agency}</div>
                          </td>
                          <td style={{ padding:"12px 14px", color:"#c0d4f0", fontWeight:500, maxWidth:160 }}>
                            <div style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.brand_name||r.trade_name||"—"}</div>
                            <div style={{ fontSize:9, color:"#3a5070" }}>{r.device_category}</div>
                          </td>
                          <td style={{ padding:"12px 14px", color:"#5a7090", maxWidth:140 }}>
                            <div style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.manufacturer_name||"—"}</div>
                            <div style={{ fontSize:9, color:"#2a4060" }}>{r.manufacturer_country}</div>
                          </td>
                          <td style={{ padding:"12px 14px" }}>
                            {r.lot_number    && <div style={{ color:"#7a9ab8", fontSize:10 }}>LOT: {r.lot_number}</div>}
                            {r.serial_number && <div style={{ color:"#7a9ab8", fontSize:10 }}>SN: {r.serial_number}</div>}
                          </td>
                          <td style={{ padding:"12px 14px" }}>
                            <span style={{ color: expW?"#f0c030":"#4a6080", fontSize:11 }}>{r.expiry_date||"—"}{expW?" ⚠":""}</span>
                          </td>
                          <td style={{ padding:"12px 14px" }}><Badge s={r.status} /></td>
                          <td style={{ padding:"12px 14px" }}>
                            <div style={{ display:"flex", gap:5, flexWrap:"nowrap" }}>
                              <button style={S.btnSm("#0a2040","#4a9eff")} onClick={()=>openDetail(r)}>Ver</button>
                              <button style={S.btnSm("#0a2040","#80c0ff")} onClick={()=>openEdit(r)}>Editar</button>
                              <button style={S.btnSm("#1a0a30","#b080ff")} onClick={()=>extractData(r)}>↓ JSON</button>
                              <button style={S.btnSm("#001a30","#40b0ff")} onClick={()=>printLabel(r)}>🖨 Zebra</button>
                              <button style={S.btnSm("#1a0808","#e74c3c")} onClick={()=>deleteRec(r.id)}>✕</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>)}

        {/* ══════════ FORM VIEW ══════════ */}
        {view === "form" && (
          <div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:18, fontWeight:800, color:"#d0e4ff", fontFamily:"'Syne',sans-serif" }}>{editId ? "Editar Registro UDI" : "Registrar Novo Dispositivo UDI"}</div>
              <div style={{ fontSize:10, color:"#2a4060", marginTop:3 }}>Conforme tabela de campos SIUD — ANVISA</div>
            </div>

            {/* ─ Fixed UDI Banner ─ */}
            <div style={{ background:"linear-gradient(135deg,#0a1a3a,#0a2a40)", border:"2px solid #1a4a8a", borderRadius:10, padding:"16px 22px", marginBottom:20, display:"flex", alignItems:"center", gap:16 }}>
              <div style={{ fontSize:28, flexShrink:0 }}>🔒</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:"#4a70a0", letterSpacing:1.5, textTransform:"uppercase", marginBottom:4 }}>Número UDI Fixo — Identificador Permanente (nunca muda)</div>
                <input
                  value={form.udi_fixed}
                  onChange={set("udi_fixed")}
                  placeholder="Ex.: (01)07891234567890"
                  style={{ ...inp, fontSize:16, color:"#80c0ff", fontWeight:600, letterSpacing:1, background:"#05101e", border:"1px solid #1a4a8a" }}
                />
                <div style={{ fontSize:10, color:"#2a4060", marginTop:5 }}>Este campo é o UDI-DI + AI(01) conforme GS1/HIBCC/ICCBBA. Uma vez atribuído, não pode ser alterado.</div>
              </div>
            </div>

            {/* TABS */}
            <div style={{ display:"flex", gap:4, marginBottom:20, borderBottom:"1px solid #111c2c", paddingBottom:2 }}>
              {FORM_TABS.map(t=>(
                <button key={t.id} className={`tab-btn ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>{t.label}</button>
              ))}
            </div>

            <div style={{ ...S.card, padding:24 }}>

              {/* TAB: REGISTRO */}
              {tab==="registro" && (
                <div style={S.grid2}>
                  <SectionHeader icon="📋" title="Dados de Registro / Notificação" sub="Campos 1–16 SIUD" />
                  <Field label="Nº Registro / Notificação (campo 1)" req><input style={inp} value={form.reg_number} onChange={set("reg_number")} maxLength={11} /></Field>
                  <Field label="Produto Recondicionado? (campo 3)" req>
                    <select style={sel} value={form.refurbished} onChange={set("refurbished")}><option>Sim</option><option>Não</option></select>
                  </Field>
                  <Field label="Nome Comercial do Produto (campo 2/13)" span><input style={inp} value={form.trade_name} onChange={set("trade_name")} maxLength={80} /></Field>

                  <SectionHeader icon="🔑" title="UDI-DI do Dispositivo" sub="Campos 22–30 SIUD — Dados de Identificação" />
                  <Field label="UDI-DI do Dispositivo (campo 22)" req><input style={inp} value={form.udi_di} onChange={set("udi_di")} maxLength={25} placeholder="Código UDI-DI alfanumérico" /></Field>
                  <Field label="Entidade Emissora (campo 23)" req>
                    <select style={sel} value={form.issuing_agency} onChange={set("issuing_agency")}>{ISSUERS.map(i=><option key={i}>{i}</option>)}</select>
                  </Field>
                  <Field label="Nome Comercial pelo fabricante (campo 24)" req><input style={inp} value={form.brand_name} onChange={set("brand_name")} maxLength={80} /></Field>
                  <Field label="Versão / Modelo (campo 25)" req><input style={inp} value={form.version_model} onChange={set("version_model")} maxLength={80} /></Field>
                  <Field label="Nº / Código de Catálogo (campo 26)"><input style={inp} value={form.catalog_number} onChange={set("catalog_number")} maxLength={80} /></Field>
                  <Field label="Qtd por Embalagem Primária (campo 30)" req><input style={inp} type="number" value={form.qty_primary_pack} onChange={set("qty_primary_pack")} min={1} /></Field>
                  <Field label="Razão Social Fabricante Legal (campo 27)" req span><input style={inp} value={form.manufacturer_name} onChange={set("manufacturer_name")} maxLength={200} /></Field>
                  <Field label="Endereço Fabricante Legal (campo 28)" req><input style={inp} value={form.manufacturer_address} onChange={set("manufacturer_address")} maxLength={80} /></Field>
                  <Field label="País do Fabricante Legal (campo 29)" req>
                    <select style={sel} value={form.manufacturer_country} onChange={set("manufacturer_country")}>{COUNTRIES.map(c=><option key={c}>{c}</option>)}</select>
                  </Field>
                  <Field label="Status Regulatório" req>
                    <select style={sel} value={form.status} onChange={set("status")}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>
                  </Field>
                  <Field label="Data de Publicação (campo 68)" req><input style={inp} type="date" value={form.publication_date} onChange={set("publication_date")} /></Field>
                </div>
              )}

              {/* TAB: DISPOSITIVO */}
              {tab==="dispositivo" && (
                <div style={S.grid2}>
                  <SectionHeader icon="🔬" title="Características do Dispositivo" sub="Campos 31–47 SIUD" />
                  <Field label="Categoria (campo 31)" req>
                    <select style={sel} value={form.device_category} onChange={set("device_category")}>{DEVICE_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
                  </Field>
                  <Field label="Uso Único? (campo 32)" req>
                    <select style={sel} value={form.single_use} onChange={set("single_use")}><option>Sim</option><option>Não</option></select>
                  </Field>
                  <Field label="Reutilizável? (campo 33)" req>
                    <select style={sel} value={form.reusable} onChange={set("reusable")}><option>Sim</option><option>Não</option></select>
                  </Field>
                  <Field label="Nº Máx. Reutilizações (campo 35)">
                    <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                      <input style={{ ...inp, flex:1 }} type="number" value={form.max_reuses} onChange={set("max_reuses")} disabled={form.no_reuse_limit} />
                      <label style={{ display:"flex", alignItems:"center", gap:6, color:"#4a6080", fontSize:11, whiteSpace:"nowrap" }}>
                        <input type="checkbox" checked={form.no_reuse_limit} onChange={setCheck("no_reuse_limit")} /> Sem limite
                      </label>
                    </div>
                  </Field>
                  <Field label="Rotulado como Estéril? (campo 36)" req>
                    <select style={sel} value={form.sterile_labeled} onChange={set("sterile_labeled")}><option>Sim</option><option>Não</option></select>
                  </Field>
                  <Field label="Requer esterilização antes do uso? (campo 37)">
                    <select style={sel} value={form.requires_sterilization} onChange={set("requires_sterilization")}><option>Sim</option><option>Não</option></select>
                  </Field>
                  <Field label="Método de Esterilização (campo 38)" span>
                    <select style={sel} value={form.sterilization_method} onChange={set("sterilization_method")}>
                      <option value="">Selecione...</option>
                      {STERILIZATION_METHODS.map(m=><option key={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label="Uso por Leigos? (campo 39)">
                    <select style={sel} value={form.lay_user} onChange={set("lay_user")}><option>Sim</option><option>Não</option></select>
                  </Field>
                  <Field label="Incorpora IA? (campo 40)">
                    <select style={sel} value={form.contains_ai} onChange={set("contains_ai")}><option>Sim</option><option>Não</option></select>
                  </Field>
                  <Field label="Produto combinado? (campo 41)" req>
                    <select style={sel} value={form.combination_product} onChange={set("combination_product")}><option>Sim</option><option>Não</option></select>
                  </Field>
                  <Field label="Tecidos/células biológicas? (campo 42)" req>
                    <select style={sel} value={form.biological_material} onChange={set("biological_material")}><option>Sim</option><option>Não</option></select>
                  </Field>
                  <Field label="Condições de Armazenamento (campo 43)" span><textarea style={ta} value={form.storage_conditions} onChange={set("storage_conditions")} maxLength={5000} /></Field>
                  <Field label="Tamanhos Clinicamente Relevantes (campo 44)" span><textarea style={ta} value={form.clinical_sizes} onChange={set("clinical_sizes")} maxLength={5000} /></Field>

                  <SectionHeader icon="⚠️" title="Advertências e Contraindicações" sub="Campos 45–47 SIUD" />
                  <Field label="Contém Látex Natural? (campo 45)" req>
                    <select style={sel} value={form.contains_latex} onChange={set("contains_latex")}><option>Sim</option><option>Não</option></select>
                  </Field>
                  <Field label="Segurança em Ressonância Magnética (campo 46)" req>
                    <select style={sel} value={form.mri_safety} onChange={set("mri_safety")}>{MRI_OPTIONS.map(o=><option key={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="Outras advertências / contraindicações (campo 47)" span><textarea style={ta} value={form.other_warnings} onChange={set("other_warnings")} maxLength={5000} /></Field>

                  <SectionHeader icon="🏷️" title="Termos Técnicos GMDN" sub="Campos 48–50 SIUD" />
                  <Field label="Código GMDN (campo 48)" req><input style={inp} value={form.gmdn_code} onChange={set("gmdn_code")} maxLength={10} /></Field>
                  <Field label="Termo GMDN (campo 49)"><input style={inp} value={form.gmdn_name} onChange={set("gmdn_name")} /></Field>
                  <Field label="Definição GMDN (campo 50)" span><textarea style={ta} value={form.gmdn_definition} onChange={set("gmdn_definition")} /></Field>
                </div>
              )}

              {/* TAB: EMBALAGEM & PI */}
              {tab==="embalagem" && (
                <div style={S.grid2}>
                  <SectionHeader icon="📦" title="DI das Embalagens" sub="Campos 51–57 SIUD" />
                  <Field label="" span>
                    <label style={{ display:"flex", alignItems:"center", gap:8, color:"#4a6080", fontSize:12 }}>
                      <input type="checkbox" checked={form.no_packaging_levels} onChange={setCheck("no_packaging_levels")} />
                      Não há níveis de embalagens além da embalagem primária (campo 51)
                    </label>
                  </Field>
                  {!form.no_packaging_levels && (<>
                    <Field label="UDI-DI de Embalagem (campo 52)" req><input style={inp} value={form.package_udi_di} onChange={set("package_udi_di")} maxLength={25} /></Field>
                    <Field label="Entidade Emissora Embalagem (campo 53)" req>
                      <select style={sel} value={form.package_issuing_agency} onChange={set("package_issuing_agency")}>{ISSUERS.map(i=><option key={i}>{i}</option>)}</select>
                    </Field>
                    <Field label="Nível de Embalagem (campo 54)" req><input style={inp} type="number" value={form.package_level} onChange={set("package_level")} min={1} /></Field>
                    <Field label="Quantidade por Embalagem (campo 55)" req><input style={inp} type="number" value={form.qty_per_pack} onChange={set("qty_per_pack")} min={1} /></Field>
                  </>)}
                  <Field label="Possui Identificador UOU? (campo 56)" req>
                    <select style={sel} value={form.has_uou} onChange={set("has_uou")}><option>Sim</option><option>Não</option></select>
                  </Field>
                  {form.has_uou==="Sim" && <Field label="Nº UOU - Unit of Use (campo 57)"><input style={inp} value={form.uou_di} onChange={set("uou_di")} maxLength={23} /></Field>}

                  <SectionHeader icon="🔢" title="Tipos de Identificadores de Produção (PI)" sub="Campos 58–64 SIUD" />
                  {[
                    { k:"has_lot",           l:"Número de Lote (campo 58)",               vk:"lot_number",      ph:"LOT-XXXXXX" },
                    { k:"has_serial",        l:"Número de Série (campo 59)",              vk:"serial_number",   ph:"SN-XXXXXX" },
                    { k:"has_expiry",        l:"Data de Validade (campo 60)",             vk:"expiry_date",     type:"date" },
                    { k:"has_manufacture_date", l:"Data de Manufatura (campo 61)",        vk:"manufacture_date",type:"date" },
                    { k:"has_refurbish_date",l:"Data Recondicionamento (campo 62)",       vk:"refurbish_date",  type:"date" },
                    { k:"has_samd_release",  l:"Data de Liberação SaMD (campo 63)",       vk:null },
                    { k:"has_samd_version",  l:"Versão SaMD (campo 64)",                 vk:"samd_version",    ph:"v1.0.0" },
                  ].map(f=>(
                    <div key={f.k} style={{ gridColumn:"1/-1", display:"grid", gridTemplateColumns:"auto 1fr", gap:12, alignItems:"center", padding:"10px 0", borderBottom:"1px solid #0c1420" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:280 }}>
                        <select style={{ ...sel, width:70 }} value={form[f.k]} onChange={set(f.k)}><option>Sim</option><option>Não</option></select>
                        <span style={{ color:"#5a7090", fontSize:11 }}>{f.l}</span>
                      </div>
                      {form[f.k]==="Sim" && f.vk && (
                        <input style={inp} type={f.type||"text"} value={form[f.vk]||""} onChange={set(f.vk)} placeholder={f.ph||""} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* TAB: SUPLEMENTAR */}
              {tab==="suplementar" && (
                <div style={S.grid2}>
                  <SectionHeader icon="ℹ️" title="Informações Suplementares" sub="Campos 65–68 SIUD" />
                  <Field label="URL Instruções de Uso Eletrônicas (campo 65)" span><input style={inp} value={form.url_info} onChange={set("url_info")} maxLength={5000} placeholder="https://..." /></Field>
                  <Field label="Serviço de Atendimento ao Consumidor (campo 66)" req span><textarea style={ta} value={form.customer_service} onChange={set("customer_service")} maxLength={5000} /></Field>
                  <Field label="Data de Descontinuação (campo 67)"><input style={inp} type="date" value={form.distribution_end_date} onChange={set("distribution_end_date")} /></Field>
                  <Field label="Data para Publicação (campo 68)" req><input style={inp} type="date" value={form.publication_date} onChange={set("publication_date")} /></Field>

                  {form.refurbished==="Sim" && (<>
                    <SectionHeader icon="🔄" title="Informações de Recondicionamento" sub="Campos 17–21 SIUD" />
                    <Field label="UDI-DI Recondicionado (campo 17)" req><input style={inp} value={form.udi_di_refurbished||""} onChange={set("udi_di_refurbished")} maxLength={25} /></Field>
                    <Field label="Entidade Emissora Recondicionado (campo 18)" req>
                      <select style={sel} value={form.refurb_issuer||"GS1"} onChange={set("refurb_issuer")}>{ISSUERS.map(i=><option key={i}>{i}</option>)}</select>
                    </Field>
                    <Field label="Nome Empresa Recondicionadora (campo 19)" req span><input style={inp} value={form.refurb_company||""} onChange={set("refurb_company")} maxLength={200} /></Field>
                    <Field label="Endereço Recondicionadora (campo 20)" req><input style={inp} value={form.refurb_address||""} onChange={set("refurb_address")} maxLength={80} /></Field>
                    <Field label="País Recondicionadora (campo 21)" req>
                      <select style={sel} value={form.refurb_country||"Brasil"} onChange={set("refurb_country")}>{COUNTRIES.map(c=><option key={c}>{c}</option>)}</select>
                    </Field>
                  </>)}
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:20, alignItems:"center" }}>
              <div style={{ display:"flex", gap:8 }}>
                {FORM_TABS.map((t,i)=>(<>
                  {i>0 && tab===FORM_TABS[i-1].id && <button key={"n"+t.id} style={S.btn()} onClick={()=>setTab(t.id)}>Próximo →</button>}
                </>))}
                {tab!==FORM_TABS[0].id && <button style={S.ghost} onClick={()=>{ const i=FORM_TABS.findIndex(t=>t.id===tab); setTab(FORM_TABS[i-1].id); }}>← Anterior</button>}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button style={S.ghost} onClick={()=>setView("list")}>Cancelar</button>
                <button style={S.btn("#1a4a2a","#50e090")} onClick={saveForm}>✓ Salvar Registro</button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ DETAIL VIEW ══════════ */}
        {view === "detail" && viewRec && (() => {
          const r = viewRec;
          const Row = ({l,v}) => v ? <div style={{ display:"flex", gap:12, padding:"7px 0", borderBottom:"1px solid #0c1420", fontSize:12 }}>
            <span style={{ color:"#2a4060", minWidth:260, flexShrink:0 }}>{l}</span>
            <span style={{ color:"#a0b8d8" }}>{v}</span>
          </div> : null;
          return (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:18, fontWeight:800, color:"#d0e4ff", fontFamily:"'Syne',sans-serif" }}>{r.brand_name||r.trade_name}</div>
                  <div style={{ fontSize:11, color:"#2a4060", marginTop:3 }}>ID interno: {r.id}</div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button style={S.btn("#1a0a30","#b080ff")} onClick={()=>extractData(r)}>↓ Exportar JSON</button>
                  <button style={S.btn("#001a30","#40b0ff")} onClick={()=>printLabel(r)}>🖨 Imprimir Etiqueta Zebra</button>
                  <button style={S.btn()} onClick={()=>openEdit(r)}>✎ Editar</button>
                  <button style={S.btn("#1a0808","#e74c3c")} onClick={()=>deleteRec(r.id)}>Excluir</button>
                </div>
              </div>

              {/* UDI Fixed highlight */}
              <div style={{ background:"linear-gradient(90deg,#0a1a3a,#0a2530)", border:"2px solid #1a4a8a", borderRadius:10, padding:"14px 20px", marginBottom:18, display:"flex", gap:20, alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:9, color:"#2a5080", letterSpacing:1.5, textTransform:"uppercase" }}>UDI Fixo (Permanente)</div>
                  <code style={{ fontSize:20, color:"#60b0ff", fontWeight:700 }}>{r.udi_fixed||"—"}</code>
                </div>
                <div style={{ borderLeft:"1px solid #1a3a6a", paddingLeft:20 }}>
                  <div style={{ fontSize:9, color:"#2a5080", letterSpacing:1.5, textTransform:"uppercase" }}>UDI-DI</div>
                  <code style={{ fontSize:14, color:"#3a80b0" }}>{r.udi_di}</code>
                  <span style={{ fontSize:10, color:"#2a4060", marginLeft:10 }}>{r.issuing_agency}</span>
                </div>
                <div style={{ marginLeft:"auto" }}><Badge s={r.status} /></div>
              </div>

              <div style={{ ...S.card, padding:"20px 24px" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 40px" }}>
                  <div>
                    <div style={{ fontSize:10, color:"#1a3050", letterSpacing:1.5, textTransform:"uppercase", marginBottom:8, marginTop:4 }}>Registro & Identificação</div>
                    <Row l="Nº Registro / Notificação" v={r.reg_number} />
                    <Row l="Nome Comercial" v={r.trade_name||r.brand_name} />
                    <Row l="Versão / Modelo" v={r.version_model} />
                    <Row l="Nº Catálogo" v={r.catalog_number} />
                    <Row l="GMDN" v={r.gmdn_code ? `${r.gmdn_code} — ${r.gmdn_name||""}` : null} />
                    <Row l="Categoria" v={r.device_category} />
                    <div style={{ fontSize:10, color:"#1a3050", letterSpacing:1.5, textTransform:"uppercase", margin:"14px 0 8px" }}>Fabricante</div>
                    <Row l="Razão Social" v={r.manufacturer_name} />
                    <Row l="Endereço" v={r.manufacturer_address} />
                    <Row l="País" v={r.manufacturer_country} />
                    <Row l="Atendimento ao Consumidor" v={r.customer_service} />
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:"#1a3050", letterSpacing:1.5, textTransform:"uppercase", marginBottom:8, marginTop:4 }}>Características</div>
                    <Row l="Uso Único" v={r.single_use} />
                    <Row l="Reutilizável" v={r.reusable} />
                    <Row l="Máx. Reutilizações" v={r.no_reuse_limit?"Sem limite":r.max_reuses} />
                    <Row l="Rotulado Estéril" v={r.sterile_labeled} />
                    <Row l="Método Esterilização" v={r.sterilization_method} />
                    <Row l="Contém Látex" v={r.contains_latex} />
                    <Row l="Segurança RM" v={r.mri_safety} />
                    <Row l="Incorpora IA" v={r.contains_ai} />
                    <div style={{ fontSize:10, color:"#1a3050", letterSpacing:1.5, textTransform:"uppercase", margin:"14px 0 8px" }}>Identificadores de Produção (PI)</div>
                    <Row l="Número de Lote" v={r.has_lot==="Sim"?r.lot_number:null} />
                    <Row l="Número de Série" v={r.has_serial==="Sim"?r.serial_number:null} />
                    <Row l="Data de Validade" v={r.has_expiry==="Sim"?r.expiry_date:null} />
                    <Row l="Data de Manufatura" v={r.has_manufacture_date==="Sim"?r.manufacture_date:null} />
                    <Row l="Versão SaMD" v={r.has_samd_version==="Sim"?r.samd_version:null} />
                  </div>
                </div>

                {/* Audit trail */}
                {r.history?.length > 0 && (
                  <div style={{ marginTop:20, paddingTop:16, borderTop:"1px solid #0c1420" }}>
                    <div style={{ fontSize:10, color:"#1a3050", letterSpacing:1.5, textTransform:"uppercase", marginBottom:10 }}>Histórico de Auditoria</div>
                    {r.history.map((h,i)=>(
                      <div key={i} style={{ display:"flex", gap:12, padding:"6px 0", borderBottom:"1px solid #0a1020", fontSize:11 }}>
                        <span style={{ color:"#2a4060", minWidth:90 }}>{h.date}</span>
                        <span style={{ color:"#a0b8d8" }}>{h.event}</span>
                        <span style={{ color:"#3a5070" }}>por {h.user}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ══════════ ZEBRA PRINTER MODAL ══════════ */}
      {showZebraModal && labelRec && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 }}>
          <div style={{ background:"#0b1020", border:"1px solid #1a2c44", borderRadius:12, width:"100%", maxWidth:560, padding:30 }}>
            <div style={{ fontSize:16, fontWeight:700, color:"#d0e4ff", fontFamily:"'Syne',sans-serif", marginBottom:4 }}>🖨 Imprimir Etiqueta Zebra</div>
            <div style={{ fontSize:11, color:"#3a5070", marginBottom:20 }}>{labelRec.brand_name||labelRec.trade_name} — {labelRec.udi_fixed||labelRec.udi_di}</div>

            {/* IP Config */}
            <div style={{ background:"#080e1a", border:"1px solid #111e30", borderRadius:8, padding:16, marginBottom:18 }}>
              <div style={{ fontSize:10, color:"#2a4060", letterSpacing:1.5, textTransform:"uppercase", marginBottom:10 }}>Configuração da Impressora Zebra</div>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10 }}>
                <div>
                  <label style={{ fontSize:10, color:"#3a5070", display:"block", marginBottom:4 }}>Endereço IP</label>
                  <input style={inp} value={zebraIP} onChange={e=>setZebraIP(e.target.value)} placeholder="192.168.1.100" />
                </div>
                <div>
                  <label style={{ fontSize:10, color:"#3a5070", display:"block", marginBottom:4 }}>Porta TCP</label>
                  <input style={inp} value={zebraPort} onChange={e=>setZebraPort(e.target.value)} placeholder="9100" />
                </div>
              </div>
              <div style={{ fontSize:10, color:"#1a3050", marginTop:8 }}>Para envio direto, instale o <b style={{ color:"#3a6090" }}>Zebra Browser Print</b> no computador. A porta padrão Zebra é 9100.</div>
            </div>

            {/* ZPL Preview snippet */}
            <div style={{ background:"#060b12", border:"1px solid #0e1a28", borderRadius:8, padding:12, marginBottom:18, maxHeight:130, overflow:"auto" }}>
              <div style={{ fontSize:9, color:"#1a3050", letterSpacing:1.5, textTransform:"uppercase", marginBottom:6 }}>ZPL Preview</div>
              <pre style={{ fontSize:10, color:"#3a7090", margin:0, fontFamily:"monospace", whiteSpace:"pre-wrap" }}>
                {buildZPL(labelRec).slice(0,300)}...
              </pre>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
              <button style={{ ...S.btn("#0a2a40","#40b0ff"), textAlign:"center", padding:"10px 0" }} onClick={sendToZebra}>
                <div>📡 Enviar</div>
                <div style={{ fontSize:9, opacity:.7 }}>via Browser Print</div>
              </button>
              <button style={{ ...S.btn("#0a1a30","#6090d0"), textAlign:"center", padding:"10px 0" }} onClick={()=>copyZPL(labelRec)}>
                <div>📋 Copiar ZPL</div>
                <div style={{ fontSize:9, opacity:.7 }}>para clipboard</div>
              </button>
              <button style={{ ...S.btn("#0a1a20","#30a080"), textAlign:"center", padding:"10px 0" }} onClick={()=>{ printPreview(labelRec); setShowZebraModal(false); }}>
                <div>🔍 Ver ZPL</div>
                <div style={{ fontSize:9, opacity:.7 }}>em nova aba</div>
              </button>
            </div>

            <div style={{ background:"#0a1a0a", border:"1px solid #1a3a1a", borderRadius:8, padding:12, marginBottom:18 }}>
              <div style={{ fontSize:10, color:"#2a5030", letterSpacing:1.5, textTransform:"uppercase", marginBottom:6 }}>Como conectar à impressora Zebra</div>
              <div style={{ fontSize:11, color:"#3a6040" }}>1. Instale <b>Zebra Browser Print</b> em <code style={{ color:"#50a060" }}>zebra.com/browserprint</code></div>
              <div style={{ fontSize:11, color:"#3a6040" }}>2. Configure IP/porta da sua impressora ZPL acima</div>
              <div style={{ fontSize:11, color:"#3a6040" }}>3. Clique "Enviar via Browser Print" para imprimir direto</div>
              <div style={{ fontSize:11, color:"#3a6040" }}>4. Ou copie o ZPL e envie via <code style={{ color:"#50a060" }}>labelary.com</code> para prévia</div>
            </div>

            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button style={S.ghost} onClick={()=>setShowZebraModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
