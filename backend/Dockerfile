## 3.11 而非更新版本：pyswisseph 官方预编译 wheel 最高只支持 cp311。
# 在 3.14-slim 上现场编译会产出缺 libstdc++ 符号(_ZSt7nothrow)的 .so，
# 构建能过、启动即崩（ImportError），所以固定用 3.11 直接装 wheel。
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

# 云平台会注入 $PORT；本地默认 8000
ENV PORT=8000
EXPOSE 8000

# shell 形式以便展开 $PORT
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
