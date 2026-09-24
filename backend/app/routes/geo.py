"""按请求 IP 判断用户所在国家/地区，用于决定展示哪些购书/阅读平台。

只读 CDN 在边缘已经算好的国家头（Render 前面是 Cloudflare，头名 CF-IPCountry），
不把用户 IP 发给任何第三方查询服务。拿不到时返回 country=None，
前端会退回按手机系统地区推断，并允许用户手动更正。
"""

from fastapi import APIRouter, Request

router = APIRouter()

# Cloudflare 的特殊值：XX = 未知，T1 = Tor 出口
_UNKNOWN = {"", "XX", "T1"}


@router.get("/geo")
def geo(request: Request):
    cc = (request.headers.get("cf-ipcountry") or "").strip().upper()
    if len(cc) == 2 and cc.isalpha() and cc not in _UNKNOWN:
        return {"country": cc, "source": "ip"}
    return {"country": None, "source": "unknown"}
