FROM python:3.11-slim as builder

WORKDIR /tmp
RUN pip install poetry poetry-plugin-export
COPY ./pyproject.toml ./poetry.lock* /tmp/
RUN poetry export -f requirements.txt --output requirements.txt --without-hashes

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if needed (e.g. for mutagen/audio)
# RUN apt-get update && apt-get install -y --no-install-recommends ...

COPY --from=builder /tmp/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /app/requirements.txt

COPY ./app /app/app

# Non-root user
RUN useradd -m -u 1000 appuser
USER appuser

EXPOSE 13010
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "13010"]
