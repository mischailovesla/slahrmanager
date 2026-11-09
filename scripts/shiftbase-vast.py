#!/usr/bin/env python3
# v0.47.5: Sla maker-templates met VASTE UREN, afgeleid van de oproep-masters (nieuw / verlenging / onbepaald).
# Gebruik: python3 scripts/shiftbase-vast.py  → schrijft netlify/functions/_lib/assets/shiftbase/<soort>-vast.docx
# Vervangt alleen hele zinnen binnen één <w:t>; elke vervanging moet precies het verwachte aantal keer voorkomen.
import zipfile, io, os, sys, re
MAP = os.path.join(os.path.dirname(__file__), '..', 'netlify', 'functions', '_lib', 'assets', 'shiftbase')
WERKTIJDEN_OUD = 'Werknemer houdt zich beschikbaar om van 09.00 tot 22.00 werkzaam te kunnen zijn voor werkgever. Werkgever zal werknemer tenminste 4 dagen voor het begin van de werkzaamheden oproepen. Werknemer is verplicht aan een oproep door werkgever gehoor te geven.'
WERKTIJDEN_NIEUW = ('De overeengekomen arbeidsduur bedraagt gemiddeld {weekly_working_hours} uur per week. Werknemer werkt volgens een rooster dat werkgever tijdig bekendmaakt, '
    'op werktijden tussen 09.00 en 22.00 uur, met inachtneming van de CAO Horeca en de Arbeidstijdenwet. Werkt werknemer op verzoek van werkgever meer uren dan de '
    'overeengekomen arbeidsduur, dan worden deze meeruren uitbetaald tegen het uurloon zoals vermeld bij het artikel Salaris.')
GEMEEN = [
    (WERKTIJDEN_OUD, WERKTIJDEN_NIEUW, 1),
    ('Werknemer zal, indien opgeroepen, bij werkgever', 'Werknemer zal bij werkgever', 1),
    ('per gewerkt uur', 'per uur', 1),
]
PER = {
    'nieuw-slamaker': [
        ('Contract Sla maker', 'Contract Sla maker (vaste uren)', 1),
        ('is met ingang van {start_date} beschikbaar voor het verrichten van werkzaamheden voor werkgever.', 'treedt met ingang van {start_date} in dienst van werkgever.', 1),
        (' Gedurende de eerste zes maanden heeft werknemer ingevolge artikel 7:628 lid 5 BW alleen recht op loon wanneer hij daadwerkelijk heeft gewerkt.', '', 1),
    ],
    'verlenging-slamaker': [
        ('Overeenkomst tot verlenging arbeidsovereenkomst Sla', 'Overeenkomst tot verlenging arbeidsovereenkomst Sla (vaste uren)', 1),
    ],
    'onbepaald-slamaker': [
        ('Contract Sla maker', 'Contract Sla maker (vaste uren)', 1),
    ],
}
fout = 0
for bron, extra in PER.items():
    zin = zipfile.ZipFile(os.path.join(MAP, bron + '.docx'))
    xml = zin.read('word/document.xml').decode('utf8')
    for oud, nieuw, n in GEMEEN + extra:
        oud_x = oud.replace('&', '&amp;'); nieuw_x = nieuw.replace('&', '&amp;')
        if xml.count(oud_x) >= n:   # staat binnen één <w:t>: eerste voorkomen vervangen
            xml = xml.replace(oud_x, nieuw_x, n); continue
        # verspreid over meerdere runs: de hele alinea herschrijven als één run (opmaak van de eerste run)
        gedaan = False
        for m in re.finditer(r'<w:p[ >](?:(?!<w:p[ >]).)*?</w:p>', xml, re.S):
            par = m.group(0); runs = re.findall(r'<w:r[ >].*?</w:r>', par, re.S)
            tekst = ''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', par))
            if oud_x not in tekst: continue
            rpr = re.search(r'<w:rPr>.*?</w:rPr>', runs[0], re.S) if runs else None
            nieuwe_run = '<w:r>' + (rpr.group(0) if rpr else '') + '<w:t xml:space="preserve">' + tekst.replace(oud_x, nieuw_x, 1) + '</w:t></w:r>'
            eerste = par.find(runs[0]); laatste = par.rfind(runs[-1]) + len(runs[-1])
            par2 = par[:eerste] + nieuwe_run + par[laatste:]
            xml = xml[:m.start()] + par2 + xml[m.end():]; gedaan = True; break
        if not gedaan: print('✗', bron, 'niet gevonden:', oud[:70]); fout += 1
    if '{weekly_working_hours}' not in xml: print('✗', bron, 'geen {weekly_working_hours}'); fout += 1
    uit = io.BytesIO(); zout = zipfile.ZipFile(uit, 'w', zipfile.ZIP_DEFLATED)
    for item in zin.infolist(): zout.writestr(item, xml.encode('utf8') if item.filename == 'word/document.xml' else zin.read(item.filename))
    zout.close()
    open(os.path.join(MAP, bron + '-vast.docx'), 'wb').write(uit.getvalue())
    print('✓', bron + '-vast.docx')
sys.exit(1 if fout else 0)
