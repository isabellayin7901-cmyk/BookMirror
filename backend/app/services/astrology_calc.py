"""
精确星盘计算 — 使用 Swiss Ephemeris（pyswisseph）。

Swiss Ephemeris 是专业占星软件用的天体历表，太阳/月亮/上升等位置精度 ≤ 1 角秒。

无需出生地时：可以精确算太阳、月亮（这两个只跟 UT 时间有关）。
有出生地时（提供经纬度）：可以精确算上升星座。
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

import swisseph as swe

# 12 星座中文名（按 0-330° 排序，每 30° 一个星座）
SIGNS_ZH = [
    "白羊座", "金牛座", "双子座", "巨蟹座",
    "狮子座", "处女座", "天秤座", "天蝎座",
    "射手座", "摩羯座", "水瓶座", "双鱼座",
]

ELEMENT_MAP = {
    "白羊座": "火", "狮子座": "火", "射手座": "火",
    "金牛座": "土", "处女座": "土", "摩羯座": "土",
    "双子座": "风", "天秤座": "风", "水瓶座": "风",
    "巨蟹座": "水", "天蝎座": "水", "双鱼座": "水",
}


def _longitude_to_sign(longitude: float) -> str:
    """黄经 0-360° 转星座中文名。每个星座占 30°。"""
    idx = int(longitude // 30) % 12
    return SIGNS_ZH[idx]


def _to_julian_day(year: int, month: int, day: int, hour: int, minute: int, tz_offset_hours: float = 8.0) -> float:
    """本地时间（默认 UTC+8 北京时间）→ UTC → 儒略日。"""
    local = datetime(year, month, day, hour, minute, tzinfo=timezone(timedelta(hours=tz_offset_hours)))
    utc = local.astimezone(timezone.utc)
    # swe.julday 接收 UT 的小时（浮点）
    ut_hour = utc.hour + utc.minute / 60 + utc.second / 3600
    return swe.julday(utc.year, utc.month, utc.day, ut_hour, swe.GREG_CAL)


def compute_chart(year: int, month: int, day: int, hour: int, minute: int, tz_offset_hours: float = 8.0) -> dict:
    """
    精确计算太阳、月亮、水星、金星、火星位置。
    返回所有行星的星座 + 黄经，可用于画星盘。
    """
    jd = _to_julian_day(year, month, day, hour, minute, tz_offset_hours)

    planet_ids = {
        "sun": swe.SUN,
        "moon": swe.MOON,
        "mercury": swe.MERCURY,
        "venus": swe.VENUS,
        "mars": swe.MARS,
        "jupiter": swe.JUPITER,
        "saturn": swe.SATURN,
    }

    out: dict = {}
    for name, pid in planet_ids.items():
        pos, _ = swe.calc_ut(jd, pid)
        longitude = pos[0]
        out[f"{name}_sign"] = _longitude_to_sign(longitude)
        out[f"{name}_longitude"] = round(longitude, 4)

    out["element"] = ELEMENT_MAP[out["sun_sign"]]
    return out


def compute_sun_moon(year: int, month: int, day: int, hour: int, minute: int, tz_offset_hours: float = 8.0) -> dict:
    """旧 API 兼容入口 —— 现在内部用 compute_chart。"""
    chart = compute_chart(year, month, day, hour, minute, tz_offset_hours)
    return {
        "sun_sign": chart["sun_sign"],
        "moon_sign": chart["moon_sign"],
        "element": chart["element"],
        "sun_longitude": chart["sun_longitude"],
        "moon_longitude": chart["moon_longitude"],
    }


def compute_ascendant(
    year: int, month: int, day: int, hour: int, minute: int,
    latitude: float, longitude: float,
    tz_offset_hours: float = 8.0,
) -> Optional[str]:
    """旧 API 兼容入口 —— 只返回上升星座名。"""
    chart = compute_houses(year, month, day, hour, minute, latitude, longitude, tz_offset_hours)
    return chart["ascendant_sign"] if chart else None


def compute_houses(
    year: int, month: int, day: int, hour: int, minute: int,
    latitude: float, longitude: float,
    tz_offset_hours: float = 8.0,
) -> Optional[dict]:
    """
    计算 Placidus 12 宫起始黄经 + 上升点 + 天顶。
    返回 { ascendant_sign, ascendant_longitude, mc_longitude, cusps: [12 个度数] }
    """
    try:
        jd = _to_julian_day(year, month, day, hour, minute, tz_offset_hours)
        cusps, ascmc = swe.houses_ex(jd, latitude, longitude, b"P")  # P = Placidus
        return {
            "ascendant_sign": _longitude_to_sign(ascmc[0]),
            "ascendant_longitude": round(float(ascmc[0]), 4),
            "mc_longitude": round(float(ascmc[1]), 4),
            "cusps": [round(float(c), 4) for c in cusps[:12]],
        }
    except Exception:
        return None
