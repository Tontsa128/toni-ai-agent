export interface WorkerRequest {
  requestId:string; command:string; args:string[]; cwd:string; timeoutMs:number; maxOutputBytes:number; maxErrorBytes:number;
}
export interface WorkerResponse {
  requestId:string; ok:boolean; exitCode?:number|null; signal?:string|null; stdout?:string; stderr?:string; error?:string;
}