# ER-MusicTagManager

![CI Status](https://github.com/Eidolf/ER-MusicTagManager/actions/workflows/ci-orchestrator.yml/badge.svg?branch=nightly)
![Release](https://img.shields.io/github/v/release/Eidolf/ER-MusicTagManager?include_prereleases&style=flat-square)
![License](https://img.shields.io/github/license/Eidolf/ER-MusicTagManager?style=flat-square)

![Project Logo](./images/logo.png)

A production-ready, domain-driven automated music organization tool. Scans directories, identifies albums, retrieves metadata from MusicBrainz, and organizes your music library with precision.

## 🚀 Features

### Core Functionality
- **📂 Smart Scanning**: Recursively scans directories for audio files (MP3, FLAC, OGG, WAV, M4A). Detects existing metadata and local cover art automatically.
- **🧠 Intelligent Identification**: Uses MusicBrainz to identify albums and tracks. Supports both **Automatic Matching** and **Manual Search** for difficult releases.
- **🏷️ Robust Tagging**: Writes standardized **ID3v2.3** tags for maximum compatibility (Windows, macOS, Car Stereos).
- **🔄 Progressive Workflow**: Fix "Unidentified" albums one by one with a dedicated **Review & Fix** loop. Write changes incrementally without restarting the entire session.
- **💾 Round-Trip Persistence**: Once a file is tagged with a MusicBrainz ID, the system "remembers" it forever. Re-scanning instantly identifies the album without guessing.
- **📦 Structured Organization**: Automatically renames and moves files into a clean directory structure: `Output/Artist/Album (Year)/01 - Title.ext`.

### Technical Highlights
- **Modern UI**: Built with React + Vite. Features real-time progress bars, diff-views (Previous vs New Metadata), and batch processing.
- **Robust Backend**: Python FastAPI with Domain-Driven Design (DDD) architecture.
- **Cross-Platform**: Runs on Windows (Native .exe), Linux, and Docker.
- **Safe & Secure**: Pre-flight validation system, signed commits, and SBOM generation.

## 📖 How to Use

### Portable Version (Windows/Linux)
1.  Download the latest release from the [Releases Page](https://github.com/Eidolf/ER-MusicTagManager/releases).
2.  Run the executable (`ER-MusicTagManager.exe` or `./ER-MusicTagManager`).
3.  Open your browser at `http://localhost:8000`.

### Docker Version
```bash
git clone https://github.com/Eidolf/ER-MusicTagManager.git
cd ER-MusicTagManager
docker-compose up --build
```
Access the dashboard at `http://localhost:5173` (or `http://localhost:8000` for backend API).

### Workflow Guide

1.  **Configure**: Enter your **Source Directory** (where your messy music is) and **Target Directory** (where clean music goes).
2.  **🚀 Start Processing**: The smart wizard runs the pipeline:
    - **Scan**: Findings files.
    - **Identify**: Matching against MusicBrainz.
3.  **review & Fix** (If needed):
    - If albums are unmatched, you will see a <span style="color:red">**⚠️ Red Banner**</span>.
    - Click **Review & Fix** to open the details.
    - Use **Deep Search** to find the correct release manually.
    - Click **Confirm & Write 💾** to immediately save the correct tags to your files.
4.  **💾 Write & Organize**:
    - Once all albums are green (Matched), click **Write & Organize All** in the Green Banner.
    - Your music is now perfectly tagged and sorted!

## 🛠️ Development

### Pre-Flight Checks
Before committing code, run the local validator to ensure your changes will pass CI:
```bash
./scripts/check-prepush.sh
```
This script runs local linters (Ruff, ESLint) and mimics GitHub Actions locally using `act`.

## 🏗️ Architecture

The project follows a modular, scalable structure:

- `backend/`: Python FastAPI application (DDD principles).
- `frontend/`: React + Vite application (UI/UX).
- `.github/`: CI/CD orchestrators for automated testing, linting, and releases.

## 📜 License

Distributed under the **GNU standard Affero General Public License v3.0 (AGPL-3.0)**. See `LICENSE` for more information.

