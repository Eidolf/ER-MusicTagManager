#!/usr/bin/env python3
import sys
import argparse
from datetime import datetime
import os
import re

VERSION_FILE = 'VERSION'

def read_version():
    if not os.path.exists(VERSION_FILE):
        return "0.0.0"
    with open(VERSION_FILE, 'r') as f:
        return f.read().strip()

def write_version(version):
    with open(VERSION_FILE, 'w') as f:
        f.write(version)
    print(f"Version updated to: {version}")

def get_current_date_parts():
    now = datetime.now()
    return now.year, now.month

def parse_version(version_str):
    """
    Parses YYYY.MM.PATCH-suffix
    """
    # Remove any existing suffixes for calculation base
    base = version_str.split('-')[0]
    parts = base.split('.')
    if len(parts) < 3:
        return 0, 0, 0
    return int(parts[0]), int(parts[1]), int(parts[2])

def bump_version(release_type):
    current_ver = read_version()
    curr_year, curr_month, curr_patch = parse_version(current_ver)
    
    now_year, now_month = get_current_date_parts()
    
    # Reset patch if month/year changed
    if now_year != curr_year or now_month != curr_month:
        new_patch = 1
    else:
        new_patch = curr_patch + 1
        # If we are just bumping dev from a non-latest environment, we might need logic.
        # But per requirements: Reset patch to 1 when month or year changes.
    
    # Base version string
    new_base = f"{now_year}.{now_month}.{new_patch}"
    
    if release_type == 'stable':
        final_ver = new_base
    elif release_type == 'beta':
        final_ver = f"{new_base}-beta"
    elif release_type == 'nightly':
        # timestamp = YYYYMMDD.HHMM
        timestamp = datetime.now().strftime("%Y%m%d.%H%M")
        final_ver = f"{new_base}-nightly.{timestamp}"
    elif release_type == 'dev':
        # Dev bump just sets it ready for next cycle
        final_ver = f"{new_base}-dev"
    else:
        print(f"Unknown release type: {release_type}")
        sys.exit(1)
        
    write_version(final_ver)
    return final_ver

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Manage Project Version')
    parser.add_argument('action', choices=['bump', 'read'], help='Action to perform')
    parser.add_argument('--type', choices=['stable', 'beta', 'nightly', 'dev'], default='dev', help='Release type for bump')
    
    args = parser.parse_args()
    
    if args.action == 'read':
        print(read_version())
    elif args.action == 'bump':
        bump_version(args.type)
