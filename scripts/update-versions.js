import { readFileSync, writeFileSync } from "fs";

const version = process.argv[2];

if (!version) {
  console.error("Usage: node update-versions.js <version>");
  process.exit(1);
}

// Update tauri.conf.json
const tauriConfPath = "src-tauri/tauri.conf.json";
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf8"));
tauriConf.version = version;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");

// Update Cargo.toml (first version = line only)
const cargoPath = "src-tauri/Cargo.toml";
let cargo = readFileSync(cargoPath, "utf8");
let replaced = false;
cargo = cargo.replace(/^version = ".*"$/m, (match) => {
  if (!replaced) {
    replaced = true;
    return `version = "${version}"`;
  }
  return match;
});
writeFileSync(cargoPath, cargo);

console.log(`Updated versions to ${version}`);
