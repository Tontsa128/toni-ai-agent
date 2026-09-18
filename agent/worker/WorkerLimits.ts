export interface WorkerLimits { timeoutMs:number; maxOutputBytes:number; maxErrorBytes:number; maxProcesses:number; maxMemoryMb:number; }
export const DEFAULT_WORKER_LIMITS: WorkerLimits = { timeoutMs:30000,maxOutputBytes:1048576,maxErrorBytes:262144,maxProcesses:16,maxMemoryMb:512 };
export function validateWorkerLimits(limits:WorkerLimits):void {
  if(!Number.isInteger(limits.timeoutMs)||limits.timeoutMs<100||limits.timeoutMs>300000) throw new Error("Worker timeout must be between 100 and 300000 ms.");
  if(!Number.isInteger(limits.maxOutputBytes)||limits.maxOutputBytes<1024) throw new Error("Worker output limit is invalid.");
  if(!Number.isInteger(limits.maxErrorBytes)||limits.maxErrorBytes<1024) throw new Error("Worker error limit is invalid.");
  if(!Number.isInteger(limits.maxProcesses)||limits.maxProcesses<1) throw new Error("Worker process limit is invalid.");
  if(!Number.isInteger(limits.maxMemoryMb)||limits.maxMemoryMb<64) throw new Error("Worker memory limit is invalid.");
}