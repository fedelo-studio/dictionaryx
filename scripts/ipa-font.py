"""Rebuilds public/fonts/dico-ipa.woff2, the small phonetics font, after words are added to src/bank.json.

Usage: pip install fonttools brotli, then python3 scripts/ipa-font.py
It downloads Gentium Book Plus (SIL Open Font License) once, keeps only the characters the
phonetics use, and renames the subset, as the licence requires for a modified copy.
"""
import io
import json
import os
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = 'https://raw.githubusercontent.com/google/fonts/main/ofl/gentiumbookplus/GentiumBookPlus-Regular.ttf'
CACHE = os.path.join(ROOT, '.cache', 'GentiumBookPlus-Regular.ttf')

if not os.path.exists(CACHE):
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    urllib.request.urlretrieve(SOURCE, CACHE)

bank = json.load(open(os.path.join(ROOT, 'src', 'bank.json'), encoding='utf-8'))
chars = set('[](), ' + 'diksjɔnaʀiks')
for entry in bank:
    chars.update(entry[2])

options = subset.Options()
options.layout_features = ['*']
options.name_IDs = ['*']
options.name_languages = ['*']
options.notdef_outline = True
options.hinting = False
font = TTFont(CACHE)
subsetter = subset.Subsetter(options)
subsetter.populate(text=''.join(sorted(chars)))
subsetter.subset(font)
for record in font['name'].names:
    if record.nameID in (1, 4, 16, 18, 21):
        record.string = 'Dico IPA'
    elif record.nameID == 6:
        record.string = 'DicoIPA-Regular'
    elif record.nameID == 3:
        record.string = 'Dico IPA Regular, subset for phonetic notation'
    elif record.nameID in (2, 17, 22):
        record.string = 'Regular'
font.flavor = 'woff2'
out = os.path.join(ROOT, 'public', 'fonts', 'dico-ipa.woff2')
os.makedirs(os.path.dirname(out), exist_ok=True)
font.save(out)
print(len(chars), 'characters ->', os.path.getsize(out), 'bytes:', out)
