# Stage 1: Build Frontend
FROM node:22-alpine as frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend & Runtime
FROM python:3.11-slim
WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry

# Copy Backend Dependencies
COPY backend/pyproject.toml backend/poetry.lock ./
# Configure poetry to not create a virtualenv (easier for docker)
RUN poetry config virtualenvs.create false \
    && poetry install --without dev --no-interaction --no-ansi

# Copy Backend Code
COPY backend/app ./app
COPY backend/app/main.py ./app/main.py

# Copy Frontend Build from Stage 1 to Backend Static dir
# We use the path expected by the updated main.py ('static' in current dir or '../frontend/dist')
# But in Docker we can just put it in 'static' alongside 'app' or inside 'app'.
# main.py checks: static_dir = Path("static").
COPY --from=frontend-build /app/frontend/dist ./static

# Expose port
EXPOSE 13010
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "13010"]
