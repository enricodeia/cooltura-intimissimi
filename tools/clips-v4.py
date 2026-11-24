#!/usr/bin/env python3
"""V4's clip library, for the panel's video picker.

  python3 tools/clips-v4.py
    → public/media/v4/clips.json   every clip: who, which campaign, with or without her voice, its poster, its words
                                   (the transcript inside the clip) and (voiced clips) the sentences it contains,
                                   all in clip seconds
    → public/media/thumbs/<key>.jpg  a poster per clip (216 × 384)
    → public/media/cuts.json       + the hard cuts inside the v4 clips (the v3 keys are left as they are)

The sentences come from the local Whisper transcripts of the sources (media-src/tx, word timestamps), cut by
tools/media-v4.sh's table (the v4 clips) and tools/media.sh's (the v3 proxies, their sound by
tools/media-v3-audio.sh): same start for picture and sound. A sentence is offered only when it is entirely inside
the clip, and its window starts and ends where the voice does in the clip's own .m4a, not where Whisper's word
times say (they often cut the last syllable): see natural(). The lines tuned by ear for the film come first
(CURATED); their windows only widen to the natural start and end, the old numbers stay in wFrom / wTo; a line
picked without numbers gets the natural window of the words that say it.
"""
import glob, json, math, os, re, subprocess, sys, unicodedata
from array import array
from itertools import accumulate
from operator import mul

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MEDIA = os.path.join(ROOT, 'public/media')
TX = os.path.join(ROOT, 'media-src/tx')

# ------------------------------------------------------------------ the tables (tools/media-v4.sh, tools/media.sh)
rows = []
for line in open(os.path.join(ROOT, 'tools/media-v4.sh'), encoding='utf8'):
    m = re.match(r'\s*"([a-z0-9-]+)\|([^|]+)\|([^|]+)\|([0-9.]+)\|([0-9.]+)"', line)
    if m:
        rows.append({'slug': m[1], 'folder': m[2], 'file': m[3], 'start': float(m[4]), 'dur': float(m[5])})
# the v3 proxies: slug|folder|file|start|feed, the hero cut from HERO's row; LEAD (tools/media-v3-audio.sh) = the
# proxies whose picture runs ahead of their source, their sound (and so their clip time 0) starts that much later
V3, HERO, LEAD = {}, None, {}
for line in open(os.path.join(ROOT, 'tools/media.sh'), encoding='utf8'):
    m = re.match(r'\s*"([a-z0-9-]+)\|([^|]+)\|([^|]+)\|([0-9.]+)\|([01])"', line)
    if m:
        V3[m[1]] = {'slug': m[1], 'folder': m[2], 'file': m[3], 'start': float(m[4])}
    m = re.match(r'HERO="([a-z0-9-]+)"', line)
    if m:
        HERO = m[1]
for line in open(os.path.join(ROOT, 'tools/media-v3-audio.sh'), encoding='utf8'):
    m = re.match(r'\s*"([a-z0-9-]+)\|([0-9.]+)"', line)
    if m:
        LEAD[m[1]] = float(m[2])

NAMES = {
    'open-sara': 'Sara Tibo', 'hero-alice': 'Alice Muzza', 'hero-chiara': 'Chiara Chelo', 'comm-corinne': 'Corinne Pino',
    'venice-chiara': 'Chiara Chelo', 'venice-duo': 'Chiara Chelo', 'venice-walk': 'Jingherly e amiche', 'venice-gemels': 'Le Gemels',
    'venice-cuccuru': 'Francesca Cuccuru', 'venice-dance': 'Rebecca Maurino · la festa', 'venice-rebecca': 'Rebecca Maurino',
    'aria-asia': 'Asia Busciantella', 'aria-aurora': 'Aurora Pederzoli', 'aria-giulia': 'Giulia Romanelli', 'aria-noemi': 'Noemi Piunti',
    'aria-rebecca': 'Rebecca Maurino', 'aria-alessia': 'Alessia Morelli', 'aria-parente': 'Chiara Parente',
    'venice-terrace': 'Rebecca Maurino · terrazza', 'venice-aurora': 'Aurora',
}
CAMPAIGN = {'ARIA': 'Aria', 'NUDE LOOK': 'Nude Look', 'ULTRALIGHT WITH CASHMERE': 'Ultralight', 'ESTERNABILITÀ': 'Esternabilità'}
CAMP_OF_PREFIX = {'aria': 'Aria', 'nude': 'Nude Look', 'ul': 'Ultralight', 'ext': 'Esternabilità'}

# the windows tuned by ear (clip seconds): first in the list, with their second window when a pause is cut out
CURATED = {
    'hero-alice': [(1.3, 3.28, 'Per me la parola d’ordine è comodità.')],
    'hero-chiara': [(1.98, 5.68, 'Con questo reggiseno io due volte mi sono dimenticata di averlo addosso.')],
    'comm-corinne': [(0.5, 4.39, 'Io, non scherzo, ci dormo anche con questo reggiseno per quanto è comodo.')],
    # the end: the last "e" of "donne" runs into the "E" that opens her next sentence (one vowel) down to the
    # dip at 5.08 (−34 dB): cut there, never in the middle of the vowel (2026-11-24, the brief's "voice cut" at Venice)
    'venice-chiara': [(0.5, 2.58, 'È stata una serata stupenda per celebrare le donne.', 3.77, 5.09)],
    'venice-rebecca': [(1.5, 3.26, 'Sentirsi confident fa davvero la differenza.')],
    'venice-terrace': [(0.26, 3.66, 'Io mi sentivo completamente un’altra persona. Mi sentivo proprio confidente, sexy.'), (1.92, 3.66, 'Mi sentivo proprio confidente, sexy.')],
    'aria-alessia': [(1.33, 5.86, 'È comodissimo, una seconda pelle: non ci pensi che ce l’hai.')],
    'aria-parente': [(0.42, 5.1, 'Come vedete, tutta un’altra cosa: non si vede niente, è come se non avessi reggiseno.')],
    # lines picked for the film without numbers (None, None, text): the words that say it, given their natural window
    # (v3 slugs: the grid and feed proxies of a source share them; a line the clip does not hold whole is left out)
    'aria-aurora-pederzoli': [(None, None, 'Il reggiseno giusto può farti tutto l’outfit.')],  # the wheel's protagonist
}
# sentences that start in the middle of a thought, or that are not her voice: not offered
SKIP = {
    'aria-alessia': ('Di scollature',),
    'aria-clean-look': ('But she', 'Its the way'),
    # English trend-audio lines laid over the videos, not the creators' own voices
    'aria-chiara-chelo-spark': ('But my tits',),
    'ul-sofia-greggi': ('Traffic was crazy',),  # NO TESTI: the song's lyrics (Whisper unsure all along, lp -0.99)
}
NOT_SPEECH = {'musica'}  # what Whisper writes for a music bed
# what Whisper hears wrong, and the brand's names
FIX = [(r'\bomerò\b', 'amerò'), (r'\baria di intimissimi\b', 'Aria di Intimissimi'), (r'\breggiseno aria\b', 'reggiseno Aria'), (r'\bintimissimi\b', 'Intimissimi')]
FILLERS = {'cioè', 'ecco', 'allora', 'comunque', 'quindi', 'e', 'ma', 'beh', 'raga', 'ragazzi', 'vabbè', 'anyway', 'ok', 'ok?'}


def nfc(s):
    return unicodedata.normalize('NFC', s or '')


def norm(name):
    """A source's name without what copying adds ('Copy of ', ' (1)', the extension), case and accents."""
    s = nfc(name).lower().strip()
    s = re.sub(r'^copy of\s+', '', s)
    while re.search(r'\.(mov|mp4|m4v)$', s):
        s = s[:-4]
    s = re.sub(r'\s*\(\d+\)', '', s)
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '', s)


def load_tx():
    by_file, by_norm = {}, {}
    for f in sorted(glob.glob(os.path.join(TX, '*.json'))):
        d = json.load(open(f, encoding='utf8'))
        by_file[(nfc(d.get('campaign')), nfc(d.get('file')))] = d
        by_norm.setdefault((nfc(d.get('campaign')), norm(d.get('file'))), d)
        by_norm.setdefault(('*', norm(d.get('file'))), []).append(d)
    return by_file, by_norm


def tx_of(txs, folder, file):
    """The transcript of a source: same folder and name, else the same name in that folder once 'Copy of', ' (1)'
    and the extension are dropped (the folders hold copies: TikTok_Jingherly.mov = TikTok_Jingherly(1).mov), else
    the one source of that name in another folder."""
    by_file, by_norm = txs
    d = by_file.get((nfc(folder), nfc(file))) or by_norm.get((nfc(folder), norm(file)))
    if d:
        return d
    any_ = by_norm.get(('*', norm(file)), [])
    return any_[0] if len(any_) == 1 else None


def tokens(text):
    return re.findall(r'[0-9a-zà-öø-ÿ]+', nfc(text).lower())


def clean(w):
    return w.strip().replace("'", '’')


def join_words(ws):
    s = ''
    for w in ws:
        t = clean(w['w'])
        if s and not t.startswith('’') and not s.endswith('’'):
            s += ' '
        s += t
    s = s.replace(' ,', ',').replace(' .', '.')
    for a, b in FIX:
        s = re.sub(a, b, s, flags=re.I)
    s = s[:1].upper() + s[1:]
    if s and s[-1] not in '.?!…':
        s = s.rstrip(',;:') + '.'
    return s


def words_of(tx):
    """The words Whisper is sure are speech (segments with a low no-speech probability, not its 'Musica' tag),
    source seconds."""
    if not tx:
        return []
    return [w for s in tx['segments'] if s.get('nsp', 0) < 0.6 and ' '.join(tokens(s.get('text', ''))) not in NOT_SPEECH for w in s['words']]


# ------------------------------------------------------------------ where the voice really starts and stops
HOP = 0.01  # s, one envelope value every 10 ms
FLOOR_DB = 28  # under the speech level: the voice has stopped
QUIET = 8  # frames (80 ms) the sound must stay under it


def envelope(m4a):
    """The clip's own sound (mono) as RMS in dB, one value every 10 ms (frame k is 20 ms centred on k × 10 ms),
    and its length in seconds."""
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', m4a, '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'])
    x = array('f')
    x.frombytes(raw)
    if sys.byteorder == 'big':
        x.byteswap()
    cs = [0.0, *accumulate(map(mul, x, x))]
    hop = 480
    out = []
    for k in range(len(x) // hop + 1):
        lo, hi = max(0, (k - 1) * hop), min(len(x), (k + 1) * hop)
        out.append(10 * math.log10((cs[hi] - cs[lo]) / max(1, hi - lo) + 1e-12))
    return out, len(x) / 48000


def speech_level(env, spans):
    """The voice's level in a sentence: the 90th percentile of the envelope over its words."""
    v = sorted(env[k] for a, b in spans for k in range(max(0, round(a / HOP)), min(len(env), round(b / HOP) + 1)))
    return v[min(len(v) - 1, int(0.9 * len(v)))] if v else -30.0


PROMINENCE_DB = 4  # a valley between two words: the sound falls at least this much into it and rises as much out of it
ONSET_DB = 5  # the same before a word's start (a firmer dip: a tuned start only moves on clear evidence)


VOICE_DB = 12  # within this of the speech level: a word's body (under it: a tail, a dip, a pause)


TROUGH_DB = 18  # this far under the speech level: between two words, even without a pause


def start_of(env, s0, e0, prev_s, prev_e, thr, level):
    """Where the first word [s0, e0] (Whisper) of a window really starts.
      - the sound at s0 is under the floor (Whisper starts in the pause): forward to where the voice rises over it;
      - else walking back from s0 (at most 0.15 s, never into the previous word's start): the first frame over the
        floor (the voice rises out of a pause), or out of a trough TROUGH_DB under the speech, or, when the previous
        word runs into it, the valley between the two;
      - nothing, and s0 still sits in the previous word's tail (Whisper starts early: the sound at s0 is already a
        tail, or Whisper ends the previous word less than 0.1 s before): forward (at most 0.2 s), the dip the word
        rises out of, to the voice's level within 0.1 s.
    A forward onset never passes the first word's end - 0.03 (the word would be lost). (onset, how): 'quiet' |
    'valley' | 'after' | 'none' (s0 - 0.15, as Whisper leaves it) | 'clip' (the clip's first frame is reached with
    the sound still up: the clip cuts into the word)."""
    n = len(env)
    k0 = max(0, min(n - 1, round(s0 / HOP)))
    kmax = min(n - 1, round(min(s0 + 0.3, e0 - 0.03) / HOP))
    if env[k0] < thr:
        for k in range(k0 + 1, kmax + 1):
            if env[k] >= thr:
                return k * HOP, 'quiet'
        return s0, 'quiet'
    lo = max(0, round(max(s0 - 0.15, prev_s) / HOP))
    peak = max(env[k0:min(n, k0 + 11)])  # the word's own onset, just after s0
    kv, k = k0, k0
    while k - 1 >= lo:
        k -= 1
        if env[k] < thr or (env[k] <= level - TROUGH_DB and peak - env[k] >= ONSET_DB):
            return (k + 1) * HOP, 'quiet'
        if env[k] < env[kv]:
            kv = k
        elif env[k] >= env[kv] + ONSET_DB and peak - env[kv] >= ONSET_DB:
            return kv * HOP, 'valley'
    if lo == 0 and s0 - 0.15 <= 0:
        return 0.0, 'clip'
    if env[k0] < level - VOICE_DB or s0 - prev_e < 0.1:
        kv = k0
        for k in range(k0 + 1, min(n, k0 + 21)):
            if env[k] < env[kv]:
                kv = k
            elif env[k] >= env[kv] + ONSET_DB and max(env[kv:min(n, kv + 11)]) >= level - VOICE_DB:
                j = kv
                while env[kv] < thr and j + 1 < k and env[j + 1] < thr:  # out of a pause: its last quiet frame
                    j += 1
                t = (j + (1 if env[kv] < thr else 0)) * HOP
                if t <= e0 - 0.03:
                    return t, 'after'
                break
    return max(0.0, s0 - 0.15), 'none'


def end_of(env, dur, ref, next_s, next_e, thr):
    """Where the voice really stops after ref (Whisper's end of the last word, or a tuned end), at most 0.45 s on.
    Walking forward from ref: where the sound has stayed under the floor for 80 ms (the 72 ms fade-out that ends
    there falls in the quiet). Before that quiet, when the next word follows without a pause: the valley between
    the two, a dip the sound falls into and rises out of by PROMINENCE_DB. Whisper's next word [next_s, next_e] is
    as early as its word ends, so it only bounds the valleys (from 0.05 s before Whisper's boundary, the later of ref
    and next_s, up to next_s + 0.25 and never past the middle of the next word: most of it would be heard) and ranks
    them: the deepest, 1 dB per 10 ms away from the boundary. (t >= ref, 'quiet' | 'valley'), or None when neither."""
    n = len(env)
    H = min(ref + 0.45, dur - 0.05)
    hi = min(H, next_s + 0.25, (next_s + next_e) / 2)
    b = max(ref, next_s)
    k, kh = max(0, round(ref / HOP)), min(n - 1, math.floor(hi / HOP + 1e-6))
    quiet = None
    while k <= kh:
        if all(env[i] < thr for i in range(k, min(n, k + QUIET))):
            quiet = k
            break
        k += 1
    kl = max(0, round((b - 0.05) / HOP))
    if quiet is not None:
        kl = max(kl, round(ref / HOP) + 1)  # a pause follows: a dip before ref is inside the last word
    ke = quiet if quiet is not None else kh
    best = None
    for k in range(max(1, kl), min(ke, n - 2) + 1):
        if env[k] > env[k - 1] or env[k] > env[k + 1]:
            continue
        fall = max(env[max(0, kl - 10):k + 1]) - env[k]
        rise = max(env[k:min(n, kh + 6)]) - env[k]
        if fall >= PROMINENCE_DB and rise >= PROMINENCE_DB:
            score = env[k] + 100 * abs(k * HOP - b)
            if best is None or score < best[0]:
                best = (score, k)
    if best:
        return max(ref, best[1] * HOP), 'valley'
    if quiet is not None:
        return max(ref, min(quiet * HOP + QUIET * HOP, H)), 'quiet'
    return None


def natural(env, dur, s0, e0, e1, prev_s, prev_e, next_s, next_e, level):
    """A window [s0 = first word's start, e1 = last word's end] (clip seconds, Whisper; e0 = the first word's end;
    the words around it: previous [prev_s, prev_e], next [next_s, next_e]) moved to the voice, with the floor =
    speech level (90th percentile over its words) - 28 dB:
      from = max(previous word's end + 0.02, start_of() - 0.03), never before the clip's start;
      to   = end_of() from e1: never before e1, at most 0.45 s after it, before the clip's end - 0.05; when the
             sound gives no answer (no quiet, no valley), Whisper's own bound: the next word's start - 0.03.
    Returns (from, to, how the end was found) or None when the clip cuts the voice (she is still speaking at its
    end, or already speaking at its start with no pause before the first word): such a sentence is not offered."""
    thr = level - FLOOR_DB
    if e1 > dur - 0.05:
        return None
    e = end_of(env, dur, e1, next_s, next_e, thr)
    if not e:
        if next_s - 0.03 >= dur - 0.05:  # no next word inside the clip: the clip ends while she still speaks
            return None
        e = (max(e1, min(e1 + 0.45, next_s - 0.03)), 'next')
    onset, how_s = start_of(env, s0, e0, prev_s, prev_e, thr, level)
    if how_s == 'clip':  # the clip starts while she is already speaking
        return None
    f = max(prev_e + 0.02, onset - 0.03, 0.0)
    t, how = e
    if f >= t:
        return None
    return round(f, 2), min(round(t, 2), math.floor((dur - 0.05) * 100 + 1e-6) / 100), how


def phrases_of(row, tx, env):
    """Sentences entirely inside [start, start + dur]: each sentence, sentences without a leading filler, two in a row."""
    if not tx or env is None:
        return []
    a, b = row['start'], row['start'] + row['dur']
    words = words_of(tx)
    # sentences: split after . ? ! (and at a segment's end)
    sents, cur = [], []
    seg_ends = {id(s['words'][-1]) for s in tx['segments'] if s['words']}
    for w in words:
        cur.append(w)
        t = w['w'].strip()
        if t.endswith(('.', '?', '!')) or id(w) in seg_ends:
            sents.append(cur)
            cur = []
    if cur:
        sents.append(cur)
    all_words = words
    pos = {id(w): i for i, w in enumerate(all_words)}

    def window(ws):
        i0 = pos[id(ws[0])]
        i1 = pos[id(ws[-1])]
        prev = all_words[i0 - 1] if i0 > 0 else {'s': -1, 'e': -1}
        nxt = all_words[i1 + 1] if i1 + 1 < len(all_words) else {'s': 1e9, 'e': 1e9}
        f = max(ws[0]['s'] - 0.05, prev['e'] + 0.02)
        t = min(ws[-1]['e'] + 0.1, nxt['s'] - 0.02)
        return f, t, prev, nxt

    out = []

    def add(ws, bonus=0):
        if not ws:
            return
        f, t, prev, nxt = window(ws)
        if f < a + 0.02 or t > b - 0.02 or t - f < 1.0 or t - f > 5.6:
            return
        nat = natural(env, row['dur'], ws[0]['s'] - a, ws[0]['e'] - a, ws[-1]['e'] - a, prev['s'] - a, prev['e'] - a, nxt['s'] - a, nxt['e'] - a,
                      speech_level(env, [(ws[0]['s'] - a, ws[-1]['e'] - a)]))
        if not nat:
            return
        end = ws[-1]['w'].strip().endswith(('.', '?', '!')) or id(ws[-1]) in seg_ends
        d = t - f
        score = bonus + (2 if end else 0) + (1 if 1.6 <= d <= 4.4 else 0)
        out.append({'from': nat[0], 'to': nat[1], 'text': join_words(ws), 'wFrom': round(f - a, 2), 'wTo': round(t - a, 2), 'score': score, 'how': nat[2]})

    # units: a sentence, cut at its commas when it is long; a phrase = 1 to 3 units in a row
    units = []
    for s in sents:
        if s[-1]['e'] - s[0]['s'] <= 4.2:
            units.append(s)
            continue
        cur = []
        for w in s:
            cur.append(w)
            if w['w'].strip().endswith((',', ';', ':')):
                units.append(cur)
                cur = []
        if cur:
            units.append(cur)
    for i in range(len(units)):
        run = []
        for j in range(i, min(len(units), i + 3)):
            run = run + units[j]
            add(run, 1 if j == i and units[i] in sents else 0)
            if len(run) > 2 and clean(run[0]['w']).lower().strip(',') in FILLERS:
                add(run[1:])
    # unique, the best 6, in clip order
    seen, uniq = set(), []
    for p in sorted(out, key=lambda p: (-p['score'], p['wFrom'], p['wTo'])):
        k = (p['wFrom'], p['wTo'])
        if k not in seen and len(uniq) < 6:
            seen.add(k)
            uniq.append(p)
    for p in uniq:
        p.pop('score', None)
    return sorted(uniq, key=lambda p: (p['from'], p['to']))


def words_of_text(words, a, text, wins):
    """The run of transcript words that says `text` (its tokens in order; up to 3 words of the transcript it leaves
    out, like a 'praticamente'), the one nearest the tuned windows; split into the windows (a word goes to the
    window its middle falls in, or is nearest to). None when Whisper says it otherwise."""
    want = tokens(text)
    toks = [tokens(w['w']) for w in words]
    best = None
    for i in range(len(words)):
        if not toks[i] or toks[i][0] != want[0]:
            continue
        q, j, skipped = 0, i, 0
        while j < len(words) and q < len(want) and skipped <= 3:
            t = toks[j]
            if t and want[q:q + len(t)] == t:
                q += len(t)
            elif t:
                skipped += 1
            j += 1
        if q == len(want):
            d = abs(words[i]['s'] - a - wins[0][0]) + abs(words[j - 1]['e'] - a - wins[-1][1])
            if best is None or d < best[0]:
                best = (d, i, j)
    if not best:
        return None
    out = [[] for _ in wins]
    for k in range(best[1], best[2]):
        if not toks[k]:
            continue
        mid = (words[k]['s'] + words[k]['e']) / 2 - a
        out[min(range(len(wins)), key=lambda x: 0 if wins[x][0] <= mid <= wins[x][1] else min(abs(mid - wins[x][0]), abs(mid - wins[x][1])))].append(k)
    return out


def curated_of(row, tx, env, cur):
    """A window tuned by ear, given the natural start and end too: its words are the run of the transcript that says
    its text (else the ones whose middle falls in it; one or two windows). It only widens, and only where the sound
    shows it: the start is the earlier of the tuned and the natural one (when start_of() finds where it rises);
    the end walks on from the tuned end to the quiet or the valley end_of() finds (a tuned end often cuts the last
    syllable), else stays. The tuned numbers stay in wFrom / wTo (wFrom2 / wTo2). A line without numbers gets the
    natural window of its words (wFrom / wTo: Whisper's). None when the clip does not hold the line."""
    a = row['start']
    words = words_of(tx)
    if cur[0] is None:  # no numbers: the words that say it, inside the clip, given their natural window
        w = (words_of_text(words, a, cur[2], [(0, row['dur'])]) or [[]])[0]
        if env is None or not w or words[w[0]]['s'] - a < 0 or words[w[-1]]['e'] - a > row['dur']:
            return None
        i0, i1 = w[0], w[-1]
        prev = words[i0 - 1] if i0 > 0 else {'s': a - 1, 'e': a - 1}
        nxt = words[i1 + 1] if i1 + 1 < len(words) else {'s': a + 1e9, 'e': a + 1e9}
        s0, e1 = words[i0]['s'] - a, words[i1]['e'] - a
        nat = natural(env, row['dur'], s0, words[i0]['e'] - a, e1, prev['s'] - a, prev['e'] - a, nxt['s'] - a, nxt['e'] - a, speech_level(env, [(s0, e1)]))
        if not nat:
            return None
        return {'from': nat[0], 'to': nat[1], 'text': cur[2], 'tuned': True,
                'wFrom': round(max(s0 - 0.05, prev['e'] - a + 0.02), 2), 'wTo': round(min(e1 + 0.1, nxt['s'] - a - 0.02), 2), 'how': nat[2]}
    if cur[1] > row['dur'] - 0.05 or (len(cur) > 3 and cur[4] > row['dur'] - 0.05):
        return None
    tuned = [(cur[0], cur[1])] + ([(cur[3], cur[4])] if len(cur) > 3 else [])
    wins = words_of_text(words, a, cur[2], tuned) or [[i for i, w in enumerate(words) if f <= (w['s'] + w['e']) / 2 - a <= t] for f, t in tuned]
    spans = [(words[w[0]]['s'] - a, words[w[-1]]['e'] - a) for w in wins if w]
    p = {'from': cur[0], 'to': cur[1], 'text': cur[2], **({'from2': cur[3], 'to2': cur[4]} if len(cur) > 3 else {}), 'tuned': True}
    if env is None or not all(wins):
        return p
    level = speech_level(env, spans)
    thr = level - FLOOR_DB
    got = []
    for w, (f0, t0) in zip(wins, tuned):
        i0, i1 = w[0], w[-1]
        prev = words[i0 - 1] if i0 > 0 else {'s': a - 1, 'e': a - 1}
        nxt = words[i1 + 1] if i1 + 1 < len(words) else {'s': a + 1e9, 'e': a + 1e9}
        onset, how_s = start_of(env, words[i0]['s'] - a, words[i0]['e'] - a, prev['s'] - a, prev['e'] - a, thr, level)
        f = max(prev['e'] - a + 0.02, onset - 0.03, 0.0) if how_s in ('quiet', 'valley', 'after') else f0
        e = end_of(env, row['dur'], t0, nxt['s'] - a, nxt['e'] - a, thr)
        t = min(round(e[0], 2), math.floor((row['dur'] - 0.05) * 100 + 1e-6) / 100) if e else t0
        got.append((min(f0, round(f, 2)), max(t0, t), e[1] if e and t > t0 else 'tuned'))
    q = {'from': got[0][0], 'to': got[0][1], 'text': cur[2]}
    if len(got) > 1:
        q.update({'from2': max(got[1][0], got[0][1]), 'to2': got[1][1]})
    q.update({'tuned': True, 'wFrom': cur[0], 'wTo': cur[1]})
    if len(got) > 1:
        q.update({'wFrom2': cur[3], 'wTo2': cur[4]})
    q['how'] = got[0][2]
    return q


def words_in(row, tx):
    """Every word of the transcript inside the clip [0, dur], clip seconds (the panel shows them under In / Out)."""
    a, d = row['start'], row['dur']
    out = []
    for w in words_of(tx):
        s, e = w['s'] - a, w['e'] - a
        if s >= -0.005 and e <= d + 0.005:
            t = clean(w['w'])
            for x, y in FIX:
                t = re.sub(x, y, t, flags=re.I)
            out.append({'w': t, 's': round(max(0.0, s), 2), 'e': round(min(d, e), 2)})
    return out


def probe_dur(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).decode().strip())


def thumb(key, at):
    src = os.path.join(MEDIA, key)
    dst = os.path.join(MEDIA, 'thumbs', key[:-4] + '.jpg')
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return 'thumbs/' + key[:-4] + '.jpg'
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{max(0, at):.2f}', '-i', src, '-frames:v', '1', '-vf', 'scale=216:384:flags=lanczos', '-q:v', '4', dst], check=True)
    return 'thumbs/' + key[:-4] + '.jpg'


def cuts_of(path):
    log = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-vf', "select='gt(scene,0.25)',showinfo", '-an', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return [round(float(x), 3) for x in re.findall(r'pts_time:([0-9.]+)', log)]


def pretty(slug):
    parts = slug.split('-')
    camp = CAMP_OF_PREFIX.get(parts[0])
    if camp:
        parts = parts[1:]
    spark = 'spark' in parts
    name = ' '.join(p.capitalize() for p in parts if p != 'spark')
    return (name + (' · Spark' if spark else '')), camp


def voiced(key, row, tx):
    """(has its .m4a, the sentences, the words) of a clip: row = {start (clip time 0 in the source), dur, slug}."""
    m4a = os.path.join(MEDIA, key[:-4] + '.m4a')
    has_audio = os.path.exists(m4a)
    env, r = None, row
    if has_audio and tx:
        env, secs = envelope(m4a)
        r = {**row, 'dur': min(row['dur'], secs)}  # the sentences fit the sound (a hair shorter than the picture at most)
    ph = phrases_of(r, tx, env)
    cur = [p for p in (curated_of(r, tx, env, c) for c in CURATED.get(row['slug'], [])) if p]
    known = [(p.get('wFrom', p['from']), p.get('wTo', p['to'])) for p in cur]
    ph = cur + [p for p in ph if all(abs(p['wFrom'] - k[0]) > 0.15 or abs(p['wTo'] - k[1]) > 0.15 for k in known) and not p['text'].startswith(SKIP.get(row['slug'], ('\0',)))]
    return has_audio, ph, words_in(row, tx) if tx else []


def main():
    txs = load_tx()
    manifest = json.load(open(os.path.join(MEDIA, 'manifest.json')))
    cuts = json.load(open(os.path.join(MEDIA, 'cuts.json'))) if os.path.exists(os.path.join(MEDIA, 'cuts.json')) else {}
    lib, how = {}, {}
    for r in rows:
        key = f"v4/{r['slug']}.mp4"
        path = os.path.join(MEDIA, key)
        if not os.path.exists(path):
            print('  missing', key, file=sys.stderr)
            continue
        dur = round(manifest.get(key) or probe_dur(path), 3)
        has_audio, ph, words = voiced(key, {**r, 'dur': dur}, tx_of(txs, r['folder'], r['file']))
        at = ph[0]['from'] + 0.5 if ph else min(1.0, r['dur'] / 3)
        cuts[key] = cuts_of(path)
        how[key] = [p.pop('how', None) for p in ph]
        lib[key] = {
            'name': NAMES.get(r['slug'], r['slug']),
            'campaign': CAMPAIGN.get(r['folder'], r['folder']),
            'voice': has_audio and bool(ph),
            'audio': has_audio,
            'dur': dur,
            'source': {'file': r['file'], 'start': r['start']},
            'phrases': ph,
            'thumb': thumb(key, at),
            'words': words,
        }
        print(f"  {key}: {len(ph)} frasi, tagli {cuts[key]}")
    # the v3 proxies of the four folders (the creators' own edits), with their own sound (tools/media-v3-audio.sh)
    for key in sorted(k for k in manifest if k.startswith(('v3/grid/', 'v3/feed/')) or k == 'v3/hero.mp4'):
        slug = key.rsplit('/', 1)[1][:-4]
        name, camp = pretty(slug) if key != 'v3/hero.mp4' else ('Alice Muzza', 'Aria')
        dur = manifest[key]
        v = V3.get(HERO if key == 'v3/hero.mp4' else slug)
        e = {'name': name, 'campaign': camp or '', 'voice': False, 'audio': False, 'dur': dur}
        ph, words = [], []
        if v:
            start = round(v['start'] + LEAD.get(v['slug'], 0), 3)
            has_audio, ph, words = voiced(key, {**v, 'start': start, 'dur': dur}, tx_of(txs, v['folder'], v['file']))
            how[key] = [p.pop('how', None) for p in ph]
            e.update({'voice': has_audio and bool(ph), 'audio': has_audio, 'source': {'file': v['file'], 'start': start}})
        lib[key] = {**e, 'phrases': ph, 'thumb': thumb(key, min(1.2, dur / 3)), 'words': words}
    text = json.dumps(lib, ensure_ascii=False, indent=1)
    # one line per word
    text = re.sub(r'\{\n\s+("w": [^\n]*),\n\s+("s": [^\n]*),\n\s+("e": [^\n]*)\n\s+\}', r'{\1, \2, \3}', text)
    with open(os.path.join(MEDIA, 'v4/clips.json'), 'w', encoding='utf8') as f:
        f.write(text)
    json.dump(cuts, open(os.path.join(MEDIA, 'cuts.json'), 'w'), separators=(',', ':'))
    n = lambda pre, f: sum(1 for k, v in lib.items() if k.startswith(pre) and f(v))
    for pre in ('v4/', 'v3/'):
        print(f"  {pre}: {n(pre, lambda v: True)} clips, {n(pre, lambda v: v['audio'])} with their sound, {n(pre, lambda v: v['voice'])} with a voice ({n(pre, lambda v: len(v['phrases']) > 0)} with sentences)")
    ends = [h for hs in how.values() for h in hs if h]
    print('  sentence ends:', {h: ends.count(h) for h in sorted(set(ends))},
          '(quiet: the voice stops; valley: the dip before the next word; next: no answer from the sound, Whisper\'s next start - 0.03; tuned: kept)')
    print('clips.json:', len(lib), 'clips,', sum(1 for v in lib.values() if v['voice']), 'with a voice')


if __name__ == '__main__':
    main()
