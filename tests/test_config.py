"""配置管理系统测试。"""

import json

import pytest

from config import (
    Config,
    ConfigManager,
    Secret,
    is_sensitive_key,
    load_config,
    load_file,
    mask_config,
)
from config.loaders import ConfigFormatError, load_env


# --------------------------- 加载器 ---------------------------

def test_load_yaml(tmp_path):
    p = tmp_path / "c.yaml"
    p.write_text("base_url: http://x\ntimeout: 5\n", encoding="utf-8")
    data = load_file(p)
    assert data == {"base_url": "http://x", "timeout": 5}


def test_load_json(tmp_path):
    p = tmp_path / "c.json"
    p.write_text(json.dumps({"base_url": "http://x"}), encoding="utf-8")
    assert load_file(p) == {"base_url": "http://x"}


def test_load_env_syntax(tmp_path):
    p = tmp_path / "sample.env"
    p.write_text(
        "# comment\n"
        "export BASE_URL=http://x\n"
        'TOKEN="quoted-secret"\n'
        "EMPTY_LINE_BELOW=1\n"
        "\n",
        encoding="utf-8",
    )
    data = load_env(p)
    assert data["BASE_URL"] == "http://x"
    assert data["TOKEN"] == "quoted-secret"
    assert data["EMPTY_LINE_BELOW"] == "1"


def test_dotenv_by_name(tmp_path):
    p = tmp_path / ".env"
    p.write_text("A=1\n", encoding="utf-8")
    assert load_file(p) == {"A": "1"}


def test_unsupported_format(tmp_path):
    p = tmp_path / "c.txt"
    p.write_text("x", encoding="utf-8")
    with pytest.raises(ConfigFormatError):
        load_file(p)


def test_missing_file(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_file(tmp_path / "nope.yaml")


# --------------------------- 优先级 ---------------------------

def test_defaults_only():
    cfg = load_config(environ={})
    assert cfg.get("timeout") == 30
    assert cfg.get("base_url") == "http://localhost"


def test_file_overrides_default(tmp_path):
    p = tmp_path / "c.yaml"
    p.write_text("base_url: http://file\n", encoding="utf-8")
    cfg = load_config(config_file=p, environ={})
    assert cfg.get("base_url") == "http://file"
    assert cfg.get("timeout") == 30  # 默认值保留


def test_cli_overrides_file(tmp_path):
    p = tmp_path / "c.yaml"
    p.write_text("base_url: http://file\n", encoding="utf-8")
    cfg = load_config(config_file=p, cli_overrides={"base_url": "http://cli"}, environ={})
    assert cfg.get("base_url") == "http://cli"


def test_env_overrides_cli(tmp_path):
    p = tmp_path / "c.yaml"
    p.write_text("base_url: http://file\n", encoding="utf-8")
    cfg = load_config(
        config_file=p,
        cli_overrides={"base_url": "http://cli"},
        environ={"APITEST_BASE_URL": "http://env"},
    )
    assert cfg.get("base_url") == "http://env"


def test_env_nested_and_coercion():
    cfg = load_config(
        environ={"APITEST_TIMEOUT": "99", "APITEST_AUTH__TOKEN": "t"},
    )
    assert cfg.get("timeout") == 99
    assert isinstance(cfg.get("timeout"), int)
    assert cfg.get("auth.token") == "t"


def test_environment_level_override(tmp_path):
    p = tmp_path / "c.yaml"
    p.write_text(
        "base_url: http://global\n"
        "timeout: 30\n"
        "environments:\n"
        "  dev:\n"
        "    base_url: http://dev\n",
        encoding="utf-8",
    )
    cfg = load_config(config_file=p, environment="dev", environ={})
    assert cfg.get("base_url") == "http://dev"
    assert cfg.get("timeout") == 30


# --------------------------- 敏感信息 ---------------------------

def test_is_sensitive_key():
    assert is_sensitive_key("auth_token")
    assert is_sensitive_key("API_KEY")
    assert is_sensitive_key("password")
    assert not is_sensitive_key("base_url")


def test_secret_not_leaked_in_repr_str():
    s = Secret("super-secret")
    assert "super-secret" not in repr(s)
    assert "super-secret" not in str(s)
    assert s.reveal() == "super-secret"


def test_mask_config_recursive():
    data = {"base_url": "http://x", "auth": {"token": "abc"}, "api_key": "k"}
    masked = mask_config(data)
    assert masked["base_url"] == "http://x"
    assert masked["auth"]["token"] == "***"
    assert masked["api_key"] == "***"


def test_config_safe_dict_hides_secrets():
    cfg = load_config(environ={"APITEST_AUTH__TOKEN": "leak-me"})
    safe = cfg.safe_dict()
    assert safe["auth"]["token"] == "***"
    assert "leak-me" not in json.dumps(safe)
    # repr 也不应泄露
    assert "leak-me" not in repr(cfg)


def test_config_reveal_returns_plaintext():
    cfg = load_config(environ={"APITEST_AUTH__TOKEN": "plain"})
    assert cfg.get("auth.token") == "plain"
    assert cfg.as_dict(reveal=True)["auth"]["token"] == "plain"


# --------------------------- 访问接口 ---------------------------

def test_dotted_access_and_contains():
    cfg = load_config(environ={})
    assert "base_url" in cfg
    assert "missing" not in cfg
    assert cfg["timeout"] == 30
    with pytest.raises(KeyError):
        cfg["nope"]


def test_manager_custom_defaults():
    mgr = ConfigManager(defaults={"foo": 1})
    cfg = mgr.load(environ={})
    assert isinstance(cfg, Config)
    assert cfg.get("foo") == 1
