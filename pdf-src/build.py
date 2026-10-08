"""Génère les fiches de cours PDF de WILLSIM avec Chrome headless.

    pdf-src/<slug>.html  ->  assets/pdf/willsim-<slug>.pdf

Usage (depuis n'importe quel dossier) :
    python pdf-src/build.py                       # toutes les fiches (fichiers sans « _ » initial)
    python pdf-src/build.py ros2-premiers-pas     # une ou plusieurs fiches (slug ou slug.html)
    python pdf-src/build.py _template --out DIR   # test : écrit dans DIR au lieu d'assets/pdf

Chaque exécution utilise un profil Chrome temporaire unique : plusieurs builds
peuvent tourner en parallèle. Variable d'environnement CHROME pour un autre chemin.
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from pypdf import PdfReader, PdfWriter

SRC = Path(__file__).resolve().parent
OUT = SRC.parent / "assets" / "pdf"
CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
EXPECTED_FONTS = ("DMSans", "Manrope")


def fonts_in(reader):
    """Noms des polices embarquées (sans le préfixe de sous-ensemble ABCDEF+)."""
    names = set()
    for page in reader.pages:
        fonts = (page.get("/Resources") or {}).get("/Font") or {}
        for ref in fonts.values():
            base = str(ref.get_object().get("/BaseFont", ""))
            names.add(base.lstrip("/").split("+")[-1])
    return names


def build(slug, out_dir):
    src = SRC / (slug + ".html")
    if not src.is_file():
        raise SystemExit("Source introuvable : %s" % src)
    pdf = out_dir / ("willsim-%s.pdf" % slug)
    if pdf.exists():
        pdf.unlink()
    profile = tempfile.mkdtemp(prefix="willsim-chrome-")
    try:
        result = subprocess.run(
            [CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
             "--no-first-run", "--no-default-browser-check", "--disable-extensions",
             "--user-data-dir=" + profile, "--virtual-time-budget=10000",
             "--print-to-pdf=" + str(pdf), src.as_uri()],
            capture_output=True, timeout=180)
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    if not pdf.is_file():
        raise SystemExit("Échec de Chrome pour %s :\n%s" % (slug, result.stderr.decode(errors="replace")[-2000:]))

    reader = PdfReader(str(pdf))
    writer = PdfWriter(clone_from=reader)
    writer.add_metadata({"/Author": "Équipe pédagogique WILLSIM",
                         "/Subject": "Fiche de cours gratuite WILLSIM — Licence CC BY-NC-SA 4.0",
                         "/Creator": "WILLSIM — pdf-src/build.py"})
    with open(pdf, "wb") as fh:
        writer.write(fh)
    pages = len(reader.pages)
    size_ko = round(pdf.stat().st_size / 1024)
    print("%s : %d pages, %d Ko  ->  %s" % (slug, pages, size_ko, pdf))
    fonts = fonts_in(reader)
    missing = [f for f in EXPECTED_FONTS if not any(n.startswith(f) for n in fonts)]
    if missing:
        print("  ATTENTION : police(s) non embarquée(s) %s ; polices trouvées : %s"
              % (", ".join(missing), ", ".join(sorted(fonts))), file=sys.stderr)
    if not slug.startswith("_") and "{{" in src.read_text(encoding="utf-8"):
        print("  ATTENTION : marqueurs {{...}} non remplacés dans %s" % src.name, file=sys.stderr)
    return pages, size_ko


def main():
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Génère les fiches PDF WILLSIM.")
    parser.add_argument("slugs", nargs="*", help="slug(s) à générer ; tous par défaut")
    parser.add_argument("--out", type=Path, default=OUT, help="dossier de sortie (défaut : assets/pdf)")
    args = parser.parse_args()

    slugs = [s[:-5] if s.endswith(".html") else s for s in args.slugs]
    if not slugs:
        slugs = sorted(p.stem for p in SRC.glob("*.html") if not p.name.startswith("_"))
    if not slugs:
        raise SystemExit("Aucune fiche à générer dans %s" % SRC)
    args.out.mkdir(parents=True, exist_ok=True)
    for slug in slugs:
        build(slug, args.out.resolve())


if __name__ == "__main__":
    main()
