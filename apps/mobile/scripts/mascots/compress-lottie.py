#!/usr/bin/env python3
"""Recompress .lottie archives with deflate.

A .lottie is a zip. LottieFiles exports them STORED — no compression at all —
which is how `login-screen-cream.lottie` reached 797KB of raw JSON and stalled
the auth screens' push transition while it was read. Deflating is lossless: the
JSON inside is byte-identical, only the archive's storage method changes, and
the runtimes already read deflated archives (blob-cream-temp shipped that way).

Re-run after exporting any new mascot:  python3 scripts/mascots/compress-lottie.py
"""

import io
import pathlib
import sys
import zipfile

ASSETS = pathlib.Path(__file__).resolve().parents[2] / "assets/animations/mascots"


def recompress(path: pathlib.Path) -> tuple[int, int]:
    before = path.stat().st_size
    with zipfile.ZipFile(path) as zin:
        names = zin.namelist()
        payload = {name: zin.read(name) for name in names}

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zout:
        for name in names:
            zout.writestr(name, payload[name])

    # Only keep the rewrite if it round-trips to the same bytes and actually won.
    with zipfile.ZipFile(io.BytesIO(buf.getvalue())) as check:
        assert {n: check.read(n) for n in check.namelist()} == payload, path.name

    after = len(buf.getvalue())
    if after < before:
        path.write_bytes(buf.getvalue())
    return before, after


def main() -> int:
    files = sorted(ASSETS.rglob("*.lottie"))
    if not files:
        print(f"no .lottie files under {ASSETS}", file=sys.stderr)
        return 1

    total_before = total_after = 0
    for path in files:
        before, after = recompress(path)
        total_before += before
        total_after += min(before, after)
        note = "unchanged" if after >= before else f"-{100 - after * 100 // before}%"
        print(f"{path.name:30s} {before / 1024:7.0f}KB -> {after / 1024:7.0f}KB  {note}")

    print(f"{'TOTAL':30s} {total_before / 1024:7.0f}KB -> {total_after / 1024:7.0f}KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
