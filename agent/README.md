# Agent subsystems

`core/` plans and orchestrates work.
`approvals/` handles human approval gates.
`providers/` contains model-provider adapters and context construction.
`memory/` will store non-secret project and preference memory.

No subsystem may bypass the permission engine.
