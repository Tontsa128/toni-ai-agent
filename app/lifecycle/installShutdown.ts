import type { Server } from "node:http";
import type { ApplicationContext } from "../bootstrap/createApplication.js";

export function installShutdown(server: Server, application: ApplicationContext): void {
  let stopping = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    application.state.setPhase("stopping");
    application.cancellation.clear();
    await application.windowsJob?.terminate().catch(() => {});
    await new Promise<void>(resolve => {
      let finished = false;
      const finish = () => { if (finished) return; finished = true; resolve(); };
      server.close(finish);
      setTimeout(finish, 5000);
    });
    try { application.auditRepository.append({ type: "session_ended", message: "Application stopped by " + signal + "." }); } catch {}
    application.database.close();
    await application.processLock.release().catch(() => {});
    application.state.setPhase("stopped");
  };
  process.once("SIGINT", () => { void shutdown("SIGINT"); });
  process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
}
