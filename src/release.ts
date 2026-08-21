import evidence from "../release-evidence.json" with { type: "json" };

export type TargetTriple = keyof typeof evidence.archives;
export type ArchiveEvidence = (typeof evidence.archives)[TargetTriple];
export type ReleaseEvidence = typeof evidence;

export const PINNED_RELEASE: ReleaseEvidence = evidence;

const PLATFORM_TARGETS: Readonly<Record<string, TargetTriple>> = {
  "Linux/X64": "x86_64-unknown-linux-gnu",
  "Linux/ARM64": "aarch64-unknown-linux-gnu",
  "macOS/ARM64": "aarch64-apple-darwin",
};

export function selectTarget(
  runnerOS: string | undefined,
  runnerArch: string | undefined,
): TargetTriple | undefined {
  return PLATFORM_TARGETS[`${runnerOS ?? ""}/${runnerArch ?? ""}`];
}
