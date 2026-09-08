"""Config flow tối giản (1 lần bấm) + Options để chọn điện thoại nhận thông báo."""
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector

from . import DOMAIN, KHOA_BAT, KHOA_NOTIFY


def _cac_dich_vu(hass) -> list:
    """Danh sách dịch vụ `notify.*` đang có.

    Đưa `mobile_app_*` lên đầu: gần như lần nào người dùng cũng chọn đúng cái đó,
    còn `persistent_notification` hay `notify` chung thì để phía dưới.
    """
    co = sorted((hass.services.async_services() or {}).get("notify", {}))
    dt = [s for s in co if s.startswith("mobile_app_")]
    return dt + [s for s in co if s not in dt]


class TheoGiaShopeeConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        return self.async_create_entry(title="Theo giá Shopee", data={})

    @staticmethod
    @callback
    def async_get_options_flow(entry):
        return TuyChonFlow(entry)


class TuyChonFlow(config_entries.OptionsFlow):
    """Chọn dịch vụ notify — thứ DUY NHẤT phía Home Assistant cần biết.

    Ngưỡng "đổi bao nhiêu thì báo" và "chỉ báo khi giảm" đặt bên Extora, theo
    TỪNG sản phẩm. Bày lại ở đây là hai chỗ cùng nói về một việc, và sớm muộn
    hai chỗ ấy sẽ nói khác nhau.
    """

    def __init__(self, entry):
        self._entry = entry

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        cu = self._entry.options or {}
        dich_vu = _cac_dich_vu(self.hass)
        if not dich_vu:
            return self.async_abort(reason="khong_co_notify")

        khung = vol.Schema({
            vol.Required(KHOA_BAT, default=cu.get(KHOA_BAT, True)): bool,
            vol.Optional(
                KHOA_NOTIFY,
                default=cu.get(KHOA_NOTIFY, dich_vu[0]),
            ): selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=dich_vu, mode=selector.SelectSelectorMode.DROPDOWN
                )
            ),
        })
        return self.async_show_form(step_id="init", data_schema=khung)
