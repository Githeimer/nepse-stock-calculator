FROM python:3.15-slim

COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    TZ=Asia/Kathmandu

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY update_prices.py ./

ENV PATH="/app/.venv/bin:$PATH"
CMD ["python", "update_prices.py"]