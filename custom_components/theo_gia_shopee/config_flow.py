"""Config flow tối giản (1 lần bấm là xong) — panel không cần tham số nào."""
from homeassistant import config_entries

from . import DOMAIN


class TheoGiaShopeeConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        return self.async_create_entry(title="Theo giá Shopee", data={})
