#!/bin/bash

git pull

# Update and upgrade packages
apt update -y && apt upgrade -y

# Install ffmpeg
apt install -y ffmpeg

# Ensure tmpfs is available (commonly pre-installed)
apt install -y util-linux

# Create the directory and set permissions
mkdir -p /memory_cache
chmod 1777 /memory_cache # Ensure it's world-writable for tmpfs

# Mount the tmpfs directory
mount -t tmpfs -o size=2G tmpfs /memory_cache

# Convert video using ffmpeg
ffmpeg -y -i src/lib/assets/test_video.mp4 -pix_fmt yuv420p src/lib/assets/test_video.y4m

# Copy the files to /memory_cache
cp src/lib/assets/test_video.y4m /memory_cache/
cp src/lib/assets/test_audio.wav /memory_cache/

# Set the environment variable
export CUSTOM_ASSETS_FOLDER="/memory_cache"

npm install

# Run npm start dev
npm start dev
