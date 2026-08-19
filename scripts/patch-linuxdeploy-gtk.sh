#!/usr/bin/env bash
# Pre-seeds a patched linuxdeploy-plugin-gtk.sh into the Tauri tools cache
# so that bundled Wayland libs (libwayland-*.so*) are removed from the AppImage.
#
# Root cause: linuxdeploy bundles the build host's libwayland-client.so.0 (~1.20).
# On hosts with newer Mesa (Ubuntu 24+, Arch, etc.), Mesa's libEGL loads the
# stale bundled copy instead of the system one, causing EGL_BAD_PARAMETER and
# WebKitWebProcess abort. Removing the bundled libs forces usage of the host's.
# See: https://github.com/tauri-apps/tauri/issues/15665

set -euo pipefail

CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/tauri"
mkdir -p "$CACHE_DIR"

PLUGIN_PATH="$CACHE_DIR/linuxdeploy-plugin-gtk.sh"

# Download the official plugin if not already present
if [ ! -f "$PLUGIN_PATH" ]; then
  echo "Downloading linuxdeploy-plugin-gtk.sh..."
  curl -sL "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-bundler/src/bundle/linux/appimage/linuxdeploy-plugin-gtk.sh" \
    -o "$PLUGIN_PATH"
fi

chmod +x "$PLUGIN_PATH"

# Append cleanup step at the end of the plugin script
cat >> "$PLUGIN_PATH" << 'CLEANUP'

# --- Wayland compat patch ---
# Remove bundled Wayland libs so the host system's version is used at runtime.
# The bundled copies from Ubuntu 22.04 (~1.20) cause EGL_BAD_PARAMETER on
# newer Mesa stacks (Ubuntu 24+, Arch, Fedora, etc.), crashing WebKitWebProcess.
echo "Removing bundled Wayland libraries from AppDir (wayland-compat patch)"
for dir in "$APPDIR/usr/lib" "$APPDIR/usr/lib64" "$APPDIR/usr/lib/x86_64-linux-gnu"; do
  if [ -d "$dir" ]; then
    find "$dir" -maxdepth 1 -name 'libwayland-*.so*' -delete 2>/dev/null || true
  fi
done
# --- End wayland-compat patch ---
CLEANUP

echo "Patched linuxdeploy-plugin-gtk.sh at $PLUGIN_PATH"
