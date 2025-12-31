# ER-MusicTagManager

![CI Status](https://img.shields.io/github/actions/workflow/status/Eidolf/ER-MusicTagManager/ci-orchestrator.yml?label=CI&style=flat-square)
![Release](https://img.shields.io/github/v/release/Eidolf/ER-MusicTagManager?style=flat-square)
![License](https://img.shields.io/github/license/Eidolf/ER-MusicTagManager?style=flat-square)

![Project Logo](./images/logo.png)

A production-ready, domain-driven automated music organization tool. Scans directories, identifies albums, retrieves metadata from MusicBrainz, and organizes your music library with precision.

## 🚀 Features

### Core Functionality
- **📂 Smart Scanning**: Recursively scans directories for audio files (MP3, FLAC, OGG, WAV, M4A). Detects existing metadata and local cover art automatically.
- **🧠 Intelligent Identification**: Uses MusicBrainz to identify albums and tracks, patching missing metadata even for obscure releases.
- **🏷️ Automated Tagging**: Writes standardized ID3/Vorbis tags directly to files (Artist, Album, Title, Year, Cover Art).
- **📦 Structured Organization**: Automatically renames and moves files into a clean directory structure: `Output/Artist/Artist - Album (Year)/Title.ext`.

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
Access the dashboard at `http://localhost:5173`.

### Workflow Guide

1.  **Configure**: Enter your **Source Directory** (where your messy music is) and **Target Directory** (where clean music goes).
2.  **🔍 Scan**: Click "Scan Directory". The app will index all files and group them into potential albums.
3.  **🧠 Identify**: Click "Identify Albums". The system connects to MusicBrainz to find the best match for your files.
    - *Review*: You can expand any album to see the "Before vs After" metadata changes.
4.  **🏷️ Tag**: Click "Tag Files". Updated metadata is written to the files.
5.  **✨ Organize**: Click "Organize Files". Files are moved to the Target Directory in the standardized format.

## 🏗️ Architecture

The project follows a modular, scalable structure:

- `backend/`: Python FastAPI application (DDD principles).
- `frontend/`: React + Vite application (UI/UX).
- `.github/`: CI/CD orchestrators for automated testing, linting, and releases.

## 📜 License

Distributed under the **GNU standard Affero General Public License v3.0 (AGPL-3.0)**. See `LICENSE` for more information.
# ER-MusicTagManager
