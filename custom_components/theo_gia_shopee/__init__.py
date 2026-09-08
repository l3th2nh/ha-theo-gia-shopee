"""Theo giá Shopee — panel bảng giá + đẩy thông báo về điện thoại.

Tích hợp này KHÔNG nói chuyện với Extora và KHÔNG gọi ra Internet. Toàn bộ dữ
liệu đã có sẵn trong Home Assistant: ext `io.extora.shopee` đẩy sang bằng MQTT
discovery, HA tự dựng thực thể, và panel chỉ đọc lại những thực thể ấy.

Nhờ vậy nó không cần địa chỉ máy chủ, không cần khoá API, không cần mở cổng —
và vẫn chạy khi Extora đang tắt (giá hiện là giá đọc được lần cuối, HA giữ lại).

Thông báo: Extora quyết ĐÁNG BÁO hay không (nó là nơi người dùng đặt "báo khi
đổi ≥ X%" và "chỉ báo khi giảm" cho từng món), rồi phát một bản tin lên
`extora/shopee/bao`. Ở đây chỉ lo phần còn lại: báo cho điện thoại nào.
"""
import json
import logging
import os

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

DOMAIN = "theo_gia_shopee"
PANEL_URL = "/theo_gia_shopee/panel.js"
PANEL_VER = "6"  # tăng mỗi lần sửa panel để chống cache trình duyệt
PANEL_URL_V = f"{PANEL_URL}?v={PANEL_VER}"
# Đường dẫn NGẮN: /shopee. Gõ tay được, đánh dấu trang được, và đọc ra là hiểu.
PANEL_PATH = "shopee"
# Đường cũ (v1.0.0) — gỡ khỏi sidebar khi nâng cấp, nếu không người dùng thấy
# hai mục trùng nhau cho tới lần khởi động lại kế tiếp.
PANEL_PATH_CU = "theo-gia-shopee"

TOPIC_BAO = "extora/shopee/bao"
KHOA_NOTIFY = "notify"          # dịch vụ notify đã chọn, vd "mobile_app_iphone"
KHOA_BAT = "bat_thong_bao"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    panel_js = os.path.join(os.path.dirname(__file__), "panel.js")
    data = hass.data.setdefault(DOMAIN, {})

    # Chỉ đăng ký MỘT lần mỗi phiên HA — gọi lại lúc reload sẽ ném lỗi.
    if not data.get("static_registered"):
        data["static_registered"] = True
        await hass.http.async_register_static_paths(
            [StaticPathConfig(PANEL_URL, panel_js, False)]
        )

    if PANEL_PATH_CU in hass.data.get(frontend.DATA_PANELS, {}):
        frontend.async_remove_panel(hass, PANEL_PATH_CU)

    if PANEL_PATH not in hass.data.get(frontend.DATA_PANELS, {}):
        await panel_custom.async_register_panel(
            hass,
            frontend_url_path=PANEL_PATH,
            webcomponent_name="theo-gia-shopee-panel",
            module_url=PANEL_URL_V,
            sidebar_title="Theo giá Shopee",
            sidebar_icon="mdi:tag-search",
            require_admin=False,
            config={},
        )
        # In ra để còn đối chiếu khi panel không hiện: thấy dòng này nghĩa là
        # tích hợp đã nạp và panel đã đăng ký — lúc ấy vấn đề nằm ở cache trình
        # duyệt, không phải ở đây.
        _LOGGER.info("Đã đăng ký panel 'Theo giá Shopee' tại /%s", PANEL_PATH)

    await _dang_ky_bao(hass, entry)
    # Đổi lựa chọn trong Options là nạp lại luôn, đừng bắt khởi động lại HA.
    entry.async_on_unload(entry.add_update_listener(_khi_doi_tuy_chon))
    return True


async def _khi_doi_tuy_chon(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def _dang_ky_bao(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Nghe `extora/shopee/bao` và chuyển tiếp sang dịch vụ notify đã chọn."""
    dich_vu = (entry.options or {}).get(KHOA_NOTIFY) or ""
    if not (entry.options or {}).get(KHOA_BAT, True) or not dich_vu:
        _LOGGER.debug("Chưa chọn dịch vụ thông báo — bỏ qua phần đẩy về điện thoại")
        return

    try:
        from homeassistant.components import mqtt
    except ImportError:  # pragma: no cover
        _LOGGER.warning("Chưa có tích hợp MQTT — không nghe được cảnh báo giá")
        return

    async def _nhan(msg) -> None:
        try:
            d = json.loads(msg.payload)
        except (TypeError, ValueError):
            _LOGGER.warning("Bản tin cảnh báo không phải JSON: %.120s", msg.payload)
            return
        # Câu chữ do Extora dựng sẵn: nó biết `huong: "giam"` nghĩa là gì, còn ở
        # đây thì không. Vẫn có đường lui phòng khi bản tin thiếu trường.
        tieu_de = d.get("tieu_de") or "Giá vừa thay đổi"
        noi_dung = d.get("noi_dung") or str(d.get("gia") or "")
        goi: dict = {"title": tieu_de, "message": noi_dung}
        if d.get("link"):
            # Bấm vào thông báo là mở thẳng trang sản phẩm. "Giá này ở đâu ra"
            # là câu hỏi đầu tiên người ta hỏi lúc 2 giờ sáng.
            goi["data"] = {"url": d["link"], "clickAction": d["link"]}
        try:
            await hass.services.async_call("notify", dich_vu, goi, blocking=False)
        except Exception as e:  # noqa: BLE001 — dịch vụ notify hỏng không được
            # kéo theo cả tích hợp; lần cảnh báo sau vẫn phải chạy.
            _LOGGER.error("Gửi thông báo qua notify.%s hỏng: %s", dich_vu, e)

    try:
        bo = await mqtt.async_subscribe(hass, TOPIC_BAO, _nhan)
    except Exception as e:  # noqa: BLE001
        _LOGGER.warning("Không đăng ký được %s: %s", TOPIC_BAO, e)
        return
    entry.async_on_unload(bo)
    _LOGGER.info("Đang nghe %s → notify.%s", TOPIC_BAO, dich_vu)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    # Gỡ panel khỏi sidebar; giữ static path vì HA không cho bỏ đăng ký, và
    # đăng ký lại đúng đường dẫn ấy ở lần bật sau vẫn chạy.
    if PANEL_PATH in hass.data.get(frontend.DATA_PANELS, {}):
        frontend.async_remove_panel(hass, PANEL_PATH)
    return True
