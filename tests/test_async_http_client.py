"""异步 AsyncHttpClient 单元测试（使用 mock 避免真实网络请求）。"""

import asyncio
from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.http_client import AsyncHttpClient
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


@pytest.mark.parametrize(
    "method", ["get", "post", "put", "delete", "patch", "head", "options"]
)
def test_async_all_common_methods(method):
    async def run():
        with patch("httpx.AsyncClient") as client_cls:
            inner = client_cls.return_value
            inner.request = AsyncMock(return_value=_fake_raw_response())
            inner.aclose = AsyncMock()
            async with AsyncHttpClient(base_url="http://example.com") as c:
                resp = await getattr(c, method)("/api")
            assert isinstance(resp, HttpResponse)
            assert resp.status_code == 200
            assert inner.request.call_args.kwargs["method"] == method.upper()
            inner.aclose.assert_awaited_once()

    asyncio.run(run())


def test_async_custom_headers_params_body():
    async def run():
        with patch("httpx.AsyncClient") as client_cls:
            inner = client_cls.return_value
            inner.request = AsyncMock(return_value=_fake_raw_response())
            c = AsyncHttpClient(headers={"X-Base": "1"})
            await c.post(
                "http://example.com/create",
                headers={"X-Extra": "9"},
                params={"q": "1"},
                json={"name": "cat"},
            )
            kwargs = inner.request.call_args.kwargs
            assert kwargs["params"] == {"q": "1"}
            assert kwargs["json"] == {"name": "cat"}
            assert kwargs["headers"]["X-Base"] == "1"
            assert kwargs["headers"]["X-Extra"] == "9"

    asyncio.run(run())


def test_async_retry_on_server_error():
    async def run():
        with patch("httpx.AsyncClient") as client_cls, patch(
            "asyncio.sleep", new=AsyncMock()
        ):
            inner = client_cls.return_value
            inner.request = AsyncMock(
                side_effect=[
                    _fake_raw_response(status_code=502),
                    _fake_raw_response(status_code=200),
                ]
            )
            c = AsyncHttpClient(max_retries=2, backoff_factor=0)
            resp = await c.get("http://example.com/x")
            assert resp.status_code == 200
            assert inner.request.call_count == 2

    asyncio.run(run())
