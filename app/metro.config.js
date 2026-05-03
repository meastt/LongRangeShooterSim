const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Force Metro to resolve (sub)dependencies only from the `nodeModulesPaths`
// THIS IS CRITICAL to prevent React duplicate instances causing "Invalid hook call"
config.resolver.disableHierarchicalLookup = true;

// 4. Resolve workspace packages from TypeScript source directly.
//
//    We use resolveRequest (not resolverMainFields) so the intercept is SURGICAL.
//    Why this is needed: EAS cloud builds are a clean git checkout — dist/ folders
//    are gitignored and never uploaded. Metro must transpile the TS source directly.
//
//    Also pin react-native-is-edge-to-edge to its compiled dist/index.js explicitly.
//    EAS cloud builds previously picked up its 'source' field (src/index, uncompiled
//    TS) instead of dist/index.js, causing a Metro bundling failure.

const workspacePackages = {
  '@aim/solver': path.resolve(workspaceRoot, 'packages/solver/src/index.ts'),
};

// Third-party packages that need an explicit resolved path in cloud builds.
// We search both projectRoot and workspaceRoot node_modules so this works in
// both local development and EAS cloud environments.
function resolveThirdParty(pkgName, subPath) {
  const candidates = [
    path.resolve(projectRoot, 'node_modules', pkgName, subPath),
    path.resolve(workspaceRoot, 'node_modules', pkgName, subPath),
  ];
  for (const c of candidates) {
    const fs = require('fs');
    if (fs.existsSync(c)) return c;
  }
  return null; // let Metro handle it normally if not found
}

const thirdPartyPins = {
  'react-native-is-edge-to-edge':
    resolveThirdParty('react-native-is-edge-to-edge', 'dist/index.js'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (workspacePackages[moduleName]) {
    return { filePath: workspacePackages[moduleName], type: 'sourceFile' };
  }
  if (thirdPartyPins[moduleName]) {
    return { filePath: thirdPartyPins[moduleName], type: 'sourceFile' };
  }
  // Fall through to Metro's default resolution for everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
