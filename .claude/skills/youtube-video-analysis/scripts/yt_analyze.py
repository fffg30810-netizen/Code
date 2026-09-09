#!/usr/bin/env python3
"""Fetch everything needed to analyze a YouTube video in detail.

Usage:
    python3 yt_analyze.py <youtube-url-or-id> [--out DIR] [--langs it,en] [--frames N]

Outputs (in DIR, default ./yt_analysis/<video_id>/):
    meta.json         full yt-dlp metadata (title, channel, description, chapters, tags, ...)
    summary.txt       human-readable metadata summary (title, channel, date, duration, chapters, description)
    transcript.txt    timestamped transcript "[mm:ss] text" (manual subs preferred, auto-captions fallback)
    frames/*.jpg      optional evenly spaced keyframes (requires ffmpeg and --frames N > 0)

Exit code 0 on success even if some parts are unavailable; each missing part is
reported on stderr so the caller knows what to fall back to.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

VIDEO_ID_RE = re.compile(r"(?:v=|youtu\.be/|shorts/|embed/)([A-Za-z0-9_-]{11})")


def video_id_from(url_or_id: str) -> str:
    m = VIDEO_ID_RE.search(url_or_id)
    if m:
        return m.group(1)
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", url_or_id):
        return url_or_id
    sys.exit(f"Cannot extract a YouTube video id from: {url_or_id}")


def fmt_ts(seconds: float) -> str:
    s = int(seconds)
    h, rem = divmod(s, 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def fetch_metadata(vid: str, out: str):
    if not shutil.which("yt-dlp"):
        print("yt-dlp not installed (pip install yt-dlp); skipping metadata", file=sys.stderr)
        return None
    try:
        raw = subprocess.check_output(
            ["yt-dlp", "--skip-download", "--dump-json", f"https://www.youtube.com/watch?v={vid}"],
            stderr=subprocess.PIPE, text=True, timeout=120,
        )
    except subprocess.CalledProcessError as e:
        print(f"metadata fetch failed: {e.stderr.strip().splitlines()[-1] if e.stderr else e}", file=sys.stderr)
        return None
    except subprocess.TimeoutExpired:
        print("metadata fetch timed out", file=sys.stderr)
        return None
    meta = json.loads(raw)
    with open(os.path.join(out, "meta.json"), "w") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    lines = [
        f"Title: {meta.get('title')}",
        f"Channel: {meta.get('channel') or meta.get('uploader')}",
        f"Upload date: {meta.get('upload_date')}",
        f"Duration: {meta.get('duration_string')} ({meta.get('duration')}s)",
        f"Views: {meta.get('view_count')}  Likes: {meta.get('like_count')}",
        f"Language: {meta.get('language')}",
        f"Tags: {', '.join(meta.get('tags') or [])}",
        "",
        "Chapters:",
    ]
    for ch in meta.get("chapters") or []:
        lines.append(f"  [{fmt_ts(ch['start_time'])}] {ch['title']}")
    if not meta.get("chapters"):
        lines.append("  (none)")
    lines += ["", "Description:", meta.get("description") or "(empty)"]
    with open(os.path.join(out, "summary.txt"), "w") as f:
        f.write("\n".join(lines) + "\n")
    return meta


def fetch_transcript(vid: str, out: str, langs):
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        print("youtube-transcript-api not installed (pip install youtube-transcript-api); skipping transcript", file=sys.stderr)
        return None
    api = YouTubeTranscriptApi()
    try:
        available = list(api.list(vid))
        manual = [t for t in available if not t.is_generated]
        auto = [t for t in available if t.is_generated]
        chosen = None
        for pool in (manual, auto):
            for lang in langs:
                for t in pool:
                    if t.language_code.split("-")[0] == lang:
                        chosen = t
                        break
                if chosen:
                    break
            if chosen:
                break
        if chosen is None and available:
            chosen = available[0]
        if chosen is None:
            print("no transcript available", file=sys.stderr)
            return None
        fetched = chosen.fetch()
    except Exception as e:  # network / disabled captions
        print(f"transcript fetch failed: {e}", file=sys.stderr)
        return None
    lines = [f"[{fmt_ts(s.start)}] {s.text.replace(chr(10), ' ')}" for s in fetched]
    header = f"# transcript language={chosen.language_code} generated={chosen.is_generated}\n"
    with open(os.path.join(out, "transcript.txt"), "w") as f:
        f.write(header + "\n".join(lines) + "\n")
    return lines


def extract_frames(vid: str, out: str, n: int, duration):
    if n <= 0:
        return
    if not (shutil.which("yt-dlp") and shutil.which("ffmpeg")):
        print("frames need yt-dlp + ffmpeg; skipping", file=sys.stderr)
        return
    frames_dir = os.path.join(out, "frames")
    os.makedirs(frames_dir, exist_ok=True)
    video_path = os.path.join(out, "video.mp4")
    if not os.path.exists(video_path):
        try:
            subprocess.check_call(
                ["yt-dlp", "-f", "bv*[height<=480]+ba/b[height<=480]", "--merge-output-format", "mp4",
                 "-o", video_path, f"https://www.youtube.com/watch?v={vid}"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=600,
            )
        except Exception as e:
            print(f"video download for frames failed: {e}", file=sys.stderr)
            return
    if not duration:
        return
    step = max(duration / (n + 1), 1)
    for i in range(1, n + 1):
        t = step * i
        subprocess.call(
            ["ffmpeg", "-loglevel", "error", "-y", "-ss", str(t), "-i", video_path, "-frames:v", "1",
             "-q:v", "3", os.path.join(frames_dir, f"frame_{i:02d}_{fmt_ts(t).replace(':', '-')}.jpg")]
        )


def main():
    p = argparse.ArgumentParser()
    p.add_argument("url")
    p.add_argument("--out", default=None)
    p.add_argument("--langs", default="it,en")
    p.add_argument("--frames", type=int, default=0)
    a = p.parse_args()
    vid = video_id_from(a.url)
    out = a.out or os.path.join("yt_analysis", vid)
    os.makedirs(out, exist_ok=True)
    langs = [x.strip() for x in a.langs.split(",") if x.strip()]

    meta = fetch_metadata(vid, out)
    lines = fetch_transcript(vid, out, langs)
    extract_frames(vid, out, a.frames, (meta or {}).get("duration"))

    print(f"video_id: {vid}")
    print(f"output dir: {out}")
    print(f"metadata: {'ok' if meta else 'MISSING'}")
    print(f"transcript: {len(lines) if lines else 'MISSING'} segments")
    if meta:
        print(f"title: {meta.get('title')}")


if __name__ == "__main__":
    main()
