---
name: youtube-video-analysis
description: Watch and analyze a YouTube video in detail (metadata, chapters, timestamped transcript, scene-by-scene visual analysis, keyframes) and produce a structured summary. Use whenever the user shares a youtube.com / youtu.be link and asks to watch, summarize, analyze, review, transcribe, or extract key points, quotes, or timestamps from it.
---

# YouTube video analysis

Goal: give the user a faithful, detailed account of what a YouTube video says and shows,
with timestamps, without guessing. Combine up to three independent sources and say
which ones were actually available.

## Sources (use every one you can reach)

1. **Metadata + transcript (preferred, cheapest)** — run the bundled script:
   ```bash
   pip install --quiet yt-dlp youtube-transcript-api   # once
   python3 .claude/skills/youtube-video-analysis/scripts/yt_analyze.py "<url>" --out <scratch-dir> --langs it,en
   ```
   It writes `summary.txt` (title, channel, date, duration, chapters, description),
   `meta.json`, and `transcript.txt` (`[mm:ss] text`, manual subtitles preferred,
   auto-captions as fallback). Add `--frames 8` to also extract evenly spaced keyframes
   (needs ffmpeg) and look at them with the Read tool when visuals matter.
   Read `transcript.txt` in full; for videos over ~1 hour read it in chunks.

2. **Scene-by-scene visual analysis (server side)** — if the Higgsfield MCP tools are
   available, call `mcp__higgs__video_analysis_create` with `youtube_url`, then poll
   `mcp__higgs__video_analysis_status` every 30-60 s until `completed` (3-5 min typical).
   It returns per-scene descriptions of what is on screen. This works even when the
   sandbox cannot reach youtube.com because the fetch happens on their servers.
   Warn the user that accuracy drops on long videos. Start it FIRST so it runs while
   you fetch the transcript.

3. **Page fetch fallback** — `WebFetch` on the watch URL or on
   `https://www.youtube.com/oembed?url=<url>&format=json` for title and channel only.

If youtube.com is blocked by the egress proxy (403 on CONNECT), sources 1 and 3 fail;
say so explicitly and rely on source 2. Never invent a transcript, title, or speaker.

## Analysis procedure

1. Start source 2 (if available), then run source 1.
2. Read the transcript end to end. Note the structure: intro, main sections
   (use chapters when present, otherwise topic shifts), conclusion, calls to action.
3. Cross-check spoken content against the scene descriptions / frames: on-screen text,
   demos, charts, products, people shown.
4. Extract: thesis in one sentence, 5-10 key points with `[mm:ss]` timestamps, notable
   quotes (verbatim, short), numbers/claims worth verifying, and any caveats.

## Output format (answer in the user's language)

- **Titolo / canale / durata / data** (one line, only fields actually obtained)
- **In breve**: 2-3 sentences with the core message
- **Struttura e punti chiave**: bulleted, each with a timestamp
- **Cosa si vede**: visual highlights when relevant (from scenes/frames)
- **Citazioni / dati citati**: short verbatim quotes with timestamps
- **Note**: which sources were used, and what was unavailable (e.g. no captions,
  network blocked, only visual analysis) so the user knows the confidence level

Keep the summary proportional to the video: ~150 words for a short clip, up to
~500 words for a long lecture. Offer a full timestamped transcript on request.
