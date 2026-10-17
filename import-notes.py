#!/usr/bin/python3
"""Convert staged Obsidian notes into Quarto blog posts.

macOS blocks reading the iCloud Obsidian vault without Full Disk Access, so the
vault is never touched here. Drag notes (and their attachments) out of the vault's
Blogs/ folder into this repo's Blogs/ folder, then run this script.

Notes are imported verbatim: syntax is converted, words are not. Each post lands in
posts/notes/<slug>/ with draft: true and a TODO description, so nothing half-finished
reaches a listing or the RSS feed.
"""

import argparse
import hashlib
import os
import re
import shutil
import sys
import unicodedata
from datetime import date, datetime
from pathlib import Path

REPO = Path(__file__).resolve().parent
SOURCE_DIR = REPO / "Blogs"
DEST_ROOT = REPO / "posts" / "notes"

UTTERANCES_REPO = "pratik-ingle/pratik-ingle.github.io"
TODO_DESCRIPTION = "TODO: one-sentence summary for the blog listing and RSS."
MARKER_PREFIX = "<!-- obsidian-import:"

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif"}
HTML_EXTS = {".html", ".htm"}

# Words that mean the trailing number is part of the title, not Obsidian's
# duplicate-file suffix. "Transformers Part 2" must survive.
SEQUENCE_WORDS = {
    "part", "chapter", "ch", "vol", "volume", "episode", "ep", "day", "week",
    "lecture", "lesson", "section", "step", "round", "phase", "v",
}

TAB_WIDTH = 4  # pandoc's tab stop

FENCE_RE = re.compile(r"^\s{0,3}(```+|~~~+)")
# -, *, + or 1. / 1) ; captures indent and the full marker-plus-space
LIST_MARKER_RE = re.compile(r"^(\s*)([-*+]|\d{1,9}[.)])(\s+)")
EMBED_RE = re.compile(r"!\[\[([^\]\[|]+?)(?:\|([^\]\[]*))?\]\]")
WIKILINK_RE = re.compile(r"(?<!!)\[\[([^\]\[|]+?)(?:\|([^\]\[]*))?\]\]")
BARE_URL_RE = re.compile(r"^(\s*)(https?://\S+)\s*$")
DUP_SUFFIX_RE = re.compile(r"^(.+?)[ _-](\d{1,2})$")


class HardError(Exception):
    """A problem the user must fix before anything can be imported."""


# --------------------------------------------------------------------------
# frontmatter derivation
# --------------------------------------------------------------------------

def strip_duplicate_suffix(stem, siblings, keep_suffix=False):
    """Drop Obsidian's " 1" duplicate-file suffix. Returns (base, warning)."""
    if keep_suffix:
        return stem, None
    m = DUP_SUFFIX_RE.match(stem)
    if not m:
        return stem, None
    base, number = m.group(1), int(m.group(2))

    # 1. Provable duplicate: the un-suffixed note is staged alongside it.
    if base.casefold() in siblings:
        return base, None

    # 2. The number belongs to the title.
    words = base.split()
    if words and words[-1].casefold().strip(".") in SEQUENCE_WORDS:
        return stem, None

    # 3. Probable duplicate, but say so out loud.
    if 1 <= number <= 9 and len(words) >= 2:
        return base, (
            'read "{}" as a duplicate of "{}" and dropped the " {}". '
            "Use --keep-suffix or --slug if that is wrong.".format(stem, base, number)
        )

    return stem, None


def slugify(text):
    decomposed = unicodedata.normalize("NFKD", text)
    ascii_only = "".join(c for c in decomposed if not unicodedata.combining(c))
    lowered = ascii_only.casefold()
    slug = re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")
    return slug


def note_date(path):
    st = path.stat()
    birth = getattr(st, "st_birthtime", 0) or 0
    # A drag-copy updates mtime but preserves birthtime, so birthtime is the
    # note's real creation date. Only trust it if it predates mtime.
    stamp = birth if 0 < birth <= st.st_mtime else st.st_mtime
    return date.fromtimestamp(stamp).isoformat()


def yaml_quote(text):
    cleaned = "".join(c for c in text if c == "\t" or ord(c) >= 0x20)
    escaped = cleaned.replace("\\", "\\\\").replace('"', '\\"')
    return '"{}"'.format(escaped)


def build_frontmatter(title, day, draft=True):
    lines = [
        "---",
        "title: {}".format(yaml_quote(title)),
        "date: {}".format(day),
        "categories: [notes]",
        "description: {}".format(yaml_quote(TODO_DESCRIPTION)),
    ]
    if draft:
        lines.append("draft: true")
    lines += [
        "comments:",
        "  utterances:",
        "    repo: {}".format(UTTERANCES_REPO),
        "---",
    ]
    return "\n".join(lines)


# --------------------------------------------------------------------------
# body transformation
# --------------------------------------------------------------------------

def normalize(text):
    """Step 0: strip BOM, normalize newlines, expand leading tabs, drop own YAML."""
    if text.startswith("﻿"):
        text = text[1:]
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    lines = text.split("\n")

    # Obsidian properties block, if the note has one.
    if lines and lines[0].strip() == "---":
        for i in range(1, len(lines)):
            if lines[i].strip() in ("---", "..."):
                lines = lines[i + 1:]
                break

    # Expand leading tabs so later passes can do plain column arithmetic. Code
    # fences are left exactly as written - their indentation is content.
    expanded, fence = [], None
    for line in lines:
        m = FENCE_RE.match(line)
        if fence is not None:
            expanded.append(line)
            if m and m.group(1)[0] == fence:
                fence = None
            continue
        if m:
            fence = m.group(1)[0]
            expanded.append(line)
            continue
        stripped = line.lstrip("\t ")
        indent = line[: len(line) - len(stripped)]
        col = 0
        for ch in indent:
            col = (col // TAB_WIDTH + 1) * TAB_WIDTH if ch == "\t" else col + 1
        expanded.append(" " * col + stripped if indent else line)

    # Trim leading/trailing blanks and collapse runs of 3+ to 2.
    while expanded and not expanded[0].strip():
        expanded.pop(0)
    while expanded and not expanded[-1].strip():
        expanded.pop()
    out, blanks = [], 0
    for line in expanded:
        if line.strip():
            blanks = 0
        else:
            blanks += 1
            if blanks > 2:
                continue
        out.append(line)
    return out


def fence_mask(lines):
    """True for every line inside (or delimiting) a fenced code block."""
    mask, fence = [False] * len(lines), None
    for i, line in enumerate(lines):
        m = FENCE_RE.match(line)
        if fence is None:
            if m:
                fence, mask[i] = m.group(1)[0], True
            continue
        mask[i] = True
        if m and m.group(1)[0] == fence:
            fence = None
    return mask


def reindent_lists(lines, mask):
    """Step 2: pull continuation lines back to their parent item's content column.

    Tab-indented $$ math sits at column 8, which is >= 4 past an ordered item's
    content column, so pandoc reads it as an indented code block and swallows
    everything after it. Moving continuations to the parent's content column
    makes a code block structurally impossible. List markers keep their own
    indentation, so nested bullets come through untouched.
    """
    stack = []  # (marker_indent, content_column)
    out = []
    for line, fenced in zip(lines, mask):
        if fenced or not line.strip():
            out.append(line)
            continue

        m = LIST_MARKER_RE.match(line)
        if m:
            indent = len(m.group(1))
            while stack and stack[-1][0] >= indent:
                stack.pop()
            stack.append((indent, indent + len(m.group(2)) + len(m.group(3))))
            out.append(line)
            continue

        stripped = line.lstrip(" ")
        indent = len(line) - len(stripped)
        target = 0
        for marker_indent, content_col in stack:
            if marker_indent < indent:
                target = content_col
            else:
                break
        out.append(" " * target + stripped if indent else line)
    return out


def separate_lists(lines, mask, strict):
    """Step 7: a list cannot interrupt a paragraph in pandoc markdown.

    "Questions:" immediately followed by "1. ..." makes pandoc absorb item 1 into
    the paragraph and restart the list at 2. Inserting a blank line changes no
    words and preserves the structure that was written.
    """
    out, warnings, inserted = [], [], 0
    prev_blank, prev_listish = True, False
    for i, (line, fenced) in enumerate(zip(lines, mask)):
        if fenced:
            out.append(line)
            prev_blank, prev_listish = False, False
            continue
        if not line.strip():
            out.append(line)
            prev_blank = True
            continue

        if LIST_MARKER_RE.match(line) and not prev_blank and not prev_listish:
            if strict:
                warnings.append(
                    "line {}: list starts directly after a paragraph; pandoc will "
                    "merge the first item into it (--strict-verbatim left it alone)".format(i + 1)
                )
            else:
                out.append("")
                inserted += 1
        out.append(line)
        prev_blank = False
        prev_listish = True if LIST_MARKER_RE.match(line) else False
    return out, warnings, inserted


def image_target(name):
    """Angle-bracket form; attachment names routinely contain spaces."""
    return "<{}>".format(name) if re.search(r"[\s()<>]", name) else name


def iframe_for(name, height):
    from urllib.parse import quote
    src = quote(name, safe="/._-~")
    return (
        '<iframe class="note-embed" src="{src}" title="{title}" width="100%" '
        'height="{h}" loading="lazy" style="border:1px solid #e5e7eb; '
        'border-radius:12px; background:#fff;"></iframe>'
    ).format(src=src, title=name.replace('"', "&quot;"), h=height)


def missing_callout(name, indent):
    pad = " " * indent
    return [
        pad + '::: {.callout-warning appearance="simple"}',
        pad + "Missing attachment: `{}`".format(name),
        pad + ":::",
    ]


def convert_embeds(lines, mask, resolved, missing, height):
    """Steps 3 and 4: ![[x.png]] -> markdown image, ![[x.html]] -> iframe."""
    out = []
    for line, fenced in zip(lines, mask):
        if fenced or "![[" not in line:
            out.append(line)
            continue

        stripped = line.lstrip(" ")
        indent = len(line) - len(stripped)

        # An embed alone on its line becomes a block, padded with blanks.
        solo = EMBED_RE.fullmatch(stripped)
        if solo:
            name = solo.group(1).strip()
            ext = Path(name).suffix.casefold()
            if name in missing:
                block = missing_callout(name, indent)
            elif ext in HTML_EXTS:
                block = [" " * indent + iframe_for(name, height)]
            else:
                attrs = ""
                size = (solo.group(2) or "").strip()
                if size.isdigit():
                    attrs = "{{width={}}}".format(size)
                block = [" " * indent + "![]({}){}".format(image_target(name), attrs)]
            if out and out[-1].strip():
                out.append("")
            out.extend(block)
            out.append("")
            continue

        # Inline embed inside a sentence: substitute in place.
        def sub(m):
            name = m.group(1).strip()
            if name in missing:
                return "`[missing attachment: {}]`".format(name)
            if Path(name).suffix.casefold() in HTML_EXTS:
                return iframe_for(name, height)
            return "![]({})".format(image_target(name))

        out.append(EMBED_RE.sub(sub, line))
    return out


def convert_wikilinks(lines, mask, mode):
    if mode == "raw":
        return lines

    def sub(m):
        label = (m.group(2) or m.group(1)).strip()
        if mode == "link":
            slug = slugify(m.group(1).strip())
            if slug and (DEST_ROOT / slug / "index.qmd").exists():
                return "[{}](../{}/)".format(label, slug)
        return "**{}**".format(label)

    return [
        line if fenced else WIKILINK_RE.sub(sub, line)
        for line, fenced in zip(lines, mask)
    ]


def link_bare_urls(lines, mask):
    """Pandoc markdown does not autolink bare URIs; the repo already writes <...>."""
    out = []
    for line, fenced in zip(lines, mask):
        m = None if fenced else BARE_URL_RE.match(line)
        if m and not m.group(2).endswith(">"):
            out.append("{}<{}>".format(m.group(1), m.group(2)))
        else:
            out.append(line)
    return out


def convert_body(text, resolved, missing, *, height=520, wikilink_mode="bold", strict=False):
    lines = normalize(text)

    lines = reindent_lists(lines, fence_mask(lines))
    lines, warnings, inserted = separate_lists(lines, fence_mask(lines), strict)
    if inserted:
        warnings.append(
            "inserted {} blank line(s) so pandoc keeps the list structure intact".format(inserted)
        )

    mask = fence_mask(lines)
    lines = convert_embeds(lines, mask, resolved, missing, height)
    mask = fence_mask(lines)
    lines = convert_wikilinks(lines, mask, wikilink_mode)
    lines = link_bare_urls(lines, fence_mask(lines))

    # Tidy the blank lines the embed pass may have doubled up.
    out, blanks = [], 0
    for line in lines:
        if line.strip():
            blanks = 0
        else:
            blanks += 1
            if blanks > 1:
                continue
        out.append(line)
    while out and not out[-1].strip():
        out.pop()
    return "\n".join(out), warnings


# --------------------------------------------------------------------------
# attachments
# --------------------------------------------------------------------------

def find_attachment(name):
    direct = SOURCE_DIR / name
    if direct.is_file():
        return direct
    matches = [p for p in SOURCE_DIR.rglob("*") if p.is_file() and p.name == name]
    if matches:
        return matches[0]
    folded = name.casefold()
    for p in SOURCE_DIR.rglob("*"):
        if p.is_file() and p.name.casefold() == folded:
            return p
    return None


def resolve_attachments(raw_text):
    """Scan the untransformed note so reported names match what Obsidian shows."""
    resolved, missing = {}, []
    for m in EMBED_RE.finditer(raw_text):
        name = m.group(1).strip()
        if name in resolved or name in missing:
            continue
        found = find_attachment(name)
        if found:
            resolved[name] = found
        else:
            missing.append(name)
    return resolved, missing


# --------------------------------------------------------------------------
# provenance and idempotency
# --------------------------------------------------------------------------

def marker_line(source_name, digest):
    return '{} source="{}" sha256={} generated={} -->'.format(
        MARKER_PREFIX, source_name.replace('"', ""), digest, date.today().isoformat()
    )


def split_existing(text):
    """Return (frontmatter, body_without_marker, marker) for a generated post."""
    marker = None
    lines = text.split("\n")
    kept = []
    for line in lines:
        if line.startswith(MARKER_PREFIX):
            marker = line
            continue
        kept.append(line)
    text = "\n".join(kept)

    frontmatter = None
    if text.startswith("---\n"):
        end = text.find("\n---", 4)
        if end != -1:
            cut = text.index("\n", end + 1) if "\n" in text[end + 1:] else len(text)
            frontmatter = text[: text.find("\n", end + 1)].strip("\n")
            text = text[text.find("\n", end + 1) + 1:]
    return frontmatter, text.strip("\n"), marker


def marker_digest(marker):
    m = re.search(r"sha256=([0-9a-f]+)", marker or "")
    return m.group(1) if m else None


# --------------------------------------------------------------------------
# driver
# --------------------------------------------------------------------------

def plan_note(path, siblings, args):
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    text = raw.decode("utf-8")

    stem = path.stem
    base, warning = strip_duplicate_suffix(stem, siblings, args.keep_suffix)
    slug = args.slug or slugify(base)
    if not slug:
        slug = "note-" + hashlib.sha1(stem.encode()).hexdigest()[:8]

    resolved, missing = resolve_attachments(text)
    body, warnings = convert_body(
        text, resolved, missing,
        height=args.embed_height,
        wikilink_mode=args.wikilink_mode,
        strict=args.strict_verbatim,
    )
    if warning:
        warnings.insert(0, warning)

    return {
        "source": path,
        "slug": slug,
        "title": base,
        "date": note_date(path),
        "digest": digest,
        "body": body,
        "resolved": resolved,
        "missing": missing,
        "warnings": warnings,
    }


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Convert staged Obsidian notes in Blogs/ into posts/notes/<slug>/index.qmd.",
    )
    ap.add_argument("--dry-run", action="store_true", help="report what would happen, write nothing")
    ap.add_argument("--force", action="store_true",
                    help="replace the body of an already-imported post, keeping its frontmatter")
    ap.add_argument("--force-all", action="store_true",
                    help="replace body and frontmatter, discarding hand edits")
    ap.add_argument("--slug", help="override the slug (only valid with a single staged note)")
    ap.add_argument("--keep-suffix", action="store_true",
                    help='never strip a trailing " 1" from the filename')
    ap.add_argument("--strict-verbatim", action="store_true",
                    help="do not insert blank lines before lists; warn instead")
    ap.add_argument("--wikilink-mode", choices=["bold", "raw", "link"], default="bold")
    ap.add_argument("--embed-height", type=int, default=520, help="iframe height for .html embeds")
    ap.add_argument("--no-draft", action="store_true", help="omit draft: true from new posts")
    args = ap.parse_args(argv)

    if sys.version_info < (3, 7):
        raise HardError("needs Python 3.7 or newer; this is {}".format(sys.version.split()[0]))
    if not SOURCE_DIR.is_dir():
        raise HardError("no staging folder at {}. Create it and drag notes in.".format(SOURCE_DIR))

    notes = sorted(p for p in SOURCE_DIR.glob("*.md") if p.is_file())
    if not notes:
        print("Nothing staged in {}/.".format(SOURCE_DIR.name))
        return 0
    if args.slug and len(notes) > 1:
        raise HardError("--slug needs exactly one staged note; found {}".format(len(notes)))

    siblings = {p.stem.casefold() for p in notes}
    plans = [plan_note(p, siblings, args) for p in notes]

    by_slug = {}
    for plan in plans:
        clash = by_slug.get(plan["slug"])
        if clash:
            names = sorted([clash["source"].name, plan["source"].name])
            hint = (
                "They look like the same note staged twice - drop one from {}/."
                if any(DUP_SUFFIX_RE.match(Path(n).stem) for n in names)
                else "Rename one, or import them one at a time with --slug."
            ).format(SOURCE_DIR.name)
            raise HardError(
                '"{}" and "{}" both map to posts/notes/{}/. {}'.format(
                    names[0], names[1], plan["slug"], hint
                )
            )
        by_slug[plan["slug"]] = plan

    referenced = set()
    any_missing = False
    written = skipped = 0

    for plan in plans:
        dest_dir = DEST_ROOT / plan["slug"]
        if DEST_ROOT.resolve() not in dest_dir.resolve().parents:
            raise HardError("slug {!r} escapes {}".format(plan["slug"], DEST_ROOT))
        dest = dest_dir / "index.qmd"
        rel = dest.relative_to(REPO)
        referenced.update(p.resolve() for p in plan["resolved"].values())

        marker = marker_line(plan["source"].name, plan["digest"])
        frontmatter = build_frontmatter(plan["title"], plan["date"], draft=not args.no_draft)

        action, note = "write", ""
        if dest.exists():
            old_fm, old_body, old_marker = split_existing(dest.read_text(encoding="utf-8"))
            if old_marker is None:
                action, note = "skip", "hand-authored (no import marker) - never overwritten"
            elif args.force_all:
                action, note = "write", "--force-all: frontmatter and body replaced"
            elif old_body == plan["body"]:
                action, note = "skip", ""
            elif args.force:
                action = "write"
                note = "--force: body replaced, frontmatter kept"
                if old_fm:
                    frontmatter = old_fm
            else:
                reasons = []
                if marker_digest(old_marker) != plan["digest"]:
                    reasons.append("source note changed")
                else:
                    reasons.append("post edited since import")
                action = "skip"
                note = "{} - use --force to replace the body".format(", ".join(reasons))

        label = {"write": "+", "skip": "="}[action]
        print("{} {}".format(label, rel))
        print("      from {}/{}".format(SOURCE_DIR.name, plan["source"].name))
        if note:
            print("      {}".format(note))
        for name in plan["resolved"]:
            print("      attachment {}".format(name))
        for name in plan["missing"]:
            any_missing = True
            print("      MISSING   {}".format(name))
        for warning in plan["warnings"]:
            print("      note: {}".format(warning))

        if action == "skip":
            skipped += 1
            continue
        written += 1
        if args.dry_run:
            continue

        dest_dir.mkdir(parents=True, exist_ok=True)
        dest.write_text(
            "{}\n\n{}\n\n{}\n".format(frontmatter, plan["body"], marker),
            encoding="utf-8",
        )
        for name, src in plan["resolved"].items():
            shutil.copy2(src, dest_dir / name)

    stray = [
        p for p in SOURCE_DIR.rglob("*")
        if p.is_file() and p.suffix.casefold() != ".md"
        and p.name != ".DS_Store" and p.resolve() not in referenced
    ]
    if stray:
        print("\nIn {}/ but not embedded by any note:".format(SOURCE_DIR.name))
        for p in sorted(stray):
            print("  {}".format(p.relative_to(SOURCE_DIR)))

    verb = "would write" if args.dry_run else "written"
    print("\n{} {}, {} skipped.".format(verb, written, skipped))
    if any_missing:
        print(
            "Some attachments are missing. Drag them into {}/ and re-run with --force."
            .format(SOURCE_DIR.name)
        )
        return 2
    if written and not args.dry_run:
        print("Next: fill in each description, drop `draft: true`, then ./deploy.sh")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except HardError as exc:
        print("error: {}".format(exc), file=sys.stderr)
        sys.exit(1)
