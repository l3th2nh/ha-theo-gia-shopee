"""Theo giá Shopee — panel liệt kê các sản phẩm Extora đang theo dõi.

Tích hợp này KHÔNG nói chuyện với Extora và KHÔNG gọi ra Internet. Toàn bộ dữ
liệu đã có sẵn trong Home Assistant: ext `io.extora.shopee` đẩy sang bằng MQTT
discovery, HA tự dựng thực thể, và panel chỉ đọc lại những thực thể ấy.

Nhờ vậy nó không cần địa chỉ máy chủ, không cần khoá API, không cần mở cổng —
và vẫn chạy khi Extora đang tắt (giá hiện là giá đọc được lần cuối, HA giữ lại).

Cách nhận ra thực thể của mình: bản tin state có trường `nguon: "extora-shopee"`.
Lọc theo TÊN thực thể là mời một sensor tình cờ trùng tên vào bảng.
"""
import logging
import os

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

DOMAIN = "theo_gia_shopee"
PANEL_URL = "/theo_gia_shopee/panel.js"
PANEL_VER = "2"  # tăng mỗi lần sửa panel để chống cache trình duyệt
PANEL_URL_V = f"{PANEL_URL}?v={PANEL_VER}"
# Đường dẫn NGẮN: /shopee. Gõ tay được, đánh dấu trang được, và đọc ra là hiểu.
PANEL_PATH = "shopee"
# Đường cũ (v1.0.0) — gỡ khỏi sidebar khi nâng cấp, nếu không người dùng thấy
# hai mục trùng nhau cho tới lần khởi động lại kế tiếp.
PANEL_PATH_CU = "theo-gia-shopee"


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
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    # Gỡ panel khỏi sidebar; giữ static path vì HA không cho bỏ đăng ký, và
    # đăng ký lại đúng đường dẫn ấy ở lần bật sau vẫn chạy.
    if PANEL_PATH in hass.data.get(frontend.DATA_PANELS, {}):
        frontend.async_remove_panel(hass, PANEL_PATH)
    return True
