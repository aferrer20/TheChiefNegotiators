#!/usr/bin/env python3
"""Tell Bing, Yandex, Naver and Seznam that pages have changed.

IndexNow is a push protocol: instead of waiting to be crawled, you submit the
URLs. One endpoint notifies every participating engine. Google does not take
part, so this complements Search Console rather than replacing it.

Authentication is the key file at the site root — nothing to log into, no
account. Which also means it only works once that file is actually deployed.

    python3 tools/indexnow.py                 # every URL in sitemap.xml
    python3 tools/indexnow.py /microsoft-licensing-for-data-centers
    python3 tools/indexnow.py --check         # just verify the key file is live
    python3 tools/indexnow.py --dry-run       # show what would be sent

Run it after a deploy, not before.
"""
import argparse
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
HOST = 'www.thechiefnegotiators.com'
ORIGIN = f'https://{HOST}'
ENDPOINT = 'https://api.indexnow.org/indexnow'
TIMEOUT = 30


def find_key():
    """The key is whichever <key>.txt at the site root contains its own name."""
    for f in ROOT.glob('*.txt'):
        stem = f.stem
        if re.fullmatch(r'[A-Za-z0-9-]{8,128}', stem) and f.read_text(encoding='utf-8').strip() == stem:
            return stem
    sys.exit('No IndexNow key file found at the repo root. Expected <key>.txt '
             'whose contents are exactly the key.')


def sitemap_urls():
    sm = ROOT / 'sitemap.xml'
    if not sm.exists():
        sys.exit('sitemap.xml not found')
    return re.findall(r'<loc>\s*([^<\s]+)\s*</loc>', sm.read_text(encoding='utf-8'))


def absolute(u):
    if u.startswith('http://') or u.startswith('https://'):
        return u
    return ORIGIN + ('' if u.startswith('/') else '/') + u


def check_key_live(key):
    url = f'{ORIGIN}/{key}.txt'
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT) as r:
            body = r.read().decode('utf-8', 'replace').strip()
    except urllib.error.HTTPError as e:
        return False, f'{url} returned HTTP {e.code} — deploy the key file first'
    except Exception as e:                                  # noqa: BLE001
        return False, f'{url} unreachable: {e}'
    if body != key:
        return False, f'{url} served "{body[:40]}" but the key is "{key}"'
    return True, f'{url} is live and matches'


def submit(key, urls):
    payload = {
        'host': HOST,
        'key': key,
        'keyLocation': f'{ORIGIN}/{key}.txt',
        'urlList': urls,
    }
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json; charset=utf-8'},
        method='POST')
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')


MEANING = {
    200: 'accepted',
    202: 'accepted — key validation pending',
    400: 'bad request (malformed URL list)',
    403: 'key not valid — the key file is not live, or does not match',
    422: 'URLs do not belong to this host, or the key does not match the host',
    429: 'too many requests — slow down',
}


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('urls', nargs='*', help='URLs or paths; defaults to every URL in sitemap.xml')
    ap.add_argument('--dry-run', action='store_true', help='print the payload, send nothing')
    ap.add_argument('--check', action='store_true', help='verify the key file is live, then stop')
    args = ap.parse_args()

    key = find_key()
    print(f'key: {key}')

    if args.check:
        ok, msg = check_key_live(key)
        print(('  ok   ' if ok else '  FAIL ') + msg)
        return 0 if ok else 1

    urls = [absolute(u) for u in (args.urls or sitemap_urls())]
    print(f'{len(urls)} URL(s) to submit')
    for u in urls[:5]:
        print('   ', u)
    if len(urls) > 5:
        print(f'    … and {len(urls) - 5} more')

    if args.dry_run:
        print('\n(dry run — nothing sent)')
        return 0

    ok, msg = check_key_live(key)
    print(('  ok   ' if ok else '  FAIL ') + msg)
    if not ok:
        print('\nRefusing to submit: engines reject the batch when the key cannot be fetched.')
        return 1

    status, body = submit(key, urls)
    print(f'\nHTTP {status} — {MEANING.get(status, "unexpected response")}')
    if body.strip():
        print(body.strip()[:400])
    return 0 if status in (200, 202) else 1


if __name__ == '__main__':
    raise SystemExit(main())
