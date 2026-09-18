import { access, copyFile, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { createAppPaths } from "../config/paths.js";
export async function restoreBackup(dir:string):Promise<void>{const p=createAppPaths();const db=join(resolve(dir),"toni.sqlite");await access(db,constants.R_OK);await mkdir(join(p.dataRoot,"database"),{recursive:true});await copyFile(db,p.databaseFile);}
const d=process.argv[2];if(process.argv[1]?.endsWith("restore.js")){if(!d){console.error("Usage: node dist/ops/restore.js <backup-directory>");process.exitCode=2;}else restoreBackup(d).then(()=>console.log("Backup restored. Start the application and run readiness checks.")).catch((e:unknown)=>{console.error(e instanceof Error?e.message:"Restore failed.");process.exitCode=1;});}