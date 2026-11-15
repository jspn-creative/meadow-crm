"""Produce a local review dataset from the original export without reading or changing CRM data."""

import argparse
import csv
import html
import json
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from urllib.parse import quote_plus


AS_OF = date(2026, 11, 14)
CUTOFF = date(2025, 11, 14)
GROUPS = (
    "relationship-tag",
    "notes-recent",
    "notes-older",
    "notes-undated",
    "recent-engagement",
    "older-engagement",
    "recent-unengaged",
    "older-unengaged",
    "opted-out",
)
SYSTEM_NOTE = re.compile(
    r"To Number:|Contact Message:|Lead Status:|Outcome:|View Report|has responded to|"
    r"concierge|TCPA|updated from|Contact met System|disqualif|consent|"
    r"additional emails:|additional phones:|Lead Created|Search:|Property URL:|"
    r"autotag|Status Type:|assigned campaign|Reason:|Received stop word|"
    r"Question:|Action Type:|logged in|unable to receive|Contact updated by|"
    r"Contact name updated|sent a valuation report|privacy policy|^Address:",
    re.I,
)
STOP_REPLY = re.compile(r"^(?:stop(?:all)?|unsubscribe|cancel|end|quit)[.!\s]*$", re.I)
PLAIN_DATE = re.compile(r"\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}")


def rows(path):
    with path.open(encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def clean(value):
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    return html.unescape(re.sub(r"<[^>]*>", "", value)).strip()


def events(notes):
    for chunk in re.split(r"---(?=\s*\d{4}-\d\d-\d\d)", notes):
        match = re.match(r"\s*(\d{4}-\d\d-\d\d) \d\d:\d\d:\d\d:\s*(.*)", chunk, re.S)
        if match:
            when, body = date.fromisoformat(match[1]), clean(match[2])
            if when <= AS_OF:
                yield when, body
        elif chunk.strip():
            yield None, clean(chunk)


def field(body, label):
    match = re.search(rf"(?:^|\n){re.escape(label)}:\s*([^\n]*)", body)
    return match[1].strip() if match else ""


def incoming_message(body):
    match = re.search(r"(?:^|\n)Text:\s*(.*)", body, re.S)
    return re.split(r"\nMessage Type:", match[1])[0].strip() if match else ""


def personal_inquiry(body):
    if not body.startswith("Contact Message:"):
        return False
    message = re.split(
        r"\n(?:Property URL|Search):", body.removeprefix("Contact Message:")
    )[0]
    message = re.sub(r"\[[^\]]*\]", "", message)
    message = re.sub(
        r"^\s*I am interested in [^.!?]+(?:[.!?]|$)", "", message, flags=re.I
    )
    return len(re.sub(r"\W", "", message)) >= 12


def classify(raw, imported):
    notes, engagement, restrictions = [], [], []
    tags = set(re.findall(r"[a-z]+", raw["Hashtags"].lower()))
    relationship_tag = bool(tags & {"pastclient", "foreverclient"})
    flag = any(
        row["do_not_contact"].lower() in {"true", "yes", "1"} for row in imported
    )
    if flag:
        restrictions.append((None, "Imported contact restriction"))
    for when, body in events(raw["Agent Notes"]):
        incoming = field(body, "Direction").lower() == "incoming"
        message = incoming_message(body) if incoming else ""
        stopped = bool(message and STOP_REPLY.fullmatch(message))
        if stopped or re.search(
            r"Received stop word|Opt-out keyword|Outcome:\s*optedOut", body, re.I
        ):
            restrictions.append((when, "STOP reply or recorded opt-out"))
        if field(body, "Outcome") in {"phoneConversation", "successfulTransfer"}:
            engagement.append((when, "Completed phone conversation"))
        elif incoming and message and not stopped:
            engagement.append((when, "Personal text reply"))
        elif body.startswith("Question:") and field(body, "Answer"):
            engagement.append((when, "Answered a qualification question"))
        elif personal_inquiry(body):
            engagement.append((when, "Personal Zillow message"))
        elif (
            not SYSTEM_NOTE.search(body)
            and len(re.sub(r"\W", "", body)) >= 16
            and not PLAIN_DATE.fullmatch(body)
        ):
            notes.append((when, "Free-text note to review"))
    registered = date.fromisoformat(raw["Registered"])
    dated_contact = [(when, why) for when, why in engagement if when]
    last_contact, contact_reason = max(dated_contact, default=(None, ""))
    last_note = max((when for when, _ in notes if when), default=None)
    last_opt_out = max((when for when, _ in restrictions if when), default=None)
    if relationship_tag:
        group, reason = "relationship-tag", "PastClient/ForeverClient hashtag"
    elif notes:
        group = (
            "notes-recent"
            if last_note and last_note >= CUTOFF
            else "notes-older"
            if last_note
            else "notes-undated"
        )
        reason = "Free-text note to review; meaning and author not established"
    elif restrictions:
        group, reason = "opted-out", restrictions[-1][1]
    elif engagement:
        group = (
            "recent-engagement"
            if last_contact and last_contact >= CUTOFF
            else "older-engagement"
        )
        reason = contact_reason or "Engagement recorded; date unavailable"
    else:
        group = "recent-unengaged" if registered >= CUTOFF else "older-unengaged"
        reason = "No personal reply, completed conversation, or relationship note found"
    return {
        "group": group,
        "registered": registered.isoformat(),
        "last_engagement": last_contact.isoformat() if last_contact else "",
        "last_note": last_note.isoformat() if last_note else "",
        "last_opt_out": last_opt_out.isoformat() if last_opt_out else "",
        "evidence": reason,
        "contact_restriction": "Recorded opt-out; preserve Consent by channel"
        if restrictions
        else "",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-export", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    sources = Path(__file__).resolve().parent
    repo = sources.parents[2]
    confirmed = {
        row["client_id"] for row in rows(sources / "confirmed-client-records.csv")
    }
    transformed = defaultdict(list)
    for row in rows(repo / "docs/misc/client-data.csv"):
        transformed[int(row["source_row"])].append(row)
    original = rows(args.raw_export)
    result = []
    for source, imported in sorted(transformed.items()):
        first = imported[0]
        if any(re.search(r"test record", row["import_note"], re.I) for row in imported):
            continue
        name = f"{first['first_name']} {first['last_name']}".strip()
        if not name:
            continue
        client_id = f"import-client-{source}"
        if client_id in confirmed:
            continue
        raw = original[source - 2]
        if raw["Email"].strip().lower() != first["email"].strip().lower():
            raise ValueError(f"Source-row alignment changed at {source}")
        entry = {"client_id": client_id, "name": name, **classify(raw, imported)}
        archived = any(
            row["client_archived"].lower() in {"true", "yes", "1"} for row in imported
        )
        entry["url"] = (
            "https://dash.meadownw.com/registry?q="
            + quote_plus(name)
            + ("&archived=true" if archived else "")
        )
        result.append(entry)
    if len(confirmed) != 113 or len(result) != 714:
        raise ValueError(
            "Expected the frozen 113 matched clients and 714 review clients"
        )
    case_source = json.loads((sources / "client-review-cases.json").read_text())
    if (
        case_source.get("decision") != "active"
        or case_source.get("flag_for_review") is not True
    ):
        raise ValueError(
            "Expected the developer-approved Active decision with review flags"
        )
    if (case_source["as_of"], case_source["cutoff"]) != (
        AS_OF.isoformat(),
        CUTOFF.isoformat(),
    ):
        raise ValueError("The curated note cases need review for this snapshot")
    recent = {row["client_id"]: row for row in result if row["group"] == "notes-recent"}
    case_ids, covered, cases = set(), [], []
    for case in case_source["cases"]:
        if (
            case["id"] in case_ids
            or not case["client_ids"]
            or not case["why"].strip()
            or not case.get("review_note", "").strip()
        ):
            raise ValueError(
                "Note cases need unique IDs, clients, an explanation, and a review instruction"
            )
        case_ids.add(case["id"])
        covered.extend(case["client_ids"])
        cases.append({**case, "members": [recent[key] for key in case["client_ids"]]})
    if len(covered) != len(set(covered)) or set(covered) != set(recent):
        raise ValueError(
            "Every recent-note client must belong to exactly one review case"
        )
    cases.sort(
        key=lambda case: max(row["last_note"] for row in case["members"]), reverse=True
    )
    approved = {
        "as_of": AS_OF.isoformat(),
        "cutoff": CUTOFF.isoformat(),
        "decision_source": case_source["decision_source"],
        "expected_clients": 30,
        "clients": [
            {
                "client_id": member["client_id"],
                "case_id": case["id"],
                "decision": "active",
                "flagged": True,
                "flag_note": case["review_note"],
            }
            for case in cases
            for member in case["members"]
        ],
    }
    if len(approved["clients"]) != approved["expected_clients"]:
        raise ValueError("Expected exactly 30 approved Active clients")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "client-review-active.json").write_text(
        json.dumps(approved, ensure_ascii=False, indent=2) + "\n"
    )
    with (args.output_dir / "client-review-groups.csv").open(
        "w", encoding="utf-8", newline=""
    ) as output:
        writer = csv.DictWriter(output, fieldnames=list(result[0]))
        writer.writeheader()
        writer.writerows(result)
    summary = {
        "as_of": AS_OF.isoformat(),
        "cutoff": CUTOFF.isoformat(),
        "groups": {},
        "recent_cases": cases,
        "approved_active": approved["clients"],
    }
    for group in GROUPS:
        members = [row for row in result if row["group"] == group]
        named = [
            row
            for row in members
            if any(character.isalpha() for character in row["name"])
        ]
        ranked = sorted(
            named or members,
            key=lambda row: (
                row["last_note"]
                if group.startswith("notes-")
                else row["last_engagement"],
                row["last_engagement"],
                row["registered"],
            ),
            reverse=True,
        )
        indices = sorted({0, len(ranked) // 2, len(ranked) - 1}) if ranked else []
        summary["groups"][group] = {
            "count": len(members),
            "restricted": sum(bool(row["contact_restriction"]) for row in members),
            "examples": [ranked[index] for index in indices],
        }
    (args.output_dir / "client-review-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n"
    )
    questionnaire = args.output_dir / "client-review.html"
    if questionnaire.exists():
        document = questionnaire.read_text()
        questionnaire_data = {
            "as_of": summary["as_of"],
            "cutoff": summary["cutoff"],
            "groups": {
                key: value
                for key, value in summary["groups"].items()
                if key != "notes-recent"
            },
            "approved_active": approved["clients"],
        }
        payload = json.dumps(questionnaire_data, ensure_ascii=False, indent=2).replace(
            "<", "\\u003c"
        )
        document, replacements = re.subn(
            r'(<script id="review-data" type="application/json">).*?(</script>)',
            lambda match: match[1] + "\n" + payload + "\n    " + match[2],
            document,
            flags=re.S,
        )
        if replacements != 1:
            raise ValueError(
                "Expected one generated review-data block in the questionnaire"
            )
        questionnaire.write_text(document)
    print(
        json.dumps({group: data["count"] for group, data in summary["groups"].items()})
    )
    print("Distinct review clients:", len({row["client_id"] for row in result}))
    print(
        "Restricted clients by group:",
        dict(Counter(row["group"] for row in result if row["contact_restriction"])),
    )


if __name__ == "__main__":
    main()
