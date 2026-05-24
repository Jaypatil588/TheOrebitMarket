#!/usr/bin/env sh
# Prepare local dev: free project ports and clear Next.js cache.

for port in 3000 3001; do
  lsof -ti :"$port" 2>/dev/null | xargs kill -TERM 2>/dev/null || true
done

rm -rf .next

echo "Dev environment prepared (ports 3000/3001 cleared, .next removed)."
