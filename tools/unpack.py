#!/usr/bin/env python3
"""Split a single-file "The Long Noon" HTML build into an editable source tree.

    python3 tools/unpack.py path/to/The-Long-Noon-offline.html [src]

Everything that was inlined comes back out as a real file:
  css/fonts.css + assets/fonts/*.woff2   (the @font-face block)
  css/style.css                          (the game's stylesheet)
  data/*.json                            (map, dialogue, quests, pages, battles, sprite manifest)
  assets/img/*.png                       (sprite atlases referenced by data/manifest.json)
  assets/music/*.mp3                     (the three music tracks)
  vendor/three.min.js                    (three.js r128, unmodified)
  js/NN-section.js                       (the game script, split at its own section banners)
  index.html                             (the page skeleton with {{include ...}} markers)

tools/build.py reverses this and reproduces the original file byte for byte.
"""
import base64, json, os, re, shutil, sys

SRC_JSON = {  # <script id=...> -> data file
    'asset-manifest': 'data/manifest.json', 'data-map': 'data/map.json', 'data-dialogue': 'data/dialogue.json',
    'data-quests': 'data/quests.json', 'data-pages': 'data/pages.json', 'data-battles': 'data/battles.json',
}
EXT = {'font/woff2': 'woff2', 'image/png': 'png', 'audio/mpeg': 'mp3'}


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:40] or 'part'


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if isinstance(data, bytes):
        with open(path, 'wb') as f:
            f.write(data)
    else:
        with open(path, 'w', encoding='utf-8', newline='') as f:
            f.write(data)


def pretty(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2) + '\n'


def main(html_path, out):
    html = open(html_path, encoding='utf-8', newline='').read()
    if os.path.isdir(out):
        shutil.rmtree(out)
    blocks = list(re.finditer(r'<(script|style)([^>]*)>(.*?)</\1>', html, re.S))
    skel, pos, styles, scripts = [], 0, 0, 0
    for m in blocks:
        tag, attrs, body = m.group(1), m.group(2), m.group(3)
        skel.append(html[pos:m.start(3)])
        pos = m.end(3)
        sid = re.search(r'id="([^"]+)"', attrs)
        sid = sid.group(1) if sid else None
        if tag == 'style':
            if '@font-face' in body and styles == 0:
                n = {}
                def font(fm):
                    fam = re.findall(r"font-family:'([^']+)'", body[:fm.start()])[-1]
                    wt = re.findall(r'font-weight:(\d+)', body[:fm.start()])[-1]
                    name = f"{slug(fam)}-{wt}.{EXT[fm.group(1)]}"
                    write(f'{out}/assets/fonts/{name}', base64.b64decode(fm.group(2)))
                    return f'url(../assets/fonts/{name})'
                css = re.sub(r'url\(data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)\)', font, body)
                write(f'{out}/css/fonts.css', css)
                skel.append('{{include css/fonts.css}}')
            else:
                write(f'{out}/css/style.css', body)
                skel.append('{{include css/style.css}}')
            styles += 1
        elif sid in SRC_JSON:
            obj = json.loads(body)
            if sid == 'asset-manifest':
                for k, uri in obj['images'].items():
                    mt, b64 = re.match(r'data:([\w/+.-]+);base64,(.*)', uri, re.S).groups()
                    rel = f'assets/img/{k}.{EXT[mt]}'
                    write(f'{out}/{rel}', base64.b64decode(b64))
                    obj['images'][k] = '../' + rel
            write(f'{out}/{SRC_JSON[sid]}', pretty(obj))
            skel.append('{{json ' + SRC_JSON[sid] + '}}')
        elif sid == 'music-data':
            obj = json.loads(body)
            for k, b64 in obj.items():
                write(f'{out}/assets/music/{k}.mp3', base64.b64decode(b64))
            skel.append('{{music ' + ' '.join(obj) + '}}')
        elif scripts == 0 and 'three.js' in body[:200]:
            write(f'{out}/vendor/three.min.js', body)
            skel.append('{{include vendor/three.min.js}}')
            scripts += 1
        else:
            # The game script: one big IIFE. Split it at its own "/* ==== name ==== */" banners;
            # the pieces are NOT standalone modules, build.py just concatenates them in order.
            cuts = [0] + [mm.start() for mm in re.finditer(r'^/\* =+ .*? =+ \*/', body, re.M)] + [len(body)]
            names = []
            for i in range(len(cuts) - 1):
                part = body[cuts[i]:cuts[i + 1]]
                title = re.match(r'/\* =+ (.*?)[:(]', part) or re.match(r'/\* =+ (.*?) =+', part)
                name = f'{i:02d}-{slug(title.group(1)) if title else "header"}.js'
                write(f'{out}/js/{name}', part)
                names.append(name)
            write(f'{out}/js/ORDER', '\n'.join(names) + '\n')
            skel.append('{{js}}')
            scripts += 1
        skel.append('')
    skel.append(html[pos:])
    write(f'{out}/index.html', ''.join(skel))
    print(f'unpacked {html_path} -> {out}/')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'src')
