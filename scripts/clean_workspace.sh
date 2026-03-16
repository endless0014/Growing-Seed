#!/usr/bin/env bash
set -euo pipefail

echo "Cleaning workspace (preserving .apk files)..."
BACKUP_DIR="$(mktemp -d)"

# Helper: preserve any apk folders under a build path
preserve_apks() {
  local build_dir="$1"
  if [ -d "$build_dir/outputs/apk" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$build_dir")/outputs"
    cp -a "$build_dir/outputs/apk" "$BACKUP_DIR/$(dirname "$build_dir")/outputs/" || true
    echo "  preserved APKs from $build_dir/outputs/apk"
  fi
}

# Target common Android build dirs while preserving apk outputs
preserve_apks "android/build"
preserve_apks "android/app/build"

# Remove build directories safely (we'll restore apk outputs afterwards)
if [ -d "android/build" ]; then
  echo "Removing android/build (except outputs will be restored)..."
  rm -rf android/build || true
fi

if [ -d "android/app/build" ]; then
  echo "Removing android/app/build (except outputs will be restored)..."
  rm -rf android/app/build || true
fi

# Recreate outputs and restore APKs
if [ -d "$BACKUP_DIR/android/build/outputs/apk" ]; then
  mkdir -p android/build/outputs
  cp -a "$BACKUP_DIR/android/build/outputs/apk" android/build/outputs/
  echo "Restored APKs to android/build/outputs/apk"
fi

if [ -d "$BACKUP_DIR/android/app/build/outputs/apk" ]; then
  mkdir -p android/app/build/outputs
  cp -a "$BACKUP_DIR/android/app/build/outputs/apk" android/app/build/outputs/
  echo "Restored APKs to android/app/build/outputs/apk"
fi

# Remove Gradle caches (safe to recreate on next build)
echo "Removing .gradle caches (may be recreated on build)..."
rm -rf android/.gradle android/app/.gradle .gradle || true

# Remove common ephemeral and cache directories
echo "Removing Python/__pycache__, .ipynb_checkpoints, .pytest_cache and other caches..."
find . -type d -name "__pycache__" -prune -exec rm -rf {} + 2>/dev/null || true
find . -type d -name ".ipynb_checkpoints" -prune -exec rm -rf {} + 2>/dev/null || true
find . -type d -name ".pytest_cache" -prune -exec rm -rf {} + 2>/dev/null || true
find . -type d -name ".cache" -prune -exec rm -rf {} + 2>/dev/null || true

# Skipping automatic notebook output cleanup to avoid accidental data loss.
# If you want to clear outputs from notebooks, run a manual command such as:
# find notebooks -type f -name "*.ipynb" -exec jupyter nbconvert --ClearOutputPreprocessor.enabled=True --inplace {} \;
# (requires jupyter and nbconvert available in the environment)

# Remove stray .log files at repo root and common places
echo "Removing *.log files under build and root-level logs..."
find . -type f -name "*.log" -not -path "./android/build/outputs/apk/*" -delete 2>/dev/null || true

# Final report
echo "Cleanup complete. Backup of preserved APKs is at: $BACKUP_DIR"
echo "Note: APKs preserved and restored. You can remove the backup if everything looks good."

exit 0
