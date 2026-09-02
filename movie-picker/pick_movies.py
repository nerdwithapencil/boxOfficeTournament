#!/usr/bin/env python3
"""Randomly pick 3 DVDs from the movie-shelf Google Sheet."""

import csv
import io
import random
import sys
import urllib.request

SHEET_ID = "1s60m985J6NgO7pmWqGAHqbKqylyiVmHAiyzbjkEJQ-I"
GID = "0"
CSV_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GID}"


def fetch_movies():
    with urllib.request.urlopen(CSV_URL) as response:
        text = response.read().decode("utf-8")

    if "<html" in text[:200].lower():
        sys.exit(
            "Got a sign-in page instead of CSV data.\n"
            "The sheet needs to be shared as 'Anyone with the link (Viewer)' "
            "for this script to read it without logging in."
        )

    movies = []
    for row in csv.reader(io.StringIO(text)):
        # Each shelf is a (title, roll-number, blank spacer) column triplet,
        # so titles land at every 3rd column starting at index 0.
        for title in row[0::3]:
            title = title.strip()
            if title:
                movies.append(title)
    return movies


def main():
    movies = fetch_movies()
    if len(movies) < 3:
        sys.exit(f"Only found {len(movies)} movies - check the sheet/URL.")

    picks = random.sample(movies, 3)
    print(f"Found {len(movies)} movies across the shelves.\n")
    print("Tonight's picks:")
    for title in picks:
        print(f"  - {title}")


if __name__ == "__main__":
    main()
