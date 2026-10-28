#!/usr/bin/env python3
# v0.34.0: maakt van de Shiftbase-templates (Ceintuurbaan) masters met markers voor het HR Dashboard.
# Gebruik: python3 scripts/shiftbase-masters.py   (bron: templates-shiftbase/, doel: netlify/functions/_lib/assets/shiftbase/)
# Markers: [[BV]] [[ADRES]] [[POSTCODE_PLAATS]] [[VERTEGENWOORDIGER]] [[STANDPLAATS]] [[PLAATS]] en één alinea "• [[HUISREGEL]]".
# Vervangen gebeurt per <w:t>, zodat opmaak, tabs en de Shiftbase-velden ({first_name} enz.) onaangeroerd blijven.
import zipfile, re, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRON = os.path.join(ROOT, 'templates-shiftbase')
DOEL = os.path.join(ROOT, 'netlify', 'functions', '_lib', 'assets', 'shiftbase')
MAP = {
  'contract_sla_maker_ceintuurbaan_3.docx': 'nieuw-slamaker',
  'contract_junior_ceintuurbaan_template (1).docx': 'nieuw-junior-sm',
  'contract_senior_ceintuurbaan_1.docx': 'nieuw-sm',
  'contractverlenging_sla_ceintuurbaan.docx': 'verlenging-slamaker',
  'contractverlenging_sla_ceintuurbaan_junior_storemanager.docx': 'verlenging-junior-sm',
  'contractverlenging_sla_ceintuurbaan_storemanager_2.docx': 'verlenging-sm',
  'contract_sla_maker_ceintuurbaan_onbepaalde_tijd.docx': 'onbepaald-slamaker',
}
TXT = re.compile(r'(<w:t(?: [^>]*)?>)([^<]*)(</w:t>)')
PARA = re.compile(r'<w:p[ >].*?</w:p>', re.S)
def tekst(p): return ''.join(m.group(2) for m in TXT.finditer(p))
def vervang_t(s):
  s = re.sub(r'S[lL][aA]\s+Ceintuur\s+(BV|bv)', '[[BV]]', s)
  s = re.sub(r'Ceintuurbaan 149( H)?', '[[ADRES]]', s)
  s = re.sub(r'1072\s*GB\s+Amsterdam', '[[POSTCODE_PLAATS]]', s)
  s = s.replace('standplaats van werknemer is Amsterdam', 'standplaats van werknemer is [[STANDPLAATS]]')
  s = s.replace('getekend te Amsterdam', 'getekend te [[PLAATS]]')
  if 'ilovesla' not in s and '(' not in s: s = s.replace('Jodi Ko', '[[VERTEGENWOORDIGER]]')
  return s
def zet_tekst(p, nieuw):
  eerst = [True]
  def r(m):
    if eerst[0]:
      eerst[0] = False
      o = m.group(1) if 'xml:space' in m.group(1) else m.group(1).replace('<w:t', '<w:t xml:space="preserve"', 1)
      return o + nieuw + m.group(3)
    return m.group(1) + m.group(3)
  return TXT.sub(r, p)
# ---- v0.34.1: teksten gelijktrekken (besluit Mischa 28-10-2026) ----
# Per alinea: de volledige tekst wordt vervangen en in de eerste <w:t> gezet (opmaak binnen de alinea vervalt; tabs/breaks worden geweigerd).
SM = ('nieuw-junior-sm', 'nieuw-sm', 'verlenging-junior-sm', 'verlenging-sm')
MAKER = ('nieuw-slamaker', 'verlenging-slamaker', 'onbepaald-slamaker')
ZES = ' Gedurende de eerste zes maanden heeft werknemer ingevolge artikel 7:628 lid 5 BW alleen recht op loon wanneer hij daadwerkelijk heeft gewerkt.'
BETALING = 'De uitbetaling van het loon vindt plaats rond de 14e van de volgende maand onder verstrekking van een loonstrook. Werknemer geeft hierbij aan werkgever toestemming de opgaven zoals bedoeld in artikel 7.626 BW (loonstrook) en 7.655 BW elektronisch te verstrekken op het opgegeven privé email adres.'
REGELS = [
  # betaling overal rond de 14e van de volgende maand
  (None, r'^De uitbetaling van het loon vindt plaats .*$', BETALING),
  # werktijden overal vanaf 09.00
  (None, r'van 10\.00 tot 22\.00', 'van 09.00 tot 22.00'),
  # 7:628 lid 5 alleen in het eerste (oproep)contract van een Sla maker
  (('verlenging-slamaker', 'onbepaald-slamaker') + SM, r'\s*Gedurende de eerste zes maanden heeft werknemer ingevolge artikel 7:628 lid 5 BW alleen recht op loon wanneer hij daadwerkelijk heeft gewerkt\.', ''),
  # vaste uren: niet "indien opgeroepen"
  (SM, r'Werknemer zal, indien opgeroepen, bij werkgever', 'Werknemer zal bij werkgever'),
  # functie uit Shiftbase in plaats van vaste tekst (verlengingen)
  (None, r'in de functie van (assistent bediening/fastfood|Store manager)\s*\(', 'in de functie van {job_title} ('),
  # functie-indeling: Sla maker A.3.I, Junior SM A.4.I, SM A.5.I
  (MAKER, r'referentienummer\(s\) [AB]\.3\.I', 'referentienummer(s) A.3.I'),
  (('nieuw-junior-sm', 'verlenging-junior-sm'), r'referentienummer\(s\) [AB]\.4\.I', 'referentienummer(s) A.4.I'),
  (('nieuw-sm', 'verlenging-sm'), r'referentienummer\(s\) [AB]\.5\.I', 'referentienummer(s) A.5.I'),
  # Handboek-zin die over twee alinea's was gebroken
  (None, r'in het Handboek$', 'in het Handboek'),
  # maandsalaris gelijk aan het nieuwe contract
  (None, r'per maand\s*\(exclusief vakantietoeslag\) op basis van 38 uur\.?', 'per maand (exclusief vakantietoeslag) op basis van een 38 urige werkweek.'),
  (None, r'tegen en percentage', 'tegen een percentage'),
]
def gelijktrekken(x, key, log):
  def toepas(t):
    for keys, pat, rep in REGELS:
      if keys is None or key in keys: t = re.sub(pat, lambda _m: rep, t)
    return t
  def per_alinea(m):
    p = m.group(0); t0 = tekst(p)
    if not t0.strip(): return p
    # eerst per <w:t> (behoudt opmaak, tabs en regeleinden); alleen als dat niet genoeg is de hele alinea
    p = TXT.sub(lambda mm: mm.group(1) + toepas(mm.group(2)) + mm.group(3), p)
    t = tekst(p); n = toepas(t)
    if t != t0 and n == t: log.append(t0[:60] + ' -> ' + t[:60]); return p
    if n == t: return p
    if '<w:tab/>' in p or '<w:br' in p: raise SystemExit(key + ': alinea met tab/break niet automatisch aan te passen: ' + t[:80])
    log.append(t[:60] + ' -> ' + n[:60])
    return zet_tekst(p, n.replace('&', '&amp;') if '&amp;' not in n else n)
  return PARA.sub(per_alinea, x)

# Verlengingen hadden geen huisregels-bijlage terwijl het contract ernaar verwijst: bijlage achteraan toevoegen
def bijlage(x):
  m = None
  for mm in PARA.finditer(x):
    if 'Binnen de onderneming van de werkgever zijn huisregels' in tekst(mm.group(0)): m = mm
  if not m: raise SystemExit('geen huisregel-artikel gevonden voor de bijlage')
  basis = m.group(0)
  def met(t, vet=False):
    q = zet_tekst(basis, t)
    return q.replace('<w:rPr><w:rtl w:val="0"/></w:rPr><w:t', '<w:rPr><w:b/><w:rtl w:val="0"/></w:rPr><w:t', 1) if vet else q
  blok = ('<w:p><w:r><w:br w:type="page"/></w:r></w:p>' + met('HUISREGELS SLA', True)
          + met('We hebben er niet heel veel, maar de huisregels die we hebben vinden we ook echt heel belangrijk. Wat zijn de huisregels ook alweer?')
          + met('• [[HUISREGEL]]'))
  i = x.rfind('<w:sectPr')
  if i < 0 or x.find('</w:body>', i) < 0: raise SystemExit('geen sectPr')
  return x[:i] + blok + x[i:]

def verwerk(x, key):
  x = TXT.sub(lambda m: m.group(1) + vervang_t(m.group(2)) + m.group(3), x)
  log = []
  x = gelijktrekken(x, key, log)
  paras = [(m.start(), m.end(), m.group(0)) for m in PARA.finditer(x)]
  bul = [i for i, (_, _, p) in enumerate(paras) if tekst(p).lstrip().startswith('•')]
  if not bul:
    if key.startswith('verlenging'): x = bijlage(x)
    return x, -len(log)
  a, b = bul[0], bul[-1]
  sjabloon = zet_tekst(paras[a][2], '• [[HUISREGEL]]')
  # alles tussen eerste en laatste bullet (bullets, lege regels, logo midden in de lijst) wordt één marker-alinea
  return x[:paras[a][0]] + sjabloon + x[paras[b][1]:], len(log)
os.makedirs(DOEL, exist_ok=True)
fout = 0
for bron, key in MAP.items():
  zin = zipfile.ZipFile(os.path.join(BRON, bron))
  uit = os.path.join(DOEL, key + '.docx')
  with zipfile.ZipFile(uit, 'w', zipfile.ZIP_DEFLATED) as zo:
    for it in zin.infolist():
      data = zin.read(it.filename)
      if it.filename == 'word/document.xml':
        x, n = verwerk(data.decode('utf-8'), key)
        rest = [w for w in ('Ceintuur', '1072', 'Jodi Ko', 'Amsterdam', 'Apprendo') if w in tekst(x)]
        mk = sorted(set(re.findall(r'\[\[[A-Z_]+\]\]', tekst(x))))
        print('%-24s wijzigingen=%2d markers=%s %s' % (key, n, ' '.join(mk), ('REST: ' + ','.join(rest)) if rest else ''))
        if rest: fout += 1
        data = x.encode('utf-8')
      zo.writestr(it, data)
sys.exit(1 if fout else 0)
