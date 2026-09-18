import { access, copyFile, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { createAppPaths } from "../config/paths.js";
export async function restoreBackup(backupDirectory:string):Promise<void>{
 const paths=createAppPaths(), source=resolve(backupDirectory), backupDatabase=join(source,"toni.sqlite");
 await access(backupDatabase,constants.R_OK); await mkdir(join(paths.dataRoot,"database"),{recursive:true}); await copyFile(backupDatabase,paths.databaseFile);
}
const backupDirectory=process.argv[2];
if(process.argv[1]?.endsWith("restore.js")){
 if(!backupDirectory){console.error("Usage: node dist/ops/restore.js <backup-directory>");process.exitCode=2;}
 else restoreBackup(backupDirectory).then(()=>console.log("Backup restored. Start the application and run readiness checks.")).catch((e:unknown)=>{console.error(e instanceof Error?e.message:"Restore failed.");process.exitCode=1;});
}