# Toni Windows Job Object helper

The helper attaches a worker PID to a Windows Job Object and remains alive until stdin receives `terminate` or the helper exits. The job uses kill-on-close, active-process, job-memory and per-process user CPU-time limits.

Build on Windows:
cmake -S native/windows-job -B native/windows-job/build
cmake --build native/windows-job/build --config Release

Production startup must validate the helper as an absolute executable inside the trusted installation directory.