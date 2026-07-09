"""HttpRequest / HttpResponse 模型单元测试。"""

import pytest

from core.models import HttpRequest, HttpResponse, merge_headers


def test_request_normalizes_method():
    req = HttpRequest(method="get", url="http://x")
    assert req.method == "GET"


def test_request_requires_method_and_url():
    with pytest.raises(ValueError):
        HttpRequest(method="", url="http://x")
    with pytest.raises(ValueError):
        HttpRequest(method="GET", url="")


def test_response_ok_property():
    assert HttpResponse(status_code=200).ok is True
    assert HttpResponse(status_code=204).ok is True
    assert HttpResponse(status_code=404).ok is False
    assert HttpResponse(status_code=500).ok is False


def test_response_json_parsing():
    resp = HttpResponse(status_code=200, text='{"a": 1}')
    assert resp.json() == {"a": 1}


def test_merge_headers_extra_overrides_base():
    merged = merge_headers({"A": "1", "B": "2"}, {"B": "3", "C": "4"})
    assert merged == {"A": "1", "B": "3", "C": "4"}


def test_merge_headers_handles_none():
    assert merge_headers(None, None) == {}
    assert merge_headers({"A": "1"}, None) == {"A": "1"}
    assert merge_headers(None, {"A": "1"}) == {"A": "1"}
