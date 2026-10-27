#!/bin/bash
# Εγκατάσταση της Python 2.7 για το «Python 2.7 ΕΠΑΛ» σε Ubuntu, Linux Mint, Debian και παρόμοιες διανομές.
#
#   sudo bash install-python27.sh            από τη διανομή, αν υπάρχει· αλλιώς από τον κώδικα της python.org
#   sudo bash install-python27.sh --source   πάντα από τον κώδικα (π.χ. για να υπάρχει Tkinter)
#
# 1. Όπου η διανομή έχει ακόμα την Python 2.7 (π.χ. Ubuntu 22.04, Linux Mint 21), εγκαθίσταται από εκεί:
#    /usr/bin/python2.7. Το Tkinter (πακέτο python-tk) υπάρχει μόνο σε παλιότερες διανομές.
# 2. Αλλιώς (π.χ. Ubuntu 24.04, Linux Mint 22, Debian 12) η Python 2.7.18 χτίζεται από τον επίσημο κώδικα
#    της python.org και εγκαθίσταται στο /opt/python2.7, μαζί με Tkinter και sqlite3. Θέλει λίγα λεπτά.
#
# Και στις δύο περιπτώσεις η εφαρμογή βρίσκει μόνη της την Python 2.7.
set -e

VERSION=2.7.18
SHA256=da3080e3b488f648a3d7a4560ddee895284c3380b11d6de75edb986526b9a814
PREFIX=/opt/python2.7

if [ "$(id -u)" != 0 ]; then
  echo "Χρειάζονται δικαιώματα διαχειριστή. Τρέξε:  sudo bash $0 $*"
  exit 1
fi

has_tk() { "$1" -c 'import Tkinter' >/dev/null 2>&1; }

apt-get update

if [ "$1" != "--source" ] && apt-cache show python2.7 >/dev/null 2>&1; then
  apt-get install -y python2.7
  apt-get install -y python-tk >/dev/null 2>&1 || true
  if has_tk /usr/bin/python2.7; then
    echo "Έτοιμο: /usr/bin/python2.7 (με Tkinter)"
  else
    echo "Έτοιμο: /usr/bin/python2.7 (χωρίς Tkinter: η διανομή δεν έχει πακέτο python-tk)."
    echo "Για προγράμματα με Tkinter:  sudo bash $0 --source"
  fi
  exit 0
fi

echo "Η Python $VERSION θα χτιστεί από τον κώδικα της python.org και θα εγκατασταθεί στο $PREFIX."
apt-get install -y build-essential wget ca-certificates tk-dev libsqlite3-dev zlib1g-dev libbz2-dev libffi-dev
# προαιρετικά: χωρίς αυτά λείπουν μόνο δευτερεύουσες βιβλιοθήκες της Python
for p in libreadline-dev libncurses-dev libgdbm-dev libexpat1-dev; do
  apt-get install -y "$p" >/dev/null 2>&1 || true
done

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"
wget -q "https://www.python.org/ftp/python/$VERSION/Python-$VERSION.tgz"
echo "$SHA256  Python-$VERSION.tgz" | sha256sum -c --quiet
tar xzf "Python-$VERSION.tgz"
cd "Python-$VERSION"
echo "Ρύθμιση…"
./configure --prefix="$PREFIX" --enable-unicode=ucs4 >configure.log 2>&1 || { tail -20 configure.log; exit 1; }
echo "Χτίσιμο (λίγα λεπτά)…"
make -j"$(nproc)" >make.log 2>&1 || { tail -30 make.log; exit 1; }
make altinstall >install.log 2>&1 || { tail -30 install.log; exit 1; }

if has_tk "$PREFIX/bin/python2.7"; then
  echo "Έτοιμο: $PREFIX/bin/python2.7 (με Tkinter)"
else
  echo "Έτοιμο: $PREFIX/bin/python2.7 (χωρίς Tkinter)"
fi
