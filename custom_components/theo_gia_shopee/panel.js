/*
 * Theo giá Shopee — panel bảng giá (native HA, Shadow DOM).
 *
 * Dữ liệu lấy TỪ CHÍNH Home Assistant, không gọi Extora câu nào: ext
 * `io.extora.shopee` đẩy sang bằng MQTT discovery, HA dựng thực thể, panel đọc
 * lại. Nhờ vậy panel vẫn chạy khi Extora đang tắt — giá hiện là giá đọc được
 * lần cuối, và HA giữ lại.
 *
 * Nhận ra thực thể của mình bằng thuộc tính `nguon === "extora-shopee"`.
 * Lọc theo TÊN thực thể là mời một sensor tình cờ trùng tên vào bảng.
 */

const NGUON = "extora-shopee";

const STYLE = `
<style>
:host{
  --bg:#16141b;--panel:#221f2b;--panel-2:#2a2633;
  --line:rgba(255,255,255,.08);--line-strong:rgba(255,255,255,.14);
  --text:#f3efe9;--muted:#a59eb4;--faint:#6f6980;
  --ok:#5fd29a;--warn:#ffb24c;--danger:#f0676a;--accent:#62a8ef;
  --radius:16px;--shadow:0 10px 40px -18px rgba(0,0,0,.7);
  --font:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  display:block;min-height:100vh;color:var(--text);font-family:var(--font);
  background:radial-gradient(1100px 600px at 80% -10%,rgba(98,168,239,.10),transparent 60%),
             radial-gradient(900px 500px at 0% 110%,rgba(95,210,154,.06),transparent 55%),var(--bg);
}
*{box-sizing:border-box}
.wrap{max-width:1180px;margin:0 auto;padding:14px 18px 80px}
.topbar{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.menu{width:42px;height:42px;border-radius:12px;flex:none;background:var(--panel);
  border:1px solid var(--line);color:var(--muted);font-size:20px;display:grid;
  place-items:center;cursor:pointer}
.menu:hover{border-color:var(--line-strong);color:var(--text)}
.brand h1{font-weight:700;font-size:21px;letter-spacing:-.02em;margin:0;line-height:1.05}
.brand .sub{font-size:12.5px;color:var(--faint)}
.spacer{flex:1}
.kpis{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}
.kpi{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);
  padding:11px 15px;min-width:132px;box-shadow:var(--shadow)}
.kpi span{display:block;font-size:10.5px;color:var(--faint);text-transform:uppercase;
  letter-spacing:.05em;font-weight:600;margin-bottom:3px}
.kpi b{font-size:19px;font-weight:700;letter-spacing:-.01em}
.kpi b.ok{color:var(--ok)} .kpi b.warn{color:var(--warn)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);
  overflow:hidden;box-shadow:var(--shadow)}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--line);font-size:14px;
  white-space:nowrap}
th{color:var(--faint);font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;
  font-weight:600;background:var(--panel-2);position:sticky;top:0}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover{background:rgba(255,255,255,.02)}
td.ten{white-space:normal;max-width:420px}
td.ten a{color:var(--text);text-decoration:none;font-weight:550}
td.ten a:hover{color:var(--accent);text-decoration:underline}
.num{font-variant-numeric:tabular-nums}
.gia{font-weight:700}
.day{color:var(--ok)}
.goc{color:var(--faint);text-decoration:line-through}
.pill{display:inline-block;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:99px;
  margin-left:7px;vertical-align:middle}
.pill.day{background:rgba(95,210,154,.14);color:var(--ok)}
.pill.het{background:rgba(240,103,106,.14);color:var(--danger)}
.pill.cu{background:rgba(255,178,76,.14);color:var(--warn)}
.giam{color:var(--ok);font-weight:650}
.tang{color:var(--danger);font-weight:650}
.role{color:var(--faint);font-size:12px}
.trong{padding:52px 24px;text-align:center;color:var(--muted);line-height:1.7}
.trong code{background:var(--panel-2);padding:2px 7px;border-radius:6px;font-size:12.5px}
</style>`;

const dong = (v) =>
  v === null || v === undefined || v === "" || isNaN(Number(v))
    ? "—"
    : Number(v).toLocaleString("vi-VN") + " ₫";

/** Bao lâu rồi kể từ lần đọc cuối — để biết con số đang nhìn còn tươi không. */
function tuoi(iso) {
  if (!iso) return { chu: "—", cu: false };
  const t = new Date(iso).getTime();
  if (isNaN(t)) return { chu: String(iso), cu: false };
  const p = Math.round((Date.now() - t) / 60000);
  if (p < 1) return { chu: "vừa xong", cu: false };
  if (p < 60) return { chu: `${p} phút trước`, cu: false };
  const g = Math.round(p / 60);
  if (g < 24) return { chu: `${g} giờ trước`, cu: g >= 6 };
  return { chu: `${Math.round(g / 24)} ngày trước`, cu: true };
}

class TheoGiaShopeePanel extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    this._ve();
  }

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._ve();
  }

  /** Mỗi sản phẩm = một thực thể `sensor` mang đủ thuộc tính trong payload. */
  _dsSanPham() {
    const h = this._hass;
    if (!h) return [];
    return Object.values(h.states)
      .filter((s) => s.attributes && s.attributes.nguon === NGUON && s.attributes.link)
      .map((s) => {
        const a = s.attributes;
        const gia = a.gia ?? (s.state === "unavailable" ? null : Number(s.state));
        return {
          id: s.entity_id,
          ten: a.ten || a.friendly_name || s.entity_id,
          link: a.link,
          gia: gia === null || isNaN(gia) ? null : gia,
          gia_goc: a.gia_goc ?? null,
          thap_nhat: a.thap_nhat ?? null,
          cao_nhat: a.cao_nhat ?? null,
          thay_doi: Number(a.thay_doi ?? 0),
          dang_o_day: !!a.dang_o_day,
          con_hang: a.con_hang !== "OFF",
          luc: a.luc || null,
          song: s.state !== "unavailable",
        };
      })
      // Món vừa giảm mạnh nhất lên trên: đó là dòng người ta mở panel để tìm.
      .sort((x, y) => (x.thay_doi || 0) - (y.thay_doi || 0) || x.ten.localeCompare(y.ten));
  }

  _ve() {
    if (!this.shadowRoot) return;
    const ds = this._dsSanPham();
    const oDay = ds.filter((x) => x.dang_o_day).length;
    const giam = ds.filter((x) => x.thay_doi < 0).length;

    const than = ds.length === 0 ? `
      <div class="trong">
        Chưa thấy sản phẩm nào.<br>
        Trong Extora, mở ext <b>Shopee</b> → <b>⚙ Thiết lập</b>, khai broker MQTT, bật
        <b>đẩy sang Home Assistant</b> rồi bấm <b>Đồng bộ lại toàn bộ</b>.<br>
        <span class="role">Panel đọc các thực thể MQTT có thuộc tính
        <code>nguon: ${NGUON}</code> — không gọi sang Extora câu nào.</span>
      </div>` : `
      <table>
        <thead><tr>
          <th>Sản phẩm</th><th>Giá hiện tại</th><th>Giá gốc</th>
          <th>Thấp nhất</th><th>Cao nhất</th><th>Thay đổi</th><th>Đọc lúc</th>
        </tr></thead>
        <tbody>${ds.map((x) => {
          const t = tuoi(x.luc);
          return `<tr>
            <td class="ten">
              <a href="${x.link}" target="_blank" rel="noreferrer">${x.ten}</a>
              ${x.dang_o_day ? '<span class="pill day">đáy</span>' : ""}
              ${x.con_hang ? "" : '<span class="pill het">hết hàng</span>'}
              ${x.song ? "" : '<span class="pill cu">mất kết nối</span>'}
            </td>
            <td class="num gia ${x.dang_o_day ? "day" : ""}">${dong(x.gia)}</td>
            <td class="num goc">${dong(x.gia_goc)}</td>
            <td class="num day">${dong(x.thap_nhat)}</td>
            <td class="num role">${dong(x.cao_nhat)}</td>
            <td class="num ${x.thay_doi < 0 ? "giam" : x.thay_doi > 0 ? "tang" : "role"}">
              ${x.thay_doi ? (x.thay_doi > 0 ? "+" : "") + x.thay_doi.toFixed(2) + "%" : "—"}
            </td>
            <td class="role">${t.chu}${t.cu ? ' <span class="pill cu">cũ</span>' : ""}</td>
          </tr>`;
        }).join("")}</tbody>
      </table>`;

    this.shadowRoot.innerHTML = `${STYLE}
      <div class="wrap">
        <div class="topbar">
          <div class="menu" id="menu">☰</div>
          <div class="brand">
            <h1>Theo giá Shopee</h1>
            <div class="sub">Dữ liệu do Extora đẩy sang qua MQTT</div>
          </div>
          <div class="spacer"></div>
        </div>
        <div class="kpis">
          <div class="kpi"><span>Đang theo dõi</span><b>${ds.length}</b></div>
          <div class="kpi"><span>Đang ở đáy</span><b class="${oDay ? "ok" : ""}">${oDay}</b></div>
          <div class="kpi"><span>Vừa giảm</span><b class="${giam ? "ok" : ""}">${giam}</b></div>
        </div>
        <div class="card">${than}</div>
      </div>`;

    const m = this.shadowRoot.getElementById("menu");
    if (m) {
      m.onclick = () =>
        this.dispatchEvent(
          new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true })
        );
    }
  }
}

customElements.define("theo-gia-shopee-panel", TheoGiaShopeePanel);
