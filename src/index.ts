import { runMain } from "./main.ts";

void runMain().catch(() => {
  process.stderr.write("Scherzo Run failed [result_projection_failed].\n");
  process.exitCode = 1;
});
