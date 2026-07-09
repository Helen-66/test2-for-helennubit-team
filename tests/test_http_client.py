"""同步 HttpClient 单元测试（使用 mock 避免真实网络请求）。"""

from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest

from core.http_client import HttpClient
from core.models import HttpResponse


def _fake_raw_response(status_code=200, text="ok"):
    raw = MagicMock()
    raw.status_code = status_code
    raw.headers = {"Content-Type": "application/json"}
    raw.text = text
    raw.content = text.encode()
    raw.url = "http://example.com/api"
    raw.elapsed = timedelta(seconds=0.01)
    return raw


@pytest.fixture
def client():
    with patch("requests.Session") as session_cls:
        session = session_cls.return_value
        session.request.return_value = _fake_raw_response()
        c = HttpClient(base_url="http://example.com", headers={"X-Base": "1"})
        c._mock_session = session
        yield c


@pytest.mark.parametrize(
    "method", ["get", "post", "put", "delete", "patch", "head", "options"]
)
def test_all_common_methods(client, method):
    resp = getattr(client, method)("/api")
    assert isinstance(resp, HttpResponse)
    assert resp.status_code == 200
    sent_method = client._mock_session.request.call_args.kwargs["method"]
    assert sent_method == method.upper()


def test_base_url_joining(client):
    client.get("/users")
    url = client._mock_session.request.call_args.kwargs["url"]
    assert url == "http://example.com/users"


def test_absolute_url_not_prefixed(client):
    client.get("http://other.com/x")
    url = client._mock_session.request.call_args.kwargs["url"]
    assert url == "http://other.com/x"


def test_custom_headers_params_body(client):
    client.post(
        "/create",
        headers={"X-Extra": "9"},
        params={"q": "1"},
        json={"name": "cat"},
    )
    kwargs = client._mock_session.request.call_args.kwargs
    assert kwargs["params"] == {"q": "1"}
    assert kwargs["json"] == {"name": "cat"}
    # 默认 header 与自定义 header 合并
    assert kwargs["headers"]["X-Base"] == "1"
    assert kwargs["headers"]["X-Extra"] == "9"


def test_retry_on_server_error():
    with patch("requests.Session") as session_cls, patch(
        "core.http_client.time.sleep"
    ) as sleep:
        session = session_cls.return_value
        session.request.side_effect = [
            _fake_raw_response(status_code=503),
            _fake_raw_response(status_code=200),
        ]
        c = HttpClient(max_retries=2, backoff_factor=0)
        resp = c.get("http://example.com/x")
        assert resp.status_code == 200
        assert session.request.call_count == 2
        assert sleep.called


def test_retry_exhausted_returns_last_response():
    with patch("requests.Session") as session_cls, patch("core.http_client.time.sleep"):
        session = session_cls.return_value
        session.request.return_value = _fake_raw_response(status_code=500)
        c = HttpClient(max_retries=2, backoff_factor=0)
        resp = c.get("http://example.com/x")
        assert resp.status_code == 500
        assert session.request.call_count == 3


def test_context_manager_closes_session():
    with patch("requests.Session") as session_cls:
        session = session_cls.return_value
        session.request.return_value = _fake_raw_response()
        with HttpClient() as c:
            c.get("http://example.com/x")
        session.close.assert_called_once()
