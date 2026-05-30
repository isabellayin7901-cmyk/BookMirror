"""
发布加固：/api/* 的轻量鉴权 + 按 IP 限流。
无第三方依赖（不引入 slowapi），用进程内滑动窗口即可挡住误用 / 刷量。
注意：内存计数器不跨 worker 共享；小型单 worker 部署足够。
若将来横向扩展，把 _HITS 换成 Redis 即可。
"""
import time
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse

from .config import settings

# ip -> 最近请求时间戳队列
_HITS: dict[str, deque[float]] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    # 经过 Render/Railway/Nginx 等反代时，真实 IP 在 X-Forwarded-For 第一段
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rate_limited(ip: str) -> bool:
    now = time.time()
    window = settings.rate_limit_window
    q = _HITS[ip]
    while q and now - q[0] > window:
        q.popleft()
    if len(q) >= settings.rate_limit_max:
        return True
    q.append(now)
    return False


async def api_guard(request: Request, call_next):
    """只拦 /api/*；放行预检与非 API 路由。"""
    path = request.url.path
    if not path.startswith("/api") or request.method == "OPTIONS":
        return await call_next(request)

    ip = _client_ip(request)
    if _rate_limited(ip):
        return JSONResponse(
            status_code=429,
            content={"detail": "请求过于频繁，请稍后再试 / Too many requests."},
        )

    if settings.app_token:
        token = request.headers.get("x-app-token", "")
        if token != settings.app_token:
            return JSONResponse(
                status_code=401,
                content={"detail": "无效的访问令牌 / Invalid app token."},
            )

    return await call_next(request)
