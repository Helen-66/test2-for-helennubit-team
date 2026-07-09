"""统一的 HTTP 客户端封装。

基于 ``requests`` 提供同步客户端，基于 ``httpx`` 提供异步客户端：

- 支持 GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS 等常见方法
- 统一的请求 / 响应模型（见 :mod:`core.models`）
- 支持 session 会话保持
- 超时、重试的默认配置
- 支持同步与异步两种调用方式
"""

from __future__ import annotations

import time
from typing import Any, Dict, Optional

from .models import HttpRequest, HttpResponse, merge_headers

DEFAULT_TIMEOUT = 30.0
DEFAULT_MAX_RETRIES = 3
DEFAULT_BACKOFF_FACTOR = 0.5
# 触发重试的服务端状态码
RETRY_STATUS_CODES = frozenset({429, 500, 502, 503, 504})
COMMON_METHODS = ("GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS")


class HttpClient:
    """基于 requests 的同步 HTTP 客户端。

    可作为上下文管理器使用，退出时自动关闭底层 session。
    """

    def __init__(
        self,
        base_url: str = "",
        headers: Optional[Dict[str, str]] = None,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        backoff_factor: float = DEFAULT_BACKOFF_FACTOR,
    ) -> None:
        import requests

        self.base_url = base_url.rstrip("/")
        self.default_headers = dict(headers or {})
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self._session = requests.Session()

    def _build_url(self, url: str) -> str:
        if url.startswith(("http://", "https://")):
            return url
        if not self.base_url:
            return url
        return f"{self.base_url}/{url.lstrip('/')}"

    def request(
        self,
        method: str,
        url: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        data: Optional[Any] = None,
        json: Optional[Any] = None,
        timeout: Optional[float] = None,
    ) -> HttpResponse:
        """发送一次 HTTP 请求，返回统一的 :class:`HttpResponse`。"""
        req = HttpRequest(
            method=method,
            url=self._build_url(url),
            params=params,
            headers=merge_headers(self.default_headers, headers),
            data=data,
            json=json,
            timeout=timeout if timeout is not None else self.timeout,
        )
        return self._send_with_retry(req)

    def _send_with_retry(self, req: HttpRequest) -> HttpResponse:
        import requests

        last_exc: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                raw = self._session.request(
                    method=req.method,
                    url=req.url,
                    params=req.params,
                    headers=req.headers,
                    data=req.data,
                    json=req.json,
                    timeout=req.timeout,
                )
                if raw.status_code in RETRY_STATUS_CODES and attempt < self.max_retries:
                    time.sleep(self.backoff_factor * (2 ** attempt))
                    continue
                return HttpResponse.from_requests(raw, req)
            except requests.RequestException as exc:  # 网络类错误可重试
                last_exc = exc
                if attempt < self.max_retries:
                    time.sleep(self.backoff_factor * (2 ** attempt))
                    continue
                raise
        # 理论上不会到达，除非重试全部命中重试状态码
        if last_exc is not None:
            raise last_exc
        raise RuntimeError("请求重试耗尽但未捕获到异常")

    def get(self, url: str, **kwargs: Any) -> HttpResponse:
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs: Any) -> HttpResponse:
        return self.request("POST", url, **kwargs)

    def put(self, url: str, **kwargs: Any) -> HttpResponse:
        return self.request("PUT", url, **kwargs)

    def delete(self, url: str, **kwargs: Any) -> HttpResponse:
        return self.request("DELETE", url, **kwargs)

    def patch(self, url: str, **kwargs: Any) -> HttpResponse:
        return self.request("PATCH", url, **kwargs)

    def head(self, url: str, **kwargs: Any) -> HttpResponse:
        return self.request("HEAD", url, **kwargs)

    def options(self, url: str, **kwargs: Any) -> HttpResponse:
        return self.request("OPTIONS", url, **kwargs)

    def close(self) -> None:
        self._session.close()

    def __enter__(self) -> "HttpClient":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()


class AsyncHttpClient:
    """基于 httpx 的异步 HTTP 客户端。

    可作为异步上下文管理器使用，退出时自动关闭底层连接。
    """

    def __init__(
        self,
        base_url: str = "",
        headers: Optional[Dict[str, str]] = None,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        backoff_factor: float = DEFAULT_BACKOFF_FACTOR,
    ) -> None:
        import httpx

        self.base_url = base_url.rstrip("/")
        self.default_headers = dict(headers or {})
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self._client = httpx.AsyncClient(timeout=timeout)

    def _build_url(self, url: str) -> str:
        if url.startswith(("http://", "https://")):
            return url
        if not self.base_url:
            return url
        return f"{self.base_url}/{url.lstrip('/')}"

    async def request(
        self,
        method: str,
        url: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        data: Optional[Any] = None,
        json: Optional[Any] = None,
        timeout: Optional[float] = None,
    ) -> HttpResponse:
        """异步发送一次 HTTP 请求，返回统一的 :class:`HttpResponse`。"""
        req = HttpRequest(
            method=method,
            url=self._build_url(url),
            params=params,
            headers=merge_headers(self.default_headers, headers),
            data=data,
            json=json,
            timeout=timeout if timeout is not None else self.timeout,
        )
        return await self._send_with_retry(req)

    async def _send_with_retry(self, req: HttpRequest) -> HttpResponse:
        import asyncio

        import httpx

        last_exc: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                raw = await self._client.request(
                    method=req.method,
                    url=req.url,
                    params=req.params,
                    headers=req.headers,
                    data=req.data,
                    json=req.json,
                    timeout=req.timeout,
                )
                if raw.status_code in RETRY_STATUS_CODES and attempt < self.max_retries:
                    await asyncio.sleep(self.backoff_factor * (2 ** attempt))
                    continue
                return HttpResponse.from_httpx(raw, req)
            except httpx.HTTPError as exc:  # 网络类错误可重试
                last_exc = exc
                if attempt < self.max_retries:
                    await asyncio.sleep(self.backoff_factor * (2 ** attempt))
                    continue
                raise
        if last_exc is not None:
            raise last_exc
        raise RuntimeError("请求重试耗尽但未捕获到异常")

    async def get(self, url: str, **kwargs: Any) -> HttpResponse:
        return await self.request("GET", url, **kwargs)

    async def post(self, url: str, **kwargs: Any) -> HttpResponse:
        return await self.request("POST", url, **kwargs)

    async def put(self, url: str, **kwargs: Any) -> HttpResponse:
        return await self.request("PUT", url, **kwargs)

    async def delete(self, url: str, **kwargs: Any) -> HttpResponse:
        return await self.request("DELETE", url, **kwargs)

    async def patch(self, url: str, **kwargs: Any) -> HttpResponse:
        return await self.request("PATCH", url, **kwargs)

    async def head(self, url: str, **kwargs: Any) -> HttpResponse:
        return await self.request("HEAD", url, **kwargs)

    async def options(self, url: str, **kwargs: Any) -> HttpResponse:
        return await self.request("OPTIONS", url, **kwargs)

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> "AsyncHttpClient":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.close()
