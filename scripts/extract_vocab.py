"""Extract the three-circle vocabulary sections from the two supplied PDFs."""

from __future__ import annotations

import json
import random
import re
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parents[1] / "src" / "data" / "vocabulary.json"
PDFS = [
    ROOT / "【全书汇总版】圆圆新标日中级上册三圆词汇讲义.pdf",
    ROOT / "【全书汇总版】圆圆新标日中级下册三圆词汇讲义.pdf",
]

ACCENTS = "⓪①②③④⑤⑥⑦⑧⑨"
ENTRY = re.compile(
    rf"(?<![ぁ-んァ-ヶ一-龯A-Za-z0-9])"
    rf"([ぁ-んァ-ヶーA-Za-zＡ-Ｚａ-ｚ・～]+)"
    rf"(?:（([^）]+)）)?(?:[{ACCENTS}]|【[^】]*】)?\s*"
    rf"[【［]([^】］]+)[】］]\s*"
)

POS_MAP = {
    "名": "名词", "副": "副词", "连": "连词", "代": "代词",
    "专": "专有名词", "叹": "感叹词", "连体": "连体词",
    "形 1": "一类形容词", "形1": "一类形容词",
    "形 2": "二类形容词", "形2": "二类形容词",
    "动 1": "一类动词", "动1": "一类动词",
    "动 2": "二类动词", "动2": "二类动词",
    "动 3": "三类动词", "动3": "三类动词",
}


def clean(value: str) -> str:
    value = re.sub(r"关注B站.*?日语教室，跟着大可爱学日语", "", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip(" \n\t・→/，,。")


def normalize_pos(raw: str, context: str) -> str:
    raw = clean(raw).replace("［", "").replace("］", "")
    base = POS_MAP.get(raw, raw)
    if "动" in raw:
        if re.search(r"\(他\)|（他）|他动", context):
            return f"{base}・他动词"
        if re.search(r"\(自\)|（自）|自动", context):
            return f"{base}・自动词"
    return base


def fallback_example(word: str, pos: str) -> str:
    if "名词" in pos:
        return f"この「{word}」について詳しく調べました。"
    return f"先生は「{word}」という表現の使い方を説明しました。"


def extract() -> list[dict[str, object]]:
    text = "\n".join(
        "\n\f\n".join(page.extract_text() or "" for page in PdfReader(pdf).pages)
        for pdf in PDFS
    )
    sections = re.findall(
        r"第\s*(\d+)\s*课\s*三圆词汇表(.*?)"
        r"(?=【\s*第\s*\1\s*课\s*\n\s*⭕\s*\n?⭕\s*】)",
        text,
        re.S,
    )
    cards: list[dict[str, object]] = []
    seen: set[tuple[str, str]] = set()

    for lesson, section in sections:
        matches = list(ENTRY.finditer(section))
        for index, match in enumerate(matches):
            reading, written, raw_pos = match.groups()
            reading = clean(reading).replace("～", "")
            word = clean(written or reading)
            word = word.replace("～", "する" if reading.endswith("する") else "")
            reading_stem = reading.removesuffix("する")
            if written and reading_stem and word.endswith(reading_stem) and word != reading_stem:
                word = word[: -len(reading_stem)] + ("する" if reading.endswith("する") else "")
            if not word or len(word) > 30 or (word, reading) in seen:
                continue

            tail = section[match.end(): matches[index + 1].start() if index + 1 < len(matches) else None]
            tail = clean(tail)
            meaning = clean(re.split(r"[→・]", tail, maxsplit=1)[0])
            meaning = re.sub(r"\s*[0-9]+$", "", meaning)
            if not meaning or len(meaning) > 90:
                meaning = "讲义收录的 N2 核心词汇"

            bullets = [clean(item) for item in re.findall(r"・([^・→\n\f]+)", tail)]
            bullets = [item for item in bullets if 2 < len(item) < 100]
            example = bullets[0] if bullets else fallback_example(word, normalize_pos(raw_pos, tail))

            related: list[str] = []
            for chunk in re.findall(r"→\s*([^・\n\f]+)", tail):
                chunk = clean(chunk)
                if chunk and len(chunk) < 80:
                    related.append(chunk)
            if len(bullets) > 1:
                related.extend(bullets[1:3])

            seen.add((word, reading))
            cards.append({
                "id": f"n2-l{int(lesson):02d}-{len(cards) + 1:04d}",
                "word": word,
                "reading": reading,
                "partOfSpeech": normalize_pos(raw_pos, tail),
                "level": "N2",
                "meaning": meaning,
                "example": example,
                "relatedWords": related[:3],
                "lesson": int(lesson),
            })

    random.Random(20260623).shuffle(cards)
    return cards


if __name__ == "__main__":
    result = extract()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(result)} cards to {OUT}")
