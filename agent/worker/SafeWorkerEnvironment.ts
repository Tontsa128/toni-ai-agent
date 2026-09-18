const ALLOWED_ENVIRONMENT_KEYS=["PATH","PATHEXT","SystemRoot","WINDIR","TEMP","TMP","USERPROFILE","HOME","LANG","LC_ALL"];
export function buildWorkerEnvironment(source:NodeJS.ProcessEnv=process.env):NodeJS.ProcessEnv {
  const result:NodeJS.ProcessEnv={};
  for(const key of ALLOWED_ENVIRONMENT_KEYS){const value=source[key];if(value!==undefined) result[key]=value;}
  result.TONI_WORKER_PROCESS="1";
  return result;
}