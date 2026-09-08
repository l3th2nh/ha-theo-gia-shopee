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
PANEL_VER = "1"  # tăng mỗi lần sửa panel để chống cache trình duyệt
PANEL_URL_V = f"{PANEL_URL}?v={PANEL_VER}"
PANEL_PATH = "theo-gia-shopee"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    panel_js = os.path.join(os.path.dirname(__file__), "panel.js")
    data = hass.data.setdefault(DOMAIN, {})

    # Chỉ đăng ký MỘT lần mỗi phiên HA — gọi lại lúc reload sẽ ném lỗi.
    if not data.get("static_registered"):
        data["static_registered"] = True
        await hass.http.async_register_static_paths(
            [StaticPathConfig(PANEL_URL, panel_js, False)]
        )

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
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    # Gỡ panel khỏi sidebar; giữ static path vì HA không cho bỏ đăng ký, và
    # đăng ký lại đúng đường dẫn ấy ở lần bật sau vẫn chạy.
    if PANEL_PATH in hass.data.get(frontend.DATA_PANELS, {}):
        frontend.async_remove_panel(hass, PANEL_PATH)
    return True
