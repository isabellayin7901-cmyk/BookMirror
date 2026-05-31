from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    claude_model: str = "claude-haiku-4-5-20251001"
    cors_origins: str = "http://localhost:8081,http://localhost:19006,exp://*"
    log_level: str = "INFO"

    # ---- 发布加固 ----
    # 客户端必须在 X-App-Token 头携带该值才能访问 /api/*。
    # 留空（本地开发默认）= 不校验，方便联调；生产环境务必设置一个长随机串。
    app_token: str = ""
    # 每个 IP 在 rate_limit_window 秒内最多 rate_limit_max 次 /api 请求，防止刷爆 Claude 额度。
    rate_limit_max: int = 30
    rate_limit_window: int = 60

    # ---- 短信验证码（账号系统）----
    # sms_provider="mock" 时不真正发短信，仅记录日志；接入真实服务商后改为 twilio/aliyun 等。
    sms_provider: str = "mock"
    # mock 模式下把验证码直接回传给客户端，方便开发自测；生产务必设为 False。
    otp_dev_echo: bool = True
    otp_ttl_seconds: int = 300  # 验证码有效期
    otp_max_attempts: int = 5   # 单个验证码最多尝试次数

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
