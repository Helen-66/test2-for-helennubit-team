"""配置管理器：合并多来源配置并按优先级解析。

优先级（从高到低）::

    环境变量 > 命令行参数 > 配置文件 > 默认值

同时支持全局配置与环境级（如 dev / staging / prod）配置分离，
环境级配置会覆盖全局配置。
"""

from __future__ import annotations

import copy
import os
from typing import Any, Dict, Iterable, Mapping, Optional, Union

from .loaders import load_file
from .secrets import DEFAULT_SENSITIVE_KEYS, Secret, is_sensitive_key, mask_config

PathLike = Union[str, os.PathLike]

DEFAULT_CONFIG: Dict[str, Any] = {
    "base_url": "http://localhost",
    "timeout": 30,
    "headers": {},
    "auth": {},
}


def _deep_merge(base: Dict[str, Any], override: Mapping[str, Any]) -> Dict[str, Any]:
    """深度合并两个字典，``override`` 优先，返回新字典。"""
    result = copy.deepcopy(base)
    for key, value in override.items():
        if (
            key in result
            and isinstance(result[key], dict)
            and isinstance(value, Mapping)
        ):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result


def _coerce(value: str) -> Any:
    """将环境变量字符串尽量转换为 bool / int / float。"""
    lowered = value.lower()
    if lowered in ("true", "false"):
        return lowered == "true"
    try:
        return int(value)
    except ValueError:
        pass
    try:
        return float(value)
    except ValueError:
        pass
    return value


def _env_overrides(prefix: str, environ: Mapping[str, str]) -> Dict[str, Any]:
    """从环境变量中提取带前缀的配置覆盖项。

    例如 ``APITEST_BASE_URL=...`` -> ``{"base_url": ...}``；
    使用双下划线表示嵌套：``APITEST_AUTH__TOKEN=x`` -> ``{"auth": {"token": "x"}}``。
    """
    overrides: Dict[str, Any] = {}
    if not prefix:
        return overrides
    norm_prefix = prefix if prefix.endswith("_") else prefix + "_"
    for env_key, env_value in environ.items():
        if not env_key.startswith(norm_prefix):
            continue
        path = env_key[len(norm_prefix):].lower().split("__")
        cursor = overrides
        for part in path[:-1]:
            cursor = cursor.setdefault(part, {})
            if not isinstance(cursor, dict):  # pragma: no cover - 防御性
                break
        else:
            cursor[path[-1]] = _coerce(env_value)
    return overrides


def _wrap_secrets(
    data: Any,
    sensitive_keys: Iterable[str],
) -> Any:
    """递归地将敏感键的值包装为 :class:`Secret`。"""
    if isinstance(data, dict):
        result: Dict[str, Any] = {}
        for key, value in data.items():
            if is_sensitive_key(key, sensitive_keys) and not isinstance(value, (dict, list)):
                result[key] = value if isinstance(value, Secret) else Secret(value)
            else:
                result[key] = _wrap_secrets(value, sensitive_keys)
        return result
    if isinstance(data, list):
        return [_wrap_secrets(item, sensitive_keys) for item in data]
    return data


class Config:
    """已解析的不可变配置视图，支持点号路径访问与安全序列化。"""

    def __init__(self, data: Dict[str, Any], sensitive_keys: Iterable[str]) -> None:
        self._data = data
        self._sensitive_keys = tuple(sensitive_keys)

    def get(self, path: str, default: Any = None) -> Any:
        """按点号路径读取配置，如 ``config.get("auth.token")``。

        若命中 :class:`Secret`，返回其明文值。
        """
        cursor: Any = self._data
        for part in path.split("."):
            if isinstance(cursor, dict) and part in cursor:
                cursor = cursor[part]
            else:
                return default
        if isinstance(cursor, Secret):
            return cursor.reveal()
        return cursor

    def __getitem__(self, path: str) -> Any:
        sentinel = object()
        value = self.get(path, sentinel)
        if value is sentinel:
            raise KeyError(path)
        return value

    def __contains__(self, path: str) -> bool:
        sentinel = object()
        return self.get(path, sentinel) is not sentinel

    def as_dict(self, reveal: bool = False) -> Dict[str, Any]:
        """返回配置字典。

        默认对敏感项掩码；``reveal=True`` 时返回明文（谨慎使用）。
        """
        if reveal:
            return _reveal(copy.deepcopy(self._data))
        return mask_config(self._data, self._sensitive_keys)

    def safe_dict(self) -> Dict[str, Any]:
        """等价于 ``as_dict(reveal=False)``，用于日志输出。"""
        return self.as_dict(reveal=False)

    def __repr__(self) -> str:
        return f"Config({self.safe_dict()!r})"


def _reveal(data: Any) -> Any:
    if isinstance(data, dict):
        return {k: _reveal(v) for k, v in data.items()}
    if isinstance(data, list):
        return [_reveal(v) for v in data]
    if isinstance(data, Secret):
        return data.reveal()
    return data


class ConfigManager:
    """按优先级组合默认值、配置文件、命令行参数与环境变量。"""

    def __init__(
        self,
        defaults: Optional[Mapping[str, Any]] = None,
        env_prefix: str = "APITEST",
        sensitive_keys: Iterable[str] = DEFAULT_SENSITIVE_KEYS,
    ) -> None:
        self._defaults = dict(defaults) if defaults is not None else copy.deepcopy(DEFAULT_CONFIG)
        self._env_prefix = env_prefix
        self._sensitive_keys = tuple(sensitive_keys)

    def load(
        self,
        config_file: Optional[PathLike] = None,
        environment: Optional[str] = None,
        cli_overrides: Optional[Mapping[str, Any]] = None,
        environ: Optional[Mapping[str, str]] = None,
    ) -> Config:
        """解析配置。

        参数
        ----
        config_file:
            配置文件路径（YAML / JSON / .env）。
        environment:
            环境名称，用于选取文件中 ``environments.<name>`` 子树，
            该子树会覆盖全局配置。
        cli_overrides:
            命令行参数覆盖项。
        environ:
            环境变量映射，默认使用 ``os.environ``。
        """
        environ = os.environ if environ is None else environ

        merged: Dict[str, Any] = copy.deepcopy(self._defaults)

        if config_file is not None:
            file_data = load_file(config_file)
            environments = file_data.pop("environments", {})
            merged = _deep_merge(merged, file_data)
            if environment and isinstance(environments, dict) and environment in environments:
                merged = _deep_merge(merged, environments[environment] or {})

        if cli_overrides:
            merged = _deep_merge(merged, cli_overrides)

        env_overrides = _env_overrides(self._env_prefix, environ)
        if env_overrides:
            merged = _deep_merge(merged, env_overrides)

        wrapped = _wrap_secrets(merged, self._sensitive_keys)
        return Config(wrapped, self._sensitive_keys)


def load_config(
    config_file: Optional[PathLike] = None,
    environment: Optional[str] = None,
    cli_overrides: Optional[Mapping[str, Any]] = None,
    defaults: Optional[Mapping[str, Any]] = None,
    env_prefix: str = "APITEST",
    environ: Optional[Mapping[str, str]] = None,
) -> Config:
    """便捷函数：一次性构建并解析配置。"""
    manager = ConfigManager(defaults=defaults, env_prefix=env_prefix)
    return manager.load(
        config_file=config_file,
        environment=environment,
        cli_overrides=cli_overrides,
        environ=environ,
    )
