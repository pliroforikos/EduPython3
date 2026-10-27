#!/usr/bin/env python3
"""
Δημιουργεί όλα τα εικονίδια της EduPython3 (icon.png, icon.ico) σε όλα τα απαιτούμενα μεγέθη:
  - build/icon.png (256x256)
  - src/renderer/icon.png (256x256)
  - build/icon.ico (16, 24, 32, 48, 64, 128, 256)
"""
import os
import subprocess
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD_DIR = os.path.join(ROOT, 'build')
RENDERER_DIR = os.path.join(ROOT, 'src', 'renderer')
RENDER_JS = os.path.join(ROOT, 'scripts', 'render-icon.js')
SRC_512 = os.path.join(BUILD_DIR, 'icon_512.png')

print("1. Render SVG σε 512x512 PNG μέσω Electron...")
cmd = ['npx.cmd' if os.name == 'nt' else 'npx', 'electron', RENDER_JS]
subprocess.run(cmd, cwd=ROOT, check=True)

if not os.path.exists(SRC_512):
    print("Σφάλμα: δεν δημιουργήθηκε το", SRC_512)
    sys.exit(1)

print("2. Δημιουργία PNG 256x256 και ICO όλων των μεγεθών...")
im512 = Image.open(SRC_512)

# 256x256 PNG
im256 = im512.resize((256, 256), Image.Resampling.LANCZOS)
im256.save(os.path.join(BUILD_DIR, 'icon.png'), 'PNG')
im256.save(os.path.join(RENDERER_DIR, 'icon.png'), 'PNG')
print("  - build/icon.png (256x256)")
print("  - src/renderer/icon.png (256x256)")

# Multi-resolution ICO
sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
ico_path = os.path.join(BUILD_DIR, 'icon.ico')
im256.save(ico_path, format='ICO', sizes=sizes)
print(f"  - build/icon.ico {sizes}")

# Έλεγχος μεγεθών στο αποθηκευμένο ICO
im_check = Image.open(ico_path)
print("  Επαλήθευση μεγεθών ICO:", getattr(im_check, 'ico').sizes())
im_check.close()

# Καθαρισμός προσωρινού 512
os.remove(SRC_512)
print("Ολοκληρώθηκε με επιτυχία!")
