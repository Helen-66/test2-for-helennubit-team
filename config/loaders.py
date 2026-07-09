"""配置文件加载器：支持 YAML / JSON / .env 格式。"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, Union

import yaml

PathLike = Union[str, os.PathLike]


class ConfigFormatError(ValueError):
    """当配置文件格式无法识别或解析失败时抛出。"""


def load_yaml(path: PathLike) -> Dict[str, Any]:
    """加载 YAML 配置文件，返回字典。"""
    with open(path, "r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
    if not isinstance(data, dict):
        raise ConfigFormatError(f"YAML 配置根节点必须是映射: {path}")
    return data


def load_json(path: PathLike) -> Dict[str, Any]:
    """加载 JSON 配置文件，返回字典。"""
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict):
        raise ConfigFormatError(f"JSON 配置根节点必须是对象: {path}")
    return data


def load_env(path: PathLike) -> Dict[str, Any]:
    """加载 .env 文件，返回字典。

    支持 ``KEY=VALUE`` 语法、``#`` 注释、可选的 ``export`` 前缀，
    以及单/双引号包裹的值。
    """
    result: Dict[str, Any] = {}
    with open(path, "r", encoding="utf-8") as fh:
        for raw_line in fh:
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[len("export "):].strip()
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                value = value[1:-1]
            result[key] = value
    return result


_LOADERS = {
    ".yaml": load_yaml,
    ".yml": load_yaml,
    ".json": load_json,
    ".env": load_env,
}


def load_file(path: PathLike) -> Dict[str, Any]:
    """根据文件扩展名自动选择加载器。

    ``.env`` 文件通过文件名（而非后缀）识别，例如 ``config.env`` 或 ``.env``。
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"配置文件不存在: {path}")

    suffix = p.suffix.lower()
    if p.name == ".env" or suffix == ".env":
        return load_env(p)
    loader = _LOADERS.get(suffix)
    if loader is None:
        raise ConfigFormatError(f"不支持的配置文件格式: {p.suffix} ({path})")
    return loader(p)
