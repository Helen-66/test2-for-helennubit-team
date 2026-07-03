"""百度接口连通性与结果校验的基础 API 测试。"""

import pytest
import requests

BAIDU_HOME = "https://www.baidu.com/"
BAIDU_SUGGEST = "https://suggestion.baidu.com/su"

TIMEOUT = 20


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        )
    })
    yield s
    s.close()


def test_baidu_home_connectivity(session):
    """百度首页连通性：应返回 200 且响应时间合理。"""
    resp = session.get(BAIDU_HOME, timeout=TIMEOUT)
    assert resp.status_code == 200, f"期望 200，实际 {resp.status_code}"
    assert resp.elapsed.total_seconds() < TIMEOUT


def test_baidu_home_content(session):
    """百度首页内容校验：应包含百度标识。"""
    resp = session.get(BAIDU_HOME, timeout=TIMEOUT)
    resp.encoding = resp.apparent_encoding or "utf-8"
    text = resp.text
    assert "baidu" in text.lower(), "响应内容中未找到 baidu 关键字"
    assert "<title>" in text.lower(), "响应内容中未找到 title 标签"


def test_baidu_home_headers(session):
    """百度首页响应头校验：应为 HTML 内容类型。"""
    resp = session.get(BAIDU_HOME, timeout=TIMEOUT)
    content_type = resp.headers.get("Content-Type", "")
    assert "text/html" in content_type.lower(), (
        f"Content-Type 不符合预期：{content_type}"
    )


@pytest.mark.parametrize("keyword", ["python", "pytest", "百度"])
def test_baidu_suggest_api(session, keyword):
    """百度搜索建议接口：验证连通性、状态码和结果结构。"""
    params = {"wd": keyword, "action": "opensearch", "ie": "utf-8"}
    resp = session.get(BAIDU_SUGGEST, params=params, timeout=TIMEOUT)

    assert resp.status_code == 200, f"期望 200，实际 {resp.status_code}"

    resp.encoding = "utf-8"
    data = resp.json()

    assert isinstance(data, list), f"响应应为列表结构，实际为 {type(data).__name__}"
    assert len(data) >= 2, f"响应元素数不足，实际长度 {len(data)}"
    assert data[0] == keyword, f"首个元素应为查询词 {keyword}，实际 {data[0]}"
    assert isinstance(data[1], list), "第二个元素应为建议词列表"


def test_baidu_invalid_path(session):
    """百度错误路径：应返回非 2xx 状态码。"""
    resp = session.get(f"{BAIDU_HOME}/definitely-not-exists-xyz-123", timeout=TIMEOUT)
    assert resp.status_code >= 400, (
        f"错误路径应返回 4xx/5xx，实际 {resp.status_code}"
    )
