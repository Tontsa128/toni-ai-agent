# Security Boundaries

The central supervisor is the execution policy boundary. Direct tool execution, unrestricted child-process creation, raw computer actions and external side effects must not bypass it. Workers are the process-execution boundary. The workspace boundary is the filesystem boundary. Authentication is the HTTP boundary. Approval state is the human-control boundary.