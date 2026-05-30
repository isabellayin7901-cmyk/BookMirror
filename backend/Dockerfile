FROM python:3.14-slim

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
