#!/usr/bin/env bash
# appfitly.com dagitimi — Cloudflare Pages (direct upload).
#
# Repo private oldugu icin Pages'in git entegrasyonu YOK: push etmek
# siteyi yayinlamaz, yayinlama bu betikle olur. Sirasi onemli:
# once commit + push, sonra ./deploy.sh
#
# Geri alma: Cloudflare panel > Workers & Pages > appfitly > Deployments
# > eski deployment > "Rollback to this deployment".

set -euo pipefail

cd "$(dirname "$0")"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "UYARI: calisma agacinda commit edilmemis degisiklik var." >&2
  echo "Yayinlanan sey diskteki hali; git'teki hali degil." >&2
  git status --short >&2
  read -r -p "Yine de devam? [e/H] " yanit
  [[ "$yanit" == "e" || "$yanit" == "E" ]] || exit 1
fi

find . -name .DS_Store -not -path "./.git/*" -delete

python3 scripts/check-seo.py

npx wrangler pages deploy . \
  --project-name=appfitly \
  --branch=master \
  --commit-dirty=true

echo
echo "Yayinda: https://appfitly.com"
