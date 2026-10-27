#!/bin/sh
# «Python 2.7 ΕΠΑΛ» χωρίς εγκατάσταση: ./python2-epal.sh
#
# Σε διανομές που περιορίζουν τα user namespaces (π.χ. Ubuntu 24.04) το sandbox του Chromium χρειάζεται ρύθμιση
# με δικαιώματα διαχειριστή, που την κάνει μόνο η εγκατάσταση με το .deb. Εδώ η εφαρμογή ξεκινά τότε με
# --no-sandbox. Ανοίγει μόνο τα δικά της τοπικά αρχεία (οι σύνδεσμοι ανοίγουν στον browser).
DIR=$(dirname "$(readlink -f "$0")")
restrict=$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)
clone=$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null)
if [ "$restrict" = "1" ] || [ "$clone" = "0" ]; then
  exec "$DIR/python2-epal" --no-sandbox "$@"
fi
exec "$DIR/python2-epal" "$@"
