from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.security import api_guard
from app.routes import recommend, feedback, mbti, astrology, books, synthesis, book_fit, mirror, auth, reviews, reading

app = FastAPI(
    title="BookMirror API",
    description="Personality-based reading recommendation backend",
    version="0.1.0",
)

# /api/* 鉴权 + 限流（在 CORS 之前注册 → 执行顺序在 CORS 之后，预检不受影响）
app.middleware("http")(api_guard)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recommend.router, prefix="/api", tags=["recommend"])
app.include_router(feedback.router, prefix="/api", tags=["feedback"])
app.include_router(mbti.router, prefix="/api", tags=["mbti"])
app.include_router(astrology.router, prefix="/api", tags=["astrology"])
app.include_router(books.router, prefix="/api", tags=["books"])
app.include_router(synthesis.router, prefix="/api", tags=["synthesis"])
app.include_router(book_fit.router, prefix="/api", tags=["book_fit"])
app.include_router(mirror.router, prefix="/api", tags=["mirror"])
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(reviews.router, prefix="/api", tags=["reviews"])
app.include_router(reading.router, prefix="/api", tags=["reading"])


@app.get("/")
def root():
    return {"name": "BookMirror API", "version": "0.1.0", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok"}
