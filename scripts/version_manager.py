#!/usr/bin/env python3
"""Calculate ER-MusicTagManager release versions from stable Git tags."""

import argparse
import re
import subprocess
from collections.abc import Iterable
from datetime import datetime, timezone
from pathlib import Path

VERSION_FILE = Path("VERSION")
STABLE_TAG_PATTERN = re.compile(
    r"^v?(?P<year>\d{4})\.(?P<month>\d{1,2})\.(?P<patch>\d+)$"
)
RUN_ID_PATTERN = re.compile(r"^\d+(?:\.\d+)*$")


def parse_stable_tag(tag: str) -> tuple[int, int, int] | None:
    """Parse stable CalVer tags, including historical unprefixed tags."""
    match = STABLE_TAG_PATTERN.fullmatch(tag)
    if match is None:
        return None

    version = (
        int(match.group("year")),
        int(match.group("month")),
        int(match.group("patch")),
    )
    if version[0] < 1 or not 1 <= version[1] <= 12 or version[2] < 1:
        return None
    return version


def get_git_tags() -> list[str]:
    """Return repository tags, failing rather than silently using VERSION."""
    try:
        result = subprocess.run(
            ["git", "tag", "--list"],
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as error:
        raise RuntimeError("Git is required to determine the stable version.") from error
    except subprocess.CalledProcessError as error:
        detail = error.stderr.strip() or str(error)
        raise RuntimeError(f"Unable to read Git tags: {detail}") from error
    return result.stdout.splitlines()


def calculate_next_version(
    release_type: str,
    tags: Iterable[str],
    now: datetime | None = None,
    run_id: str | None = None,
) -> str:
    """Return a stable candidate or unique nightly candidate based on stable tags."""
    if release_type not in {"stable", "nightly"}:
        raise ValueError(f"Unsupported release type: {release_type}")

    current_time = datetime.now(timezone.utc) if now is None else now
    if current_time.tzinfo is None:
        raise ValueError("The supplied time must include a timezone.")
    current_time = current_time.astimezone(timezone.utc)
    current_period = (current_time.year, current_time.month)

    stable_versions = [
        version for tag in tags if (version := parse_stable_tag(tag)) is not None
    ]
    latest_stable = max(stable_versions, default=None)
    if latest_stable is not None and latest_stable[:2] > current_period:
        raise ValueError(
            "The latest stable tag is in a future UTC month; refusing to create "
            "a version that would move backwards."
        )

    patch = (
        latest_stable[2] + 1
        if latest_stable is not None and latest_stable[:2] == current_period
        else 1
    )
    base_version = f"{current_time.year}.{current_time.month}.{patch}"
    if release_type == "stable":
        return base_version

    if run_id is None or RUN_ID_PATTERN.fullmatch(run_id) is None:
        raise ValueError("Nightly releases require a numeric unique run ID.")
    timestamp = current_time.strftime("%Y%m%d.%H%M")
    return f"{base_version}-nightly.{timestamp}.{run_id}"


def read_version() -> str:
    if not VERSION_FILE.exists():
        return "0.0.0"
    return VERSION_FILE.read_text(encoding="utf-8").strip()


def write_version(version: str) -> None:
    """Write the stable VERSION mirror."""
    if parse_stable_tag(version) is None or version.startswith("v"):
        raise ValueError(f"VERSION must be a stable CalVer version, got {version!r}.")
    VERSION_FILE.write_text(f"{version}\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--action",
        required=True,
        choices=("read", "calculate", "write"),
    )
    parser.add_argument("--type", choices=("stable", "nightly"))
    parser.add_argument("--run-id")
    parser.add_argument("--version")
    args = parser.parse_args()

    try:
        if args.action == "read":
            print(read_version())
        elif args.action == "calculate":
            if args.type is None:
                parser.error("--type is required for calculate.")
            version = calculate_next_version(
                args.type,
                get_git_tags(),
                run_id=args.run_id,
            )
            print(version)
        else:
            if args.version is None:
                parser.error("--version is required for write.")
            write_version(args.version)
    except (OSError, RuntimeError, ValueError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
