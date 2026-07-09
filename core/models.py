"""统一的 HTTP 请求 / 响应数据模型。"""

from __future__ import annotations

import json as _json
from dataclasses import dataclass, field
from typing import Any, Dict, Mapping, Optional


@dataclass
class HttpRequest:
    """统一的 HTTP 请求对象。

    封装一次 HTTP 调用所需的全部信息，供同步 / 异步客户端复用。
    """

    method: str
    url: str
    params: Optional[Dict[str, Any]] = None
    headers: Optional[Dict[str, str]] = None
    data: Optional[Any] = None
    json: Optional[Any] = None
    timeout: Optional[float] = None

    def __post_init__(self) -> None:
        if not self.method:
            raise ValueError("method 不能为空")
        self.method = self.method.upper()
        if not self.url:
            raise ValueError("url 不能为空")


@dataclass
class HttpResponse:
    """统一的 HTTP 响应对象。

    对 requests / httpx 的原始响应做统一封装，屏蔽底层差异。
    """

    status_code: int
    headers: Dict[str, str] = field(default_factory=dict)
    text: str = ""
    content: bytes = b""
    url: str = ""
    elapsed: float = 0.0
    request: Optional[HttpRequest] = None

    @property
    def ok(self) -> bool:
        """状态码在 [200, 400) 之间视为成功。"""
        return 200 <= self.status_code < 400

    def json(self, **kwargs: Any) -> Any:
        """将响应体解析为 JSON。"""
        return _json.loads(self.text, **kwargs)

    @classmethod
    def from_requests(cls, resp: Any, request: Optional[HttpRequest] = None) -> "HttpResponse":
        """从 requests 的 Response 构建统一响应。"""
        return cls(
            status_code=resp.status_code,
            headers=dict(resp.headers),
            text=resp.text,
            content=resp.content,
            url=str(resp.url),
            elapsed=resp.elapsed.total_seconds() if resp.elapsed is not None else 0.0,
            request=request,
        )

    @classmethod
    def from_httpx(cls, resp: Any, request: Optional[HttpRequest] = None) -> "HttpResponse":
        """从 httpx 的 Response 构建统一响应。"""
        return cls(
            status_code=resp.status_code,
            headers=dict(resp.headers),
            text=resp.text,
            content=resp.content,
            url=str(resp.url),
            elapsed=resp.elapsed.total_seconds() if resp.elapsed is not None else 0.0,
            request=request,
        )


def merge_headers(
    base: Optional[Mapping[str, str]],
    extra: Optional[Mapping[str, str]],
) -> Dict[str, str]:
    """合并两组 headers，extra 覆盖 base。"""
    merged: Dict[str, str] = {}
    if base:
        merged.update(base)
    if extra:
        merged.update(extra)
    return merged
