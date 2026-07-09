"""敏感信息管理：屏蔽日志/输出中的密钥、token 等。"""

from __future__ import annotations

from typing import Any, Dict, Iterable

MASK = "***"

# 键名中包含以下任一子串（不区分大小写）即视为敏感项。
DEFAULT_SENSITIVE_KEYS = (
    "password",
    "passwd",
    "secret",
    "token",
    "api_key",
    "apikey",
    "access_key",
    "private_key",
    "authorization",
    "auth",
    "credential",
)


class Secret:
    """包装敏感值，避免在日志/repr 中意外泄露真实内容。

    通过 :meth:`reveal` 显式获取原始值。
    """

    __slots__ = ("_value",)

    def __init__(self, value: Any) -> None:
        self._value = value

    def reveal(self) -> Any:
        """返回原始明文值。"""
        return self._value

    def __repr__(self) -> str:  # pragma: no cover - 简单委托
        return f"Secret({MASK})"

    def __str__(self) -> str:
        return MASK

    def __eq__(self, other: object) -> bool:
        if isinstance(other, Secret):
            return self._value == other._value
        return NotImplemented

    def __hash__(self) -> int:
        return hash(self._value)


def is_sensitive_key(key: str, sensitive_keys: Iterable[str] = DEFAULT_SENSITIVE_KEYS) -> bool:
    """判断给定键名是否为敏感项。"""
    lowered = str(key).lower()
    return any(token in lowered for token in sensitive_keys)


def mask_value(value: Any) -> Any:
    """将单个敏感值替换为掩码。"""
    if isinstance(value, Secret):
        return MASK
    return MASK


def mask_config(
    data: Any,
    sensitive_keys: Iterable[str] = DEFAULT_SENSITIVE_KEYS,
) -> Any:
    """递归复制配置结构，对敏感键的值进行掩码处理。

    用于安全地记录/打印配置，返回值不包含任何明文敏感信息。
    """
    if isinstance(data, dict):
        result: Dict[str, Any] = {}
        for key, value in data.items():
            if is_sensitive_key(key, sensitive_keys) and not isinstance(value, (dict, list, tuple)):
                result[key] = MASK
            else:
                result[key] = mask_config(value, sensitive_keys)
        return result
    if isinstance(data, (list, tuple)):
        return type(data)(mask_config(item, sensitive_keys) for item in data)
    if isinstance(data, Secret):
        return MASK
    return data
