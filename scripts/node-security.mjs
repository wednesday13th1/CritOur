// Minimum patched releases from the October 21, 2026 Node.js advisory.
export function isSupportedNode(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return false;
  const [major, minor, patch] = match.slice(1).map(Number);
  const minimum = {22: [23, 4], 24: [22, 1], 26: [12, 1]}[major];
  return !!minimum && (minor > minimum[0] || minor === minimum[0] && patch >= minimum[1]);
}

export function assertSupportedNode(version = process.versions.node) {
  if (!isSupportedNode(version)) {
    throw new Error(`Node.js ${version} is not a supported patched release. Use Node 22.23.4+, 24.22.1+ or 26.12.1+ within those release lines. See .node-version.`);
  }
}
