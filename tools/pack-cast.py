"""Pack each PixelLab figure (assets/cast/<id>/character/) into one sprite sheet the game imports.

    python3 tools/pack-cast.py            # every figure made so far
    python3 tools/pack-cast.py juno kit

Writes src/assets/cast/<id>.png and src/assets/cast/cast.json:
- row 0: the still figure in all eight directions: south, east, north, west, then the diagonals
  (the battle cameras look from any side; play uses the first four);
- then one row per animation and direction, in the order the meta lists them
  (four directions: south, east, north, west; a figure without west plays east mirrored).
Every cell is the figure's canvas size (64 × 64). Spec §13.3: one sheet per figure, not hundreds of files.
"""
import json
import os
import re
import sys

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'assets/cast')
OUT = os.path.join(ROOT, 'src/assets/cast')
CAST = json.load(open(os.path.join(ROOT, 'tools/cast.json')))['cast']
STILL = ['south', 'east', 'north', 'west', 'south-east', 'north-east', 'north-west', 'south-west']
# PixelLab's folder names for its templates, where they differ from the template's own name
FOLDER = {'breathing-idle': 'idle', 'walking': 'walk', 'running': 'run', 'fight-stance-idle': 'stance', 'throw-object': 'throw',
          'taking-a-punch': 'hurt', 'falling-backward': 'down', 'drinking': 'drink'}
FPS = {'idle': 5, 'walk': 11, 'run': 14, 'stance': 8, 'attack': 12, 'throw': 12, 'hurt': 10, 'down': 10, 'drink': 8}


def frames_in(d):
    """The frames of one direction of one animation, in order."""
    fs = [f for f in os.listdir(d) if f.endswith('.png')]
    return [os.path.join(d, f) for f in sorted(fs, key=lambda f: int(re.findall(r'\d+', f)[-1]) if re.findall(r'\d+', f) else 0)]


def names_for(char):
    """Our names for PixelLab's animation folders: PixelLab files an animation under its template (or its
    text), not the name we asked for, so map them back through the request records in prompt.json."""
    p = os.path.join(os.path.dirname(char), 'prompt.json')
    anims = json.load(open(p)).get('anims', {}) if os.path.exists(p) else {}
    out = {}
    for name, info in anims.items():
        body = info.get('body', {})
        for key in (body.get('template_animation_id'), body.get('action_description'), name):
            if key:
                out[re.sub(r'[^a-z0-9]+', '-', key.lower()).strip('-')] = name
    return out


def animations(char):
    """{name: {dir: [frame paths]}}, by our names (idle, walk, run, stance, attack, ...)."""
    out = {}
    root = os.path.join(char, 'animations')
    if not os.path.isdir(root):
        return out
    known = names_for(char)
    for folder in sorted(os.listdir(root)):
        p = os.path.join(root, folder)
        if not os.path.isdir(p):
            continue
        slug = re.sub(r'[^a-z0-9]+', '-', folder.lower()).strip('-')
        name = FOLDER.get(slug) or known.get(slug) or next((n for k, n in known.items() if k and (slug.startswith(k) or k.startswith(slug))), None)
        if not name:
            name = FOLDER.get(slug) or ('walk' if 'walk' in slug else 'idle' if ('idle' in slug or 'breath' in slug) else slug)
        dirs = {d: frames_in(os.path.join(p, d)) for d in os.listdir(p) if os.path.isdir(os.path.join(p, d))}
        dirs = {d: f for d, f in dirs.items() if f}
        if dirs:
            out[name] = dirs
    return out


def pack(cid):
    char = os.path.join(SRC, cid, 'character')
    rot = {d: Image.open(os.path.join(char, 'rotations', f'{d}.png')).convert('RGBA') for d in STILL}
    W, H = rot['south'].size
    anims = animations(char)
    rows = [('still', None, [rot[d] for d in STILL])]
    meta = {'w': W, 'h': H, 'still': {d: [0, i] for i, d in enumerate(STILL)}, 'anims': {}}
    for name, dirs in anims.items():
        info = {'fps': FPS.get(name, 6), 'rows': {}, 'frames': 0}
        for d in ['south', 'east', 'north', 'west', 'south-east', 'north-east', 'south-west', 'north-west']:
            if d not in dirs:
                continue
            ims = [Image.open(f).convert('RGBA') for f in dirs[d]]
            info['rows'][d] = len(rows)
            info['frames'] = max(info['frames'], len(ims))
            rows.append((name, d, ims))
        meta['anims'][name] = info
    cols = max(len(r[2]) for r in rows)
    sheet = Image.new('RGBA', (cols * W, len(rows) * H), (0, 0, 0, 0))
    for y, (_, _, ims) in enumerate(rows):
        for x, im in enumerate(ims):
            # an animation canvas bigger than the figure's is cropped about its centre
            if im.size != (W, H):
                l, t = (im.width - W) // 2, (im.height - H) // 2
                im = im.crop((l, t, l + W, t + H))
            sheet.alpha_composite(im, (x * W, y * H))
    os.makedirs(OUT, exist_ok=True)
    sheet.save(os.path.join(OUT, f'{cid}.png'), optimize=True)
    return meta


def main():
    ids = sys.argv[1:] or [c for c in CAST if os.path.isdir(os.path.join(SRC, c, 'character'))]
    path = os.path.join(OUT, 'cast.json')
    allm = json.load(open(path)) if os.path.exists(path) else {}
    for cid in ids:
        allm[cid] = pack(cid)
        a = allm[cid]['anims']
        print(cid, 'still', *(f'{n}: {len(v["rows"])} dirs × {v["frames"]}' for n, v in a.items()))
    json.dump(dict(sorted(allm.items())), open(path, 'w'), indent=1)


if __name__ == '__main__':
    main()
