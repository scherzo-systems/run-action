import { bootstrapCli, type BootstrapResult } from "./bootstrap.ts";
import { AdapterError, asAdapterError } from "./errors.ts";
import {
  allocateExecution,
  cleanupExecution,
  runWorkflow,
  type ExecutionAllocation,
  type WorkflowProcessResult,
} from "./execution.ts";
import { emptyOutputs, writeOutputs, type ActionOutputs } from "./github.ts";
import {
  committedIdentity,
  recoverDurableRun,
  recoverRunDirectory,
  type RecoveredRun,
  type ResultIdentity,
} from "./identity.ts";
import { readActionInputs, type ActionInputs } from "./inputs.ts";
import {
  validateAndProject,
  type SelectedProjection,
  type ValidatedResultProjection,
} from "./result.ts";
import {
  readTerminalEnvelope,
  validateTerminalShape,
  type TerminalEnvelope,
} from "./terminal.ts";

export interface ActionDependencies {
  readonly bootstrap: (
    environment: NodeJS.ProcessEnv,
  ) => Promise<BootstrapResult>;
  readonly readInputs: (
    environment: NodeJS.ProcessEnv,
  ) => Promise<ActionInputs>;
  readonly allocate: (
    runnerTemp: string | undefined,
    prompt: string | undefined,
  ) => Promise<ExecutionAllocation>;
  readonly execute: (
    executable: string,
    inputs: ActionInputs,
    allocation: ExecutionAllocation,
    environment: NodeJS.ProcessEnv,
  ) => Promise<WorkflowProcessResult>;
  readonly readTerminal: (file: string) => Promise<TerminalEnvelope>;
  readonly recover: (
    executable: string,
    allocation: ExecutionAllocation,
    environment: NodeJS.ProcessEnv,
  ) => Promise<RecoveredRun | undefined>;
  readonly project: (
    executable: string,
    identity: ResultIdentity,
    selectedExport: string | undefined,
    environment: NodeJS.ProcessEnv,
  ) => Promise<ValidatedResultProjection>;
  readonly writeOutputs: (
    outputFile: string | undefined,
    outputs: ActionOutputs,
  ) => Promise<void>;
  readonly cleanup: (allocation: ExecutionAllocation) => Promise<void>;
}

export const DEFAULT_ACTION_DEPENDENCIES: ActionDependencies = {
  bootstrap: bootstrapCli,
  readInputs: readActionInputs,
  allocate: allocateExecution,
  execute: runWorkflow,
  readTerminal: readTerminalEnvelope,
  recover: recoverDurableRun,
  project: (executable, identity, selectedExport, environment) =>
    validateAndProject(executable, identity, selectedExport, environment),
  writeOutputs,
  cleanup: cleanupExecution,
};

export interface ActionResult {
  readonly outputs: ActionOutputs;
  readonly failure?: AdapterError;
}

function applyProjection(
  outputs: ActionOutputs,
  projection: SelectedProjection,
): void {
  outputs["export-state"] = projection.state;
  outputs["export-kind"] = projection.kind ?? "";
  outputs["export-path"] = projection.path ?? "";
  outputs["export-value"] = projection.value ?? "";
}

export async function executeAction(
  environment: NodeJS.ProcessEnv,
  dependencies: ActionDependencies = DEFAULT_ACTION_DEPENDENCIES,
): Promise<ActionResult> {
  const outputs = emptyOutputs();
  let failure: AdapterError | undefined;
  let allocation: ExecutionAllocation | undefined;
  let terminal: TerminalEnvelope | undefined;
  let inputs: ActionInputs | undefined;
  let bootstrap: BootstrapResult | undefined;
  let processResult: WorkflowProcessResult | undefined;

  const fail = (error: unknown): void => {
    failure ??= asAdapterError(error);
  };

  try {
    // Bootstrap deliberately precedes every INPUT_ read.
    bootstrap = await dependencies.bootstrap(environment);
    inputs = await dependencies.readInputs(environment);
    allocation = await dependencies.allocate(
      environment.RUNNER_TEMP,
      inputs.prompt,
    );
    try {
      processResult = await dependencies.execute(
        bootstrap.executable,
        inputs,
        allocation,
        bootstrap.environment,
      );
    } catch (error) {
      fail(error);
    }

    if (processResult) {
      if (processResult.terminalOverflow) {
        fail(new AdapterError("terminal_result_invalid"));
      } else {
        try {
          const candidate = await dependencies.readTerminal(
            processResult.terminalPath,
          );
          validateTerminalShape(candidate);
          terminal = candidate;
          if (
            processResult.code === null ||
            processResult.signal !== null ||
            terminal.exitStatus !== processResult.code
          ) {
            fail(new AdapterError("terminal_result_invalid"));
          }
        } catch (error) {
          fail(error);
        }
      }
    }

    const runDirectory = await recoverRunDirectory(allocation, terminal);
    outputs["run-directory"] = runDirectory ?? "";

    let identity: ResultIdentity | undefined;
    if (terminal) {
      try {
        identity = await committedIdentity(allocation, terminal);
      } catch (error) {
        fail(error);
      }
    }
    if (!identity) {
      const recovered = await dependencies
        .recover(bootstrap.executable, allocation, bootstrap.environment)
        .catch((error: unknown) => {
          fail(error);
          return undefined;
        });
      if (recovered) {
        outputs["run-directory"] = recovered.runDirectory;
        identity = recovered.result;
      }
    }
    if (identity) {
      outputs.outcome = identity.outcome ?? "";
      outputs["artifact-set-path"] = identity.artifactDirectory;
      outputs["result-path"] = identity.resultPath;
      try {
        const validated = await dependencies.project(
          bootstrap.executable,
          identity,
          inputs.selectedExport,
          bootstrap.environment,
        );
        outputs.outcome = validated.outcome;
        if (validated.selected) {
          applyProjection(outputs, validated.selected);
          if (validated.selected.failure) fail(validated.selected.failure);
        }
      } catch (error) {
        fail(error);
      }
    }

    if (
      !processResult ||
      processResult.code !== 0 ||
      terminal?.outcome !== "succeeded"
    ) {
      fail(new AdapterError("workflow_failed"));
    }
  } catch (error) {
    fail(error);
    if (allocation) {
      outputs["run-directory"] =
        (await recoverRunDirectory(allocation, terminal).catch(
          () => undefined,
        )) ?? "";
    }
  } finally {
    if (allocation) {
      await dependencies.cleanup(allocation).catch(fail);
    }
  }

  await dependencies
    .writeOutputs(environment.GITHUB_OUTPUT, outputs)
    .catch(fail);
  return {
    outputs,
    ...(failure === undefined ? {} : { failure }),
  };
}

export async function runMain(): Promise<void> {
  const result = await executeAction(process.env);
  if (result.failure) {
    process.stderr.write(`${result.failure.message}\n`);
    process.exitCode = 1;
  }
}
