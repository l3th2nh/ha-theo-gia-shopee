# Theo giá Shopee — panel bảng giá cho Home Assistant

Panel **"Theo giá Shopee"** trên sidebar: bảng các sản phẩm mà app **Extora**
(ext `io.extora.shopee`) đang theo dõi, kèm **giá hiện tại · giá gốc · thấp
nhất · cao nhất · % thay đổi · đọc lúc nào**.

Tích hợp này **không nói chuyện với Extora** và **không gọi ra Internet**. Dữ
liệu đã nằm sẵn trong Home Assistant: Extora đẩy sang bằng **MQTT discovery**,
HA tự dựng thực thể, panel chỉ đọc lại. Nên nó không cần địa chỉ máy chủ, không
cần khoá API, không cần mở cổng — và vẫn hiển thị khi Extora đang tắt (giá hiện
là giá đọc được lần cuối, HA giữ lại).

---

## 1. Chuẩn bị: broker MQTT

Đây là phần hay bị vướng nhất, nên nói kỹ. **Tài khoản/mật khẩu MQTT không phải
lấy từ đâu cả — bạn tự tạo.**

### 1.1 Cài broker

**Settings → Add-ons → Add-on Store → Mosquitto broker → Install → Start**
(nhớ bật **Start on boot**).

> Không dùng HA OS/Supervised (bản Container/Core) thì cài Mosquitto riêng bằng
> Docker; các bước dưới không đổi, chỉ khác chỗ tạo tài khoản.

### 1.2 Tạo tài khoản cho MQTT

Add-on Mosquitto **dùng luôn tài khoản Home Assistant**. Đừng dùng tài khoản
quản trị của bạn — tạo một tài khoản riêng để sau này thu hồi được:

**Settings → People → Add person**
- Tên: `extora`
- Bật **Allow person to login**
- Đặt mật khẩu, **tắt** *Local access only* nếu Extora chạy trên máy khác
- Không cần quyền Administrator

Tên đăng nhập + mật khẩu vừa tạo **chính là** tài khoản/mật khẩu điền vào Extora.

### 1.3 Bật tích hợp MQTT

Sau khi Mosquitto chạy, HA thường tự phát hiện:
**Settings → Devices & Services** → thẻ **MQTT** → **Configure**.
Chưa thấy thì **Add Integration → MQTT**, broker `core-mosquitto`, cổng `1883`,
điền tài khoản vừa tạo.

### 1.4 Điền vào Extora

Trong Extora: ext **Shopee → ⚙ Thiết lập**

| Ô | Điền gì |
|---|---|
| **Địa chỉ** | IP của máy chạy **Home Assistant** trong mạng LAN, ví dụ `192.168.0.50`. Xem ở **Settings → System → Network**, hoặc chính IP bạn gõ để mở HA |
| **Cổng** | `1883` |
| **Tài khoản** | tên đăng nhập vừa tạo ở §1.2 (`extora`) |
| **Mật khẩu** | mật khẩu của tài khoản đó |
| **dùng TLS** | để trống (Mosquitto mặc định 1883 không TLS) |
| **đẩy sang Home Assistant** | ✅ bật |
| **Tiền tố discovery** | `homeassistant` (giữ nguyên) |

Bấm **Lưu** → **Thử kết nối**. Được rồi thì bấm **Đồng bộ lại toàn bộ**.

> **Địa chỉ KHÔNG phải `localhost`** trừ khi Extora chạy trên đúng máy đó.
> Cũng không phải `core-mosquitto` — tên ấy chỉ dùng được từ bên trong HA.

---

## 2. Cài panel

### Cách 1 — HACS (khuyên dùng)

HACS → ⋮ → **Custom repositories** → thêm `l3th2nh/ha-theo-gia-shopee`, loại
**Integration** → **Add** → tìm *Theo giá Shopee* → **Download** → khởi động lại HA.

### Cách 2 — chép tay

Chép `custom_components/theo_gia_shopee/` vào `/config/custom_components/` rồi
khởi động lại HA.

Sau đó — **bước này hay bị quên**: **Settings → Devices & Services →
Add Integration** → tìm **Theo giá Shopee** → Add.

HACS chỉ *tải mã nguồn về*. Panel chỉ mọc khi có một **config entry**, tức là
sau khi bấm *Add Integration*. Tải xong mà không thêm thì sidebar vẫn trống và
không có lỗi nào cả — đúng biểu hiện "không thấy gì".

Xong rồi thì panel **Theo giá Shopee** hiện trên sidebar, địa chỉ **`/shopee`**
(gõ thẳng vào trình duyệt cũng được).

### Panel không hiện — dò theo thứ tự

| Kiểm | Nếu không đạt |
|---|---|
| **Settings → Devices & Services** có thẻ *Theo giá Shopee* chưa | Chưa → bấm **Add Integration** (bước ở trên) |
| Tìm trong Add Integration mà không thấy tên | HA chưa nạp mã: kiểm `/config/custom_components/theo_gia_shopee/manifest.json` có tồn tại không, rồi **khởi động lại HA** (không phải *Reload*) |
| **Settings → System → Logs** có dòng `Đã đăng ký panel 'Theo giá Shopee' tại /shopee` | Có mà sidebar vẫn trống → **Ctrl+Shift+R** (cache trình duyệt), hoặc kiểm mục có bị ẩn trong *hồ sơ người dùng → Sidebar* |
| Mở thẳng `http://<ip-ha>:8123/shopee` | Ra trang → chỉ là sidebar bị ẩn. Lỗi 404 → tích hợp chưa nạp |

---

## 3. Thông báo về điện thoại

**Không cần viết automation.** Chọn một lần trong giao diện:

**Settings → Devices & Services → Theo giá Shopee → Configure**
- ✅ **Bật thông báo**
- **Gửi qua dịch vụ**: chọn `mobile_app_<điện-thoại-của-bạn>`

Xong. Giá đổi đủ ngưỡng là điện thoại rung, bấm vào là mở thẳng trang Shopee.

### Ngưỡng đặt ở đâu

**Ở Extora, theo từng sản phẩm** — ô *Báo khi đổi ≥ __%* và *chỉ báo khi giảm*.
Bày lại ở HA là hai chỗ cùng nói về một việc, và sớm muộn hai chỗ ấy sẽ nói khác
nhau.

Cách chia việc: **Extora quyết ĐÁNG BÁO hay không** (nó biết giá cũ, giá mới, và
ngưỡng của từng món), rồi phát một bản tin lên `extora/shopee/bao`. **Home
Assistant lo BÁO CHO AI.**

Bản tin cảnh báo **không retain** — nó là một *sự kiện*, không phải trạng thái.
Retain thì HA khởi động lại sẽ rung điện thoại vì một lần giảm giá tuần trước.

### Muốn tự viết automation thay vì dùng tuỳ chọn trên

Tắt *Bật thông báo* rồi bám vào thực thể như bình thường:

```yaml
automation:
  - alias: "Shopee — giá giảm mạnh"
    trigger:
      - platform: numeric_state
        entity_id: sensor.combo_xit_khu_mui_thay_doi   # đổi cho đúng thực thể của bạn
        below: -10                                      # giảm hơn 10%
    action:
      - service: notify.mobile_app_dien_thoai_cua_toi
        data:
          title: "Giá vừa giảm"
          message: >-
            {{ state_attr('sensor.combo_xit_khu_mui_gia', 'ten') }} còn
            {{ state_attr('sensor.combo_xit_khu_mui_gia', 'gia') }} ₫
          data:
            url: "{{ state_attr('sensor.combo_xit_khu_mui_gia', 'link') }}"
```

`thay_doi` **mang dấu âm khi giảm**, nên điều kiện viết được thành một dòng
`below: -10` thay vì phải ghép phần trăm với hướng.

Hoặc bắt thẳng bản tin cảnh báo — nó mang sẵn câu chữ tiếng Việt:

```yaml
    trigger:
      - platform: mqtt
        topic: extora/shopee/bao
    action:
      - service: notify.mobile_app_dien_thoai_cua_toi
        data:
          title: "{{ trigger.payload_json.tieu_de }}"
          message: "{{ trigger.payload_json.noi_dung }}"
```

Trường trong bản tin: `tieu_de` · `noi_dung` · `ten` · `link` · `gia` ·
`gia_truoc` · `gia_goc` · `thap_nhat` · `dang_o_day` · `huong` · `phan_tram` ·
`lech` · `luc`.

---

## 4. Mỗi sản phẩm sang HA thành gì

Một **thiết bị**, bốn thực thể:

| Thực thể | Ý nghĩa |
|---|---|
| `sensor.<tên>_gia` | giá hiện tại (₫) — mang toàn bộ thuộc tính |
| `sensor.<tên>_thap_nhat` | thấp nhất từng ghi được |
| `sensor.<tên>_thay_doi` | % lệch so với lượt trước — **âm khi giảm** |
| `binary_sensor.<tên>_con_hang` | còn hàng / hết hàng |

Thuộc tính trên `_gia`: `ten` · `link` · `gia` · `gia_goc` · `thap_nhat` ·
`cao_nhat` · `trung_binh` · `thay_doi` · `huong` · `dang_o_day` · `con_hang` ·
`kho` · `da_ban` · `luc` · `nguon`.

Panel nhận ra thực thể của mình bằng `nguon === "extora-shopee"` — lọc theo tên
thực thể là mời một sensor tình cờ trùng tên vào bảng.

---

## 5. Khi bảng trống

| Hiện tượng | Nhìn vào đâu |
|---|---|
| Panel nói "Chưa thấy sản phẩm nào" | Extora → ⚙ Thiết lập → **Thử kết nối**. Chưa được thì sai địa chỉ/tài khoản |
| Kết nối được nhưng vẫn trống | Chưa bấm **Đồng bộ lại toàn bộ**, hoặc chưa sản phẩm nào có mốc giá (bấm **Đọc ngay**) |
| Thực thể có nhưng `unavailable` | Extora đang tắt. Đó là **cố ý** — LWT báo `offline` để một con số cũ không giả làm số mới |
| Cột "Đọc lúc" ghi *cũ* | Vòng đọc theo nhịp chưa chạy; hiện phải bấm **Đọc ngay** trong Extora |
