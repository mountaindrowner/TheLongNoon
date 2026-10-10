#!/usr/bin/env python3
"""Pack the source tree back into one self-contained offline HTML file.

    python3 tools/build.py [src] [dist/The-Long-Noon.html]

Inverse of tools/unpack.py: fonts, sprite sheets and music are re-inlined as base64,
JSON data is minified back into <script type="application/json"> tags, and the
js/ pieces are concatenated in the order listed in js/ORDER.
"""
import base64, json, os, re, sys

MIME = {'png': 'image/png', 'woff2': 'font/woff2', 'mp3': 'audio/mpeg'}


def read(path, binary=False):
    if binary:
        with open(path, 'rb') as f:
            return f.read()
    with open(path, encoding='utf-8', newline='') as f:
        return f.read()


def data_uri(path):
    return f"data:{MIME[path.rsplit('.', 1)[1]]};base64," + base64.b64encode(read(path, True)).decode()


def main(src, out):
    def inline_urls(text, base):  # url(../assets/x.woff2) -> url(data:...)
        return re.sub(r'url\((\.\./assets/[^)]+)\)', lambda m: 'url(' + data_uri(os.path.normpath(os.path.join(base, m.group(1)))) + ')', text)

    def sub(m):
        kind, arg = m.group(1), (m.group(2) or '').strip()
        if kind == 'include':
            text = read(f'{src}/{arg}')
            return inline_urls(text, os.path.dirname(f'{src}/{arg}')) if arg.endswith('.css') else text
        if kind == 'json':
            obj = json.loads(read(f'{src}/{arg}'))
            if 'images' in obj:  # sprite manifest: inline the atlases
                obj['images'] = {k: data_uri(os.path.normpath(os.path.join(f'{src}/data', v))) for k, v in obj['images'].items()}
            return json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
        if kind == 'music':
            return json.dumps({k: base64.b64encode(read(f'{src}/assets/music/{k}.mp3', True)).decode() for k in arg.split()})
        if kind == 'js':
            return ''.join(read(f'{src}/js/{n}') for n in read(f'{src}/js/ORDER').split())
        raise ValueError(m.group(0))

    html = re.sub(r'\{\{(include|json|music|js)(?: ([^}]*))?\}\}', sub, read(f'{src}/index.html'))
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    with open(out, 'w', encoding='utf-8', newline='') as f:
        f.write(html)
    print(f'built {out} ({len(html.encode()) / 1e6:.1f} MB)')


if __name__ == '__main__':
    a = sys.argv[1:]
    main(a[0] if a else 'src', a[1] if len(a) > 1 else 'dist/The-Long-Noon.html')
