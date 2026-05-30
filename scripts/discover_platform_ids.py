"""
为 seed_books.json 里的每本书发现各平台的 book ID。

支持的平台：
  - fanqie   → fanqienovel.com/page/{numeric_id}
  - weread   → weread.qq.com/web/bookDetail/{hash}
  - qqreader → book.qq.com 系列（包括 yuewen.com）

策略：对每本书，依次试 DuckDuckGo / 百度 / Bing 站内搜索
  site:fanqienovel.com 书名 作者

特性：
  - 断点续传：脚本运行中随时 Ctrl+C，已发现的 ID 已经存盘
  - 跳过已有 ID 的书：第二次运行只补缺
  - 礼貌延迟：每本书之间睡 4-8 秒随机
  - 多搜索引擎 fallback：第一个失败试下一个

用法：
  python3 scripts/discover_platform_ids.py            # 三平台都搞
  python3 scripts/discover_platform_ids.py fanqie     # 只搞 fanqie
"""

from __future__ import annotations

import json
import random
import re
import sys
import time
import urllib.parse
from pathlib import Path
from typing import Optional

import httpx

SEED_PATH = Path(__file__).parent.parent / "backend" / "app" / "data" / "seed_books.json"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
]

PLATFORM_CONFIG = {
    "fanqie": {
        "domain": "fanqienovel.com",
        "id_pattern": r"fanqienovel\.com/page/(\d+)",
    },
    "weread": {
        "domain": "weread.qq.com",
        "id_pattern": r"weread\.qq\.com/web/bookDetail/([a-zA-Z0-9_]+)",
    },
    "qqreader": {
        "domain": "book.qq.com OR site:yuewen.com",
        "id_pattern": r"(?:book\.qq\.com|yuewen\.com)/[^\s\"'<>]*?/(\d{6,})",
    },
}

# ---------- 搜索引擎 ----------

def search_ddg(query: str, ua: str) -> Optional[str]:
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    try:
        with httpx.Client(headers={"User-Agent": ua}, timeout=20, follow_redirects=True) as c:
            r = c.get(url)
            if r.status_code == 200:
                return r.text
    except Exception:
        pass
    return None


def search_baidu_mobile(query: str, ua: str) -> Optional[str]:
    url = f"https://m.baidu.com/s?word={urllib.parse.quote(query)}"
    try:
        with httpx.Client(headers={"User-Agent": ua}, timeout=20, follow_redirects=True) as c:
            r = c.get(url)
            if r.status_code == 200 and len(r.text) > 5000:  # 反爬页 < 2KB
                return r.text
    except Exception:
        pass
    return None


def search_bing(query: str, ua: str) -> Optional[str]:
    url = f"https://www.bing.com/search?q={urllib.parse.quote(query)}"
    try:
        with httpx.Client(headers={"User-Agent": ua}, timeout=20, follow_redirects=True) as c:
            r = c.get(url)
            if r.status_code == 200:
                return r.text
    except Exception:
        pass
    return None


SEARCH_ENGINES = [search_ddg, search_baidu_mobile, search_bing]


# ---------- 主流程 ----------

def discover_id(title: str, author: str, platform: str) -> Optional[str]:
    cfg = PLATFORM_CONFIG[platform]
    query = f"site:{cfg['domain']} {title} {author}"
    pattern = re.compile(cfg["id_pattern"])

    # 随机搜索引擎顺序
    engines = SEARCH_ENGINES.copy()
    random.shuffle(engines)

    for engine in engines:
        ua = random.choice(USER_AGENTS)
        html = engine(query, ua)
        if not html:
            continue
        matches = pattern.findall(html)
        if matches:
            return matches[0]
        time.sleep(random.uniform(1, 2))
    return None


def main(target_platforms: list[str]):
    data = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    books = data["books"]
    total = len(books)
    print(f"📚 总共 {total} 本书；目标平台：{', '.join(target_platforms)}")
    print()

    stats = {p: {"found": 0, "skipped": 0, "failed": 0} for p in target_platforms}

    for i, book in enumerate(books, 1):
        title = book["title"]
        author = book.get("author", "")
        platform_ids = book.setdefault("platform_ids", {})

        line = [f"[{i:3}/{total}] {title[:18]:18} {author[:8]:8}"]

        for platform in target_platforms:
            if platform in platform_ids and platform_ids[platform]:
                line.append(f"{platform}=已有")
                stats[platform]["skipped"] += 1
                continue

            try:
                found = discover_id(title, author, platform)
                if found:
                    platform_ids[platform] = found
                    line.append(f"{platform}={found[:10]}…")
                    stats[platform]["found"] += 1
                else:
                    line.append(f"{platform}=×")
                    stats[platform]["failed"] += 1
            except Exception as e:
                line.append(f"{platform}=ERR")
                stats[platform]["failed"] += 1

            time.sleep(random.uniform(2, 4))  # 平台之间也间隔一下

        print("  ".join(line))

        # 每本书都立刻存盘（断点续传）
        SEED_PATH.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        # 不同书之间长间隔
        time.sleep(random.uniform(4, 8))

    print()
    print("=== 完成 ===")
    for p in target_platforms:
        s = stats[p]
        print(f"{p:10} 找到 {s['found']:3}  跳过 {s['skipped']:3}  失败 {s['failed']:3}")


if __name__ == "__main__":
    targets = sys.argv[1:] or ["fanqie", "weread", "qqreader"]
    invalid = [p for p in targets if p not in PLATFORM_CONFIG]
    if invalid:
        print(f"未知平台: {invalid}")
        print(f"可用平台: {list(PLATFORM_CONFIG.keys())}")
        sys.exit(1)
    main(targets)
