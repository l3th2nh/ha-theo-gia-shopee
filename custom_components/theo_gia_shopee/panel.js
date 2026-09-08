/*
 * Theo giá Shopee — panel (native HA, Shadow DOM).
 *
 * Ba màn: DANH SÁCH (thẻ, hợp điện thoại) · CHI TIẾT (biểu đồ + lịch sử từ
 * recorder của HA) · THÊM (gửi lệnh về Extora qua MQTT).
 *
 * Dữ liệu giá lấy TỪ CHÍNH Home Assistant, không gọi Extora: ext
 * `io.extora.shopee` đẩy sang bằng MQTT discovery, HA dựng thực thể, panel đọc
 * lại. Lịch sử lấy từ recorder của HA (`history/history_during_period`) — không
 * phải dựng thêm kho dữ liệu thứ hai.
 *
 * Thêm sản phẩm đi CHIỀU NGƯỢC LẠI: panel gọi `mqtt.publish` lên
 * `extora/shopee/lenh`, Extora nghe và xử lý. Cùng một broker, không mở thêm
 * cửa nào.
 */

const NGUON = "extora-shopee";
const TOPIC_LENH = "extora/shopee/lenh";

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
.wrap{max-width:820px;margin:0 auto;padding:12px 14px 90px}
.topbar{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.menu{width:40px;height:40px;border-radius:12px;flex:none;background:var(--panel);
  border:1px solid var(--line);color:var(--muted);font-size:19px;display:grid;
  place-items:center;cursor:pointer}
.brand h1{font-weight:700;font-size:19px;letter-spacing:-.02em;margin:0;line-height:1.1}
.brand .sub{font-size:12px;color:var(--faint)}
.spacer{flex:1}

/* Tabs */
.tabs{display:flex;gap:6px;margin-bottom:14px}
.tab{flex:1;padding:10px 12px;border-radius:12px;cursor:pointer;text-align:center;
  background:var(--panel);border:1px solid var(--line);color:var(--muted);
  font-weight:550;font-size:14px}
.tab.active{background:var(--panel-2);color:var(--text);border-color:var(--line-strong)}

/* KPI */
.kpis{display:flex;gap:8px;margin-bottom:14px}
.kpi{flex:1;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);
  padding:10px 12px;box-shadow:var(--shadow);min-width:0}
.kpi span{display:block;font-size:10px;color:var(--faint);text-transform:uppercase;
  letter-spacing:.05em;font-weight:600;margin-bottom:2px}
.kpi b{font-size:18px;font-weight:700}
.kpi b.ok{color:var(--ok)}

/* Thẻ sản phẩm — TÊN PHỦ CẢ THẺ, giá xuống dưới. Trên điện thoại một hàng
   ngang bảy cột là không đọc nổi. */
.the{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);
  padding:13px 14px;margin-bottom:10px;box-shadow:var(--shadow);cursor:pointer}
.the:active{background:var(--panel-2)}
.the .ten{font-size:14.5px;font-weight:600;line-height:1.35;margin-bottom:9px;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.hang{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}
.gia{font-size:22px;font-weight:750;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.gia.day{color:var(--ok)}
.goc{font-size:13px;color:var(--faint);text-decoration:line-through;
  font-variant-numeric:tabular-nums}
.pill{display:inline-block;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:99px}
.pill.day{background:rgba(95,210,154,.14);color:var(--ok)}
.pill.giam{background:rgba(95,210,154,.14);color:var(--ok)}
.pill.tang{background:rgba(240,103,106,.14);color:var(--danger)}
.pill.het{background:rgba(240,103,106,.14);color:var(--danger)}
.pill.cu{background:rgba(255,178,76,.14);color:var(--warn)}
.duoi{display:flex;gap:14px;flex-wrap:wrap;margin-top:9px;padding-top:9px;
  border-top:1px solid var(--line);font-size:12px;color:var(--muted)}
.duoi b{color:var(--text);font-weight:600;font-variant-numeric:tabular-nums}

/* Chi tiết */
.quay{background:none;border:none;color:var(--accent);font:inherit;font-size:14px;
  cursor:pointer;padding:6px 0;margin-bottom:6px}
.hop{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);
  padding:14px;margin-bottom:10px;box-shadow:var(--shadow)}
.hop h3{margin:0 0 10px;font-size:15px;font-weight:650;line-height:1.35}
.o{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:10px}
.o div span{display:block;font-size:10px;color:var(--faint);text-transform:uppercase;
  letter-spacing:.05em;font-weight:600;margin-bottom:2px}
.o div b{font-size:16px;font-weight:700;font-variant-numeric:tabular-nums}
svg.chart{display:block;width:100%;border-radius:10px;background:var(--panel-2);
  border:1px solid var(--line)}
.chart .luoi{stroke:var(--line);stroke-width:1}
.chart .duong{fill:none;stroke:var(--accent);stroke-width:2.5;stroke-linejoin:round}
.chart .vung{fill:url(#g-gia);stroke:none}
.chart .nhan{font-size:10px;fill:var(--faint)}
.chart .cham{fill:var(--ok);stroke:var(--panel-2);stroke-width:2}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line)}
th{color:var(--faint);font-size:10px;text-transform:uppercase;letter-spacing:.05em}
td.n{text-align:right;font-variant-numeric:tabular-nums}
td.giam{color:var(--ok)} td.tang{color:var(--danger)}
a.mo{display:inline-block;margin-top:12px;color:var(--accent);font-size:13px}

/* Form thêm */
label.f{display:block;margin-bottom:12px;font-size:12px;color:var(--muted);font-weight:550}
label.f input,label.f select{display:block;width:100%;margin-top:5px;padding:11px 12px;
  border-radius:10px;border:1px solid var(--line);background:var(--panel-2);
  color:var(--text);font:inherit;font-size:15px}
.nut{width:100%;padding:13px;border-radius:12px;border:1px solid var(--accent);
  background:var(--accent);color:#0d1117;font:inherit;font-size:15px;font-weight:700;
  cursor:pointer}
.nut:disabled{opacity:.5;cursor:not-allowed}
.bao{margin-top:12px;padding:10px 12px;border-radius:10px;font-size:13px;
  background:var(--panel-2);border:1px solid var(--line);color:var(--muted)}
.bao.ok{border-color:var(--ok);color:var(--ok)}
.bao.loi{border-color:var(--danger);color:var(--danger)}
.trong{padding:44px 20px;text-align:center;color:var(--muted);line-height:1.7}
.trong code{background:var(--panel-2);padding:2px 7px;border-radius:6px;font-size:12.5px}
</style>`;

const dong = (v) =>
  v === null || v === undefined || v === "" || isNaN(Number(v))
    ? "—"
    : Number(v).toLocaleString("vi-VN") + " ₫";

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

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

class TheoGiaShopeePanel extends HTMLElement {
  constructor() {
    super();
    this._man = "ds";        // ds | ct | them
    this._chon = null;       // entity_id đang xem chi tiết
    this._su = [];           // lịch sử của món đang xem
    this._bao = null;
    this._dangGui = false;
    // Giá trị người dùng đang gõ. PHẢI giữ ngoài DOM: mỗi lần vẽ lại là ô nhập
    // bị thay mới, và cái đang gõ dở biến mất theo.
    this._form = { link: "", nhip: "60", nguong: "0", giam: false };
    this._chuKy = null;
  }

  set hass(hass) {
    this._hass = hass;
    // Home Assistant đẩy `hass` mỗi khi BẤT KỲ thực thể nào đổi — vài lần mỗi
    // giây trong một căn nhà bình thường. Vẽ lại mù quáng theo nó là:
    //   · chữ vừa gõ trong form biến mất sau một giây
    //   · ô tick tự bỏ chọn
    //   · biểu đồ nhấp nháy, cuộn trang nhảy về đầu
    // Nên chỉ vẽ lại khi thứ ĐANG HIỆN thật sự đổi.
    if (this._man === "them") return;          // form không đọc gì từ hass
    const chu = JSON.stringify(this._ds());
    if (chu === this._chuKy) return;
    this._chuKy = chu;
    this._ve();
  }

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._ve();
  }

  _ds() {
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
          trung_binh: a.trung_binh ?? null,
          thay_doi: Number(a.thay_doi ?? 0),
          dang_o_day: !!a.dang_o_day,
          con_hang: a.con_hang !== "OFF",
          luc: a.luc || null,
          song: s.state !== "unavailable",
        };
      })
      .sort((x, y) => (x.thay_doi || 0) - (y.thay_doi || 0) || x.ten.localeCompare(y.ten));
  }

  /** Lịch sử lấy từ recorder của HA — không dựng kho dữ liệu thứ hai. */
  async _napSu(entity_id) {
    this._su = [];
    try {
      const tu = new Date(Date.now() - 30 * 864e5).toISOString();
      const r = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: tu,
        entity_ids: [entity_id],
        minimal_response: true,
        no_attributes: true,
      });
      const ds = (r && r[entity_id]) || [];
      this._su = ds
        .map((x) => ({ luc: x.lu ? x.lu * 1000 : Date.parse(x.last_changed), gia: Number(x.s) }))
        .filter((x) => !isNaN(x.gia) && !isNaN(x.luc));
    } catch (e) {
      this._bao = { loai: "loi", chu: "Không đọc được lịch sử: " + e };
    }
    this._ve();
  }

  async _them() {
    const link = (this._form.link || "").trim();
    if (!link) {
      this._bao = { loai: "loi", chu: "Chưa dán link sản phẩm." };
      this._ve();
      return;
    }
    this._dangGui = true;
    this._bao = { loai: "", chu: "Đang gửi lệnh sang Extora…" };
    this._ve();
    try {
      await this._hass.callService("mqtt", "publish", {
        topic: TOPIC_LENH,
        qos: 1,
        payload: JSON.stringify({
          lenh: "them",
          link,
          nhip_phut: Number(this._form.nhip) || 60,
          nguong_phan_tram: Number(this._form.nguong) || 0,
          chi_bao_giam: !!this._form.giam,
        }),
      });
      this._bao = {
        loai: "ok",
        chu: "Đã gửi. Extora sẽ thêm và đọc giá lần đầu — sản phẩm hiện ra ở tab "
          + "Danh sách sau khoảng một phút.",
      };
      this._form.link = "";
    } catch (e) {
      this._bao = { loai: "loi", chu: "Không gửi được: " + e };
    }
    this._dangGui = false;
    this._ve();
  }

  _veChart(su) {
    if (su.length < 2) return `<div class="trong">Chưa đủ dữ liệu để vẽ đường.</div>`;
    const W = 640, H = 200, L = 58, R = 12, T = 14, B = 26;
    const gs = su.map((x) => x.gia);
    let min = Math.min(...gs), max = Math.max(...gs);
    if (max === min) { min = Math.max(0, min * 0.95); max = max * 1.05 || 1; }
    const t0 = su[0].luc, t1 = su[su.length - 1].luc, sp = t1 - t0 || 1;
    const X = (x) => L + ((x.luc - t0) / sp) * (W - L - R);
    const Y = (g) => T + (1 - (g - min) / (max - min)) * (H - T - B);
    // Bậc thang: giá GIỮ nguyên rồi nhảy, không trôi dần. Nối thẳng là vẽ ra
    // những mức giá chưa từng tồn tại.
    let d = `M ${X(su[0])} ${Y(gs[0])}`;
    for (let i = 1; i < su.length; i++) d += ` L ${X(su[i])} ${Y(gs[i - 1])} L ${X(su[i])} ${Y(gs[i])}`;
    const vung = `${d} L ${X(su[su.length - 1])} ${H - B} L ${X(su[0])} ${H - B} Z`;
    const iDay = gs.indexOf(Math.min(...gs));   // chấm đánh dấu đáy
    const nh = (v) => (v >= 1e6 ? (v / 1e6).toFixed(1) + "tr" : Math.round(v / 1e3) + "k");
    const ngay = (t) => new Date(t).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id="g-gia" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#62a8ef" stop-opacity=".30"/>
        <stop offset="100%" stop-color="#62a8ef" stop-opacity="0"/>
      </linearGradient></defs>
      ${[0, 0.5, 1].map((f) => {
        const g = min + (max - min) * f;
        return `<line class="luoi" x1="${L}" x2="${W - R}" y1="${Y(g)}" y2="${Y(g)}"/>
                <text class="nhan" x="${L - 8}" y="${Y(g) + 4}" text-anchor="end">${nh(g)}</text>`;
      }).join("")}
      <path class="vung" d="${vung}"/><path class="duong" d="${d}"/>
      <circle class="cham" cx="${X(su[iDay])}" cy="${Y(gs[iDay])}" r="4.5"/>
      <text class="nhan" x="${L}" y="${H - 8}">${ngay(t0)}</text>
      <text class="nhan" x="${W - R}" y="${H - 8}" text-anchor="end">${ngay(t1)}</text>
    </svg>`;
  }

  _veCt(sp) {
    const su = this._su;
    // Chỉ giữ những lần giá THẬT SỰ đổi — recorder ghi cả những lần đọc ra đúng
    // giá cũ, và một bảng toàn dòng giống nhau thì không đọc được gì.
    const doi = [];
    for (let i = 0; i < su.length; i++) {
      if (i === 0 || su[i].gia !== su[i - 1].gia) {
        doi.push({ ...su[i], truoc: i ? su[i - 1].gia : null });
      }
    }
    const t = tuoi(sp.luc);
    return `
      <button class="quay" id="quay">← Danh sách</button>
      <div class="hop">
        <h3>${esc(sp.ten)}</h3>
        <div class="hang">
          <span class="gia ${sp.dang_o_day ? "day" : ""}">${dong(sp.gia)}</span>
          ${sp.gia_goc ? `<span class="goc">${dong(sp.gia_goc)}</span>` : ""}
          ${sp.dang_o_day ? '<span class="pill day">đáy</span>' : ""}
          ${sp.con_hang ? "" : '<span class="pill het">hết hàng</span>'}
        </div>
        <div class="o" style="margin-top:14px">
          <div><span>Thấp nhất</span><b style="color:var(--ok)">${dong(sp.thap_nhat)}</b></div>
          <div><span>Cao nhất</span><b>${dong(sp.cao_nhat)}</b></div>
          <div><span>Trung bình</span><b>${dong(sp.trung_binh)}</b></div>
          <div><span>Đọc lúc</span><b style="font-size:13px">${t.chu}</b></div>
        </div>
        <a class="mo" href="${esc(sp.link)}" target="_blank" rel="noreferrer">Mở trên Shopee ↗</a>
      </div>
      <div class="hop">
        <h3>Biểu đồ giá — 30 ngày</h3>
        ${this._veChart(su)}
      </div>
      <div class="hop">
        <h3>Lần đổi giá (${doi.length})</h3>
        ${doi.length === 0 ? '<div class="trong">Giá chưa đổi lần nào.</div>' : `
        <table><thead><tr><th>Lúc</th><th style="text-align:right">Giá</th>
          <th style="text-align:right">Đổi</th></tr></thead><tbody>
          ${doi.slice().reverse().slice(0, 60).map((x) => {
            const l = x.truoc === null ? null : x.gia - x.truoc;
            return `<tr>
              <td>${new Date(x.luc).toLocaleString("vi-VN")}</td>
              <td class="n">${dong(x.gia)}</td>
              <td class="n ${l === null ? "" : l < 0 ? "giam" : "tang"}">
                ${l === null ? "—" : (l > 0 ? "+" : "−") + dong(Math.abs(l))}</td>
            </tr>`;
          }).join("")}
        </tbody></table>`}
      </div>`;
  }

  _veThem() {
    return `
      <div class="hop">
        <h3>Thêm sản phẩm</h3>
        <p style="font-size:12.5px;color:var(--muted);margin:0 0 14px;line-height:1.6">
          Dán link sản phẩm Shopee. Lệnh gửi qua MQTT về Extora — nó bóc mã sản phẩm,
          gắn tài khoản đang đăng nhập và đọc giá lần đầu ngay.
        </p>
        <label class="f">Link sản phẩm
          <input id="link" type="url" inputmode="url" placeholder="https://shopee.vn/..."
                 value="${esc(this._form.link)}" />
        </label>
        <label class="f">Đọc mỗi
          <select id="nhip">
            ${[["15", "15 phút"], ["30", "30 phút"], ["60", "1 giờ"], ["180", "3 giờ"],
               ["360", "6 giờ"], ["1440", "1 ngày"]].map(([v, n]) =>
              `<option value="${v}" ${this._form.nhip === v ? "selected" : ""}>${n}</option>`
            ).join("")}
          </select>
        </label>
        <label class="f">Báo khi đổi ≥ (%)
          <input id="nguong" type="number" inputmode="decimal" min="0" max="100" step="0.5"
                 value="${esc(this._form.nguong)}" />
        </label>
        <label class="f" style="display:flex;align-items:center;gap:9px">
          <input id="giam" type="checkbox" style="width:18px;height:18px;margin:0"
                 ${this._form.giam ? "checked" : ""} />
          Chỉ báo khi giảm
        </label>
        <button class="nut" id="gui" ${this._dangGui ? "disabled" : ""}>
          ${this._dangGui ? "Đang gửi…" : "Thêm sản phẩm"}
        </button>
        ${this._bao ? `<div class="bao ${this._bao.loai}">${esc(this._bao.chu)}</div>` : ""}
      </div>`;
  }

  _veDs(ds) {
    if (ds.length === 0) {
      return `<div class="trong">
        Chưa thấy sản phẩm nào.<br>
        Thêm ở tab <b>Thêm</b>, hoặc trong Extora bật <b>đẩy sang Home Assistant</b>
        rồi bấm <b>Đồng bộ lại toàn bộ</b>.<br>
        <span style="font-size:12px">Panel đọc thực thể MQTT có
        <code>nguon: ${NGUON}</code>.</span>
      </div>`;
    }
    return ds.map((x) => {
      const t = tuoi(x.luc);
      return `<div class="the" data-id="${x.id}">
        <div class="ten">${esc(x.ten)}</div>
        <div class="hang">
          <span class="gia ${x.dang_o_day ? "day" : ""}">${dong(x.gia)}</span>
          ${x.gia_goc && x.gia_goc !== x.gia ? `<span class="goc">${dong(x.gia_goc)}</span>` : ""}
          ${x.thay_doi ? `<span class="pill ${x.thay_doi < 0 ? "giam" : "tang"}">
            ${x.thay_doi > 0 ? "+" : ""}${x.thay_doi.toFixed(1)}%</span>` : ""}
          ${x.dang_o_day ? '<span class="pill day">đáy</span>' : ""}
          ${x.con_hang ? "" : '<span class="pill het">hết hàng</span>'}
          ${x.song ? "" : '<span class="pill cu">mất kết nối</span>'}
        </div>
        <div class="duoi">
          <div>Thấp nhất <b style="color:var(--ok)">${dong(x.thap_nhat)}</b></div>
          <div>Cao nhất <b>${dong(x.cao_nhat)}</b></div>
          <div>${t.chu}${t.cu ? ' <span class="pill cu">cũ</span>' : ""}</div>
        </div>
      </div>`;
    }).join("");
  }

  _ve() {
    if (!this.shadowRoot) return;
    const ds = this._ds();
    const oDay = ds.filter((x) => x.dang_o_day).length;
    const giam = ds.filter((x) => x.thay_doi < 0).length;
    const sp = this._chon ? ds.find((x) => x.id === this._chon) : null;
    const man = sp ? "ct" : this._man === "ct" ? "ds" : this._man;

    const than =
      man === "ct" ? this._veCt(sp)
        : man === "them" ? this._veThem()
          : `<div class="kpis">
               <div class="kpi"><span>Theo dõi</span><b>${ds.length}</b></div>
               <div class="kpi"><span>Ở đáy</span><b class="${oDay ? "ok" : ""}">${oDay}</b></div>
               <div class="kpi"><span>Vừa giảm</span><b class="${giam ? "ok" : ""}">${giam}</b></div>
             </div>${this._veDs(ds)}`;

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
        ${man === "ct" ? "" : `<div class="tabs">
          <div class="tab ${man === "ds" ? "active" : ""}" data-man="ds">Danh sách</div>
          <div class="tab ${man === "them" ? "active" : ""}" data-man="them">Thêm</div>
        </div>`}
        ${than}
      </div>`;

    const r = this.shadowRoot;
    const m = r.getElementById("menu");
    if (m) m.onclick = () =>
      this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));

    r.querySelectorAll(".tab").forEach((el) => {
      el.onclick = () => { this._man = el.dataset.man; this._bao = null; this._ve(); };
    });
    r.querySelectorAll(".the").forEach((el) => {
      el.onclick = () => {
        this._chon = el.dataset.id;
        this._man = "ct";
        this._napSu(this._chon);
        this._ve();
      };
    });
    const q = r.getElementById("quay");
    if (q) q.onclick = () => { this._chon = null; this._man = "ds"; this._su = []; this._ve(); };

    // Ghi vào state NGAY khi gõ. Đợi tới lúc bấm gửi mới đọc DOM thì chỉ cần
    // một lần vẽ lại xen vào là mất trắng.
    const noi = (id, khoa, lay) => {
      const el = r.getElementById(id);
      if (!el) return;
      const ghi = () => { this._form[khoa] = lay(el); };
      el.oninput = ghi;
      el.onchange = ghi;
    };
    noi("link", "link", (e) => e.value);
    noi("nhip", "nhip", (e) => e.value);
    noi("nguong", "nguong", (e) => e.value);
    noi("giam", "giam", (e) => e.checked);

    const g = r.getElementById("gui");
    if (g) g.onclick = () => this._them();
  }
}

customElements.define("theo-gia-shopee-panel", TheoGiaShopeePanel);
