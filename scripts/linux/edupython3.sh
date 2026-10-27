#!/bin/sh
# «EduPython3» χωρίς εγκατάσταση: ./edupython3.sh
#
# Σε διανομές που περιορίζουν τα user namespaces (π.χ. Ubuntu 24.04) το sandbox του Chromium χρειάζεται ρύθμιση
# με δικαιώματα διαχειριστή, που την κάνει μόνο η εγκατάσταση με το .deb. Εδώ η εφαρμογή ξεκινά τότε με
# --no-sandbox. Ανοίγει μόνο τα δικά της τοπικά αρχεία (οι σύνδεσμοι ανοίγουν στον browser).
DIR=$(dirname "$(readlink -f "$0")")
restrict=$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)
clone=$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null)
if [ "$restrict" = "1" ] || [ "$clone" = "0" ]; then
  exec "$DIR/edupython3" --no-sandbox "$@"
fi
exec "$DIR/edupython3" "$@"
