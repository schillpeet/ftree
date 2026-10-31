#!/usr/bin/env bash
# Fails when a container image is referenced without a sha256 digest: a tag can be moved to another image.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

bad=""

# Compose files and workflows: image: and container: with a plain value; ${{ }} expressions are not images.
yaml=$(git ls-files 'docker-compose*.yml' 'docker-compose*.yaml' '.github/workflows/*.yml' '.github/workflows/*.yaml')
if [ -n "$yaml" ]; then
  bad+=$(echo "$yaml" | xargs grep -nEi '^\s*(-\s*)?(image|container):\s*["'\'']?[a-z0-9]' |
    grep -vE '@sha256:[0-9a-f]{64}["'\'']?\s*(#.*)?$' || true)
fi

# Dockerfiles: every FROM except one that names an earlier build stage.
for f in $(git ls-files '*Dockerfile*'); do
  bad+=$(awk -v f="$f" '
    toupper($1) == "FROM" {
      i = 2
      while ($i ~ /^--/) i++
      img = $i
      if (!(tolower(img) in stages) && img != "scratch" && img !~ /@sha256:[0-9a-f]{64}$/) print f ":" NR ":" $0
      if (toupper($(i + 1)) == "AS") stages[tolower($(i + 2))] = 1
    }' "$f")
done

if [ -n "$bad" ]; then
  echo "Images without a digest (use image:tag@sha256:...; see 'docker buildx imagetools inspect'):"
  echo "$bad"
  exit 1
fi
