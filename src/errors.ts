export type FailureCode =
  | "allocation_failed"
  | "artifact_validation_failed"
  | "bootstrap_download_failed"
  | "bootstrap_integrity_failed"
  | "bootstrap_platform_unsupported"
  | "bootstrap_version_failed"
  | "child_launch_failed"
  | "child_output_failed"
  | "cleanup_failed"
  | "github_file_command_failed"
  | "input_invalid"
  | "result_identity_invalid"
  | "result_projection_failed"
  | "terminal_result_invalid"
  | "workflow_failed";

export class AdapterError extends Error {
  readonly code: FailureCode;

  constructor(code: FailureCode) {
    super(`Scherzo Run failed [${code}].`);
    this.name = "AdapterError";
    this.code = code;
  }
}

export function asAdapterError(error: unknown): AdapterError {
  return error instanceof AdapterError
    ? error
    : new AdapterError("result_projection_failed");
}
