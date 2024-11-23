#!/bin/bash

docker stop $(docker ps -q)

docker pull mcr.microsoft.com/playwright:v1.49.0-noble

# docker run -it --privileged --rm -p 5173:5173 --ipc=host --tmpfs /tmp --tmpfs /var/log --tmpfs /var/run mcr.microsoft.com/playwright:v1.49.0-noble /bin/bash

docker run -itd --privileged --rm -p 5173:5173 --ipc=host --tmpfs /tmp --tmpfs /var/log --tmpfs /var/run mcr.microsoft.com/playwright:v1.49.0-noble /bin/bash -c "
    bash <(curl -fsSL https://raw.githubusercontent.com/sbcarp/chime-meeting-virtual-attendee/refs/heads/main/start.sh)
"
