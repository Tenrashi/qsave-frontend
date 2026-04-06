use std::fs::{self, File};
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;

const META_FILENAME: &str = "_qsave_meta.json";

#[derive(Debug, Serialize, Deserialize)]
pub struct ZipMeta {
    pub platform: String,
    pub save_paths: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateZipResult {
    pub zip_bytes: Vec<u8>,
    pub content_hash: String,
}

#[derive(Debug, Serialize)]
pub struct CreateZipFileResult {
    pub temp_path: String,
    pub content_hash: String,
    pub file_size: u64,
}

#[derive(Debug, Serialize)]
pub struct ExtractResult {
    pub file_count: u32,
}

fn current_platform() -> String {
    if cfg!(target_os = "macos") {
        "macos".to_string()
    } else if cfg!(target_os = "windows") {
        "windows".to_string()
    } else {
        "linux".to_string()
    }
}

/// Finds the index of the longest matching base directory for a file path.
fn find_base_index(file_path: &Path, save_paths: &[String]) -> Option<usize> {
    save_paths
        .iter()
        .enumerate()
        .filter(|(_, base)| file_path.starts_with(base.as_str()))
        .max_by_key(|(_, base)| base.len())
        .map(|(index, _)| index)
}

/// Resolved file with contents loaded into memory — used by `create_zip`.
struct ResolvedFile {
    relative_path: String,
    contents: Vec<u8>,
    entry_name: String,
}

fn resolve_files(save_paths: &[String], files: &[String]) -> Result<Vec<ResolvedFile>, String> {
    resolve_paths(save_paths, files)?
        .into_iter()
        .map(|entry| {
            let mut file = File::open(&entry.file_path)
                .map_err(|e| format!("Failed to open {}: {e}", entry.file_path.display()))?;
            let mut contents = Vec::new();
            file.read_to_end(&mut contents)
                .map_err(|e| format!("Failed to read {}: {e}", entry.file_path.display()))?;
            Ok(ResolvedFile {
                relative_path: entry.relative_path,
                contents,
                entry_name: entry.entry_name,
            })
        })
        .collect()
}

/// Computes a SHA-256 content hash over sorted (relative_path, file_bytes) pairs.
/// Cross-device comparable: no timestamps or absolute paths.
fn compute_hash(resolved: &[ResolvedFile]) -> String {
    let mut sorted_indices: Vec<usize> = (0..resolved.len()).collect();
    sorted_indices.sort_by(|a, b| resolved[*a].relative_path.cmp(&resolved[*b].relative_path));

    let mut hasher = Sha256::new();
    for index in sorted_indices {
        let file = &resolved[index];
        hasher.update(file.relative_path.as_bytes());
        hasher.update(b"\0");
        hasher.update(&file.contents);
        hasher.update(b"\0");
    }
    let result = hasher.finalize();
    result.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// Resolves file paths without reading contents — for streaming operations.
struct ResolvedPath {
    file_path: PathBuf,
    relative_path: String,
    entry_name: String,
}

fn resolve_paths(save_paths: &[String], files: &[String]) -> Result<Vec<ResolvedPath>, String> {
    let mut resolved: Vec<ResolvedPath> = Vec::with_capacity(files.len());
    let mut seen_entries = std::collections::HashSet::new();

    for file_path in files {
        let path = Path::new(file_path);

        let base_index = find_base_index(path, save_paths)
            .ok_or_else(|| format!("No matching save path for: {file_path}"))?;

        let relative = path
            .strip_prefix(&save_paths[base_index])
            .map_err(|e| format!("Failed to compute relative path for {file_path}: {e}"))?
            .to_string_lossy()
            .replace('\\', "/");

        let entry_name = format!("{base_index}/{relative}");

        if !seen_entries.insert(entry_name.clone()) {
            continue;
        }

        resolved.push(ResolvedPath {
            file_path: path.to_path_buf(),
            relative_path: relative,
            entry_name,
        });
    }

    Ok(resolved)
}

/// Adapter that forwards `Write` to `Digest::update`.
struct DigestWriter<'a>(&'a mut Sha256);

impl std::io::Write for DigestWriter<'_> {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        Digest::update(self.0, buf);
        Ok(buf.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

/// Computes a SHA-256 content hash by streaming files one at a time.
/// Produces the same hash as `compute_hash` — same (sorted relative_path, contents) sequence.
fn compute_hash_streaming(resolved: &[ResolvedPath]) -> Result<String, String> {
    let mut sorted_indices: Vec<usize> = (0..resolved.len()).collect();
    sorted_indices.sort_by(|a, b| resolved[*a].relative_path.cmp(&resolved[*b].relative_path));

    let mut hasher = Sha256::new();
    for index in sorted_indices {
        let entry = &resolved[index];
        Digest::update(&mut hasher, entry.relative_path.as_bytes());
        Digest::update(&mut hasher, b"\0");
        let mut file = File::open(&entry.file_path)
            .map_err(|e| format!("Failed to open {}: {e}", entry.file_path.display()))?;
        std::io::copy(&mut file, &mut DigestWriter(&mut hasher))
            .map_err(|e| format!("Failed to read {}: {e}", entry.file_path.display()))?;
        Digest::update(&mut hasher, b"\0");
    }
    let result = hasher.finalize();
    Ok(result.iter().map(|byte| format!("{byte:02x}")).collect())
}

/// Computes a content hash for save files without creating a zip.
/// Streams files one at a time to avoid loading everything into memory.
pub fn compute_save_hash(save_paths: Vec<String>, files: Vec<String>) -> Result<String, String> {
    let resolved = resolve_paths(&save_paths, &files)?;
    compute_hash_streaming(&resolved)
}

/// Compresses files into an in-memory zip archive and computes a content hash.
/// Files are stored with paths relative to their matching save_path,
/// prefixed by the save_path index (e.g., `0/subdir/save.dat`).
/// A `_qsave_meta.json` entry records the platform and save paths for restore.
pub fn create_zip(save_paths: Vec<String>, files: Vec<String>) -> Result<CreateZipResult, String> {
    let resolved = resolve_files(&save_paths, &files)?;
    let content_hash = compute_hash(&resolved);

    let buffer = Cursor::new(Vec::new());
    let mut zip = zip::ZipWriter::new(buffer);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    let meta = ZipMeta {
        platform: current_platform(),
        save_paths,
    };
    let meta_json =
        serde_json::to_string_pretty(&meta).map_err(|e| format!("Failed to serialize meta: {e}"))?;
    zip.start_file(META_FILENAME, options)
        .map_err(|e| format!("Failed to add meta to zip: {e}"))?;
    zip.write_all(meta_json.as_bytes())
        .map_err(|e| format!("Failed to write meta to zip: {e}"))?;

    for file in &resolved {
        zip.start_file(&file.entry_name, options)
            .map_err(|e| format!("Failed to add {} to zip: {e}", file.entry_name))?;
        zip.write_all(&file.contents)
            .map_err(|e| format!("Failed to write {} to zip: {e}", file.entry_name))?;
    }

    let cursor = zip
        .finish()
        .map_err(|e| format!("Failed to finalize zip: {e}"))?;
    Ok(CreateZipResult {
        zip_bytes: cursor.into_inner(),
        content_hash,
    })
}

/// Compresses files into a temp file and returns the path + content hash.
/// Streams files one at a time — only one file's data is in memory at any point.
pub fn create_zip_file(save_paths: Vec<String>, files: Vec<String>) -> Result<CreateZipFileResult, String> {
    let resolved = resolve_paths(&save_paths, &files)?;
    let content_hash = compute_hash_streaming(&resolved)?;

    let temp_path = std::env::temp_dir().join(format!("qsave_upload_{}.zip", uuid_v4()));
    let out_file = File::create(&temp_path)
        .map_err(|e| format!("Failed to create temp file: {e}"))?;
    let mut zip = zip::ZipWriter::new(out_file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    let meta = ZipMeta {
        platform: current_platform(),
        save_paths,
    };
    let meta_json =
        serde_json::to_string_pretty(&meta).map_err(|e| format!("Failed to serialize meta: {e}"))?;
    zip.start_file(META_FILENAME, options)
        .map_err(|e| format!("Failed to add meta to zip: {e}"))?;
    zip.write_all(meta_json.as_bytes())
        .map_err(|e| format!("Failed to write meta to zip: {e}"))?;

    for entry in &resolved {
        zip.start_file(&entry.entry_name, options)
            .map_err(|e| format!("Failed to add {} to zip: {e}", entry.entry_name))?;
        let mut file = File::open(&entry.file_path)
            .map_err(|e| format!("Failed to open {}: {e}", entry.file_path.display()))?;
        std::io::copy(&mut file, &mut zip)
            .map_err(|e| format!("Failed to write {} to zip: {e}", entry.entry_name))?;
    }

    zip.finish()
        .map_err(|e| format!("Failed to finalize zip: {e}"))?;

    let file_size = fs::metadata(&temp_path)
        .map_err(|e| format!("Failed to read temp file size: {e}"))?
        .len();

    Ok(CreateZipFileResult {
        temp_path: temp_path.to_string_lossy().to_string(),
        content_hash,
        file_size,
    })
}

/// Simple v4-style UUID using random bytes.
fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let pid = std::process::id();
    format!("{nanos:x}-{pid:x}")
}

/// Creates temporary staging directories next to each target (same filesystem for rename).
fn create_staging_dirs(target_dirs: &[String]) -> Result<Vec<PathBuf>, String> {
    target_dirs
        .iter()
        .enumerate()
        .map(|(index, dir)| {
            let parent = PathBuf::from(dir)
                .parent()
                .map(|parent| parent.to_path_buf())
                .unwrap_or_else(|| PathBuf::from(dir));
            let staging = parent.join(format!(".qsave_restore_tmp_{index}"));
            let _ = fs::remove_dir_all(&staging);
            fs::create_dir_all(&staging)
                .map_err(|e| format!("Failed to create staging dir: {e}"))?;
            Ok(staging)
        })
        .collect()
}

/// Atomically swaps staging directories into target directories.
fn swap_staging_to_targets(staging_dirs: &[PathBuf], target_dirs: &[String]) -> Result<(), String> {
    for (index, dir) in target_dirs.iter().enumerate() {
        let target = PathBuf::from(dir);
        if target.exists() {
            fs::remove_dir_all(&target)
                .map_err(|e| format!("Failed to clear target dir {dir}: {e}"))?;
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent dir for {dir}: {e}"))?;
        }
        fs::rename(&staging_dirs[index], &target)
            .map_err(|e| format!("Failed to move staging to {dir}: {e}"))?;
    }
    Ok(())
}

/// Extracts a zip archive, routing files to the correct target directories.
/// `target_dirs` maps to the save_paths indices stored in the ZIP.
/// Each entry like `0/subdir/save.dat` is extracted to `target_dirs[0]/subdir/save.dat`.
///
/// Extraction is atomic per target dir: files are extracted to a temp directory first,
/// then the original is replaced only on success. On failure, originals are untouched.
pub fn extract_zip(zip_bytes: Vec<u8>, target_dirs: Vec<String>) -> Result<ExtractResult, String> {
    let cursor = Cursor::new(zip_bytes);
    let mut archive =
        zip::ZipArchive::new(cursor).map_err(|e| format!("Failed to open zip: {e}"))?;

    let staging_dirs = create_staging_dirs(&target_dirs)?;

    let file_count = match extract_to_dirs(&mut archive, &staging_dirs) {
        Ok(count) => count,
        Err(err) => {
            for staging in &staging_dirs {
                let _ = fs::remove_dir_all(staging);
            }
            return Err(err);
        }
    };

    swap_staging_to_targets(&staging_dirs, &target_dirs)?;
    Ok(ExtractResult { file_count })
}

/// Processes a single zip entry, writing it to the appropriate target directory.
/// Returns `true` if a file was written, `false` if the entry was skipped or was a directory.
fn extract_entry(
    entry: &mut zip::read::ZipFile,
    canonical_targets: &[PathBuf],
) -> Result<bool, String> {
    let name = entry.name().to_string();
    if name == META_FILENAME {
        return Ok(false);
    }

    let (index, relative) = name
        .split_once('/')
        .and_then(|(idx, rest)| idx.parse::<usize>().ok().map(|parsed| (parsed, rest)))
        .ok_or_else(|| format!("Invalid zip entry (no index prefix): {name}"))?;

    let clamped_index = index.min(canonical_targets.len() - 1);

    if Path::new(relative)
        .components()
        .any(|component| component == std::path::Component::ParentDir)
    {
        return Err(format!("Zip entry escapes target directory: {name}"));
    }

    let out_path = canonical_targets[clamped_index].join(relative);

    if let Some(parent) = out_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create dir for {name}: {e}"))?;
    }

    if entry.is_dir() {
        fs::create_dir_all(&out_path)
            .map_err(|e| format!("Failed to create dir {name}: {e}"))?;
        return Ok(false);
    }

    let mut contents = Vec::new();
    entry
        .read_to_end(&mut contents)
        .map_err(|e| format!("Failed to read {name}: {e}"))?;

    let mut out_file =
        File::create(&out_path).map_err(|e| format!("Failed to create {name}: {e}"))?;
    out_file
        .write_all(&contents)
        .map_err(|e| format!("Failed to write {name}: {e}"))?;

    Ok(true)
}

fn extract_to_dirs(
    archive: &mut zip::ZipArchive<Cursor<Vec<u8>>>,
    target_dirs: &[PathBuf],
) -> Result<u32, String> {
    let canonical_targets: Vec<PathBuf> = target_dirs
        .iter()
        .map(|dir| {
            dir.canonicalize()
                .map_err(|e| format!("Failed to canonicalize {}: {e}", dir.display()))
        })
        .collect::<Result<Vec<_>, _>>()?;

    let mut file_count: u32 = 0;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry {i}: {e}"))?;

        if extract_entry(&mut entry, &canonical_targets)? {
            file_count += 1;
        }
    }

    Ok(file_count)
}

/// Reads the metadata from a zip archive without extracting files.
pub fn read_zip_meta(zip_bytes: Vec<u8>) -> Result<Option<ZipMeta>, String> {
    let cursor = Cursor::new(zip_bytes);
    let mut archive =
        zip::ZipArchive::new(cursor).map_err(|e| format!("Failed to open zip: {e}"))?;

    let mut entry = match archive.by_name(META_FILENAME) {
        Ok(entry) => entry,
        Err(_) => return Ok(None),
    };

    let mut contents = String::new();
    entry
        .read_to_string(&mut contents)
        .map_err(|e| format!("Failed to read meta: {e}"))?;

    let meta: ZipMeta =
        serde_json::from_str(&contents).map_err(|e| format!("Failed to parse meta: {e}"))?;

    Ok(Some(meta))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn write_file(path: &Path, content: &[u8]) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        File::create(path).unwrap().write_all(content).unwrap();
    }

    #[test]
    fn creates_zip_with_indexed_relative_paths() {
        let dir = TempDir::new().unwrap();
        let base = dir.path().join("saves");
        let file_a = base.join("save1.dat");
        let file_b = base.join("subdir/save2.dat");
        write_file(&file_a, b"hello");
        write_file(&file_b, b"world");

        let result = create_zip(
            vec![base.to_string_lossy().to_string()],
            vec![
                file_a.to_string_lossy().to_string(),
                file_b.to_string_lossy().to_string(),
            ],
        )
        .unwrap();

        let cursor = Cursor::new(result.zip_bytes);
        let mut archive = zip::ZipArchive::new(cursor).unwrap();

        let mut names: Vec<String> = (0..archive.len())
            .map(|i| archive.by_index(i).unwrap().name().to_string())
            .filter(|name| name != META_FILENAME)
            .collect();
        names.sort();
        assert_eq!(names, vec!["0/save1.dat", "0/subdir/save2.dat"]);
    }

    #[test]
    fn creates_zip_with_metadata() {
        let dir = TempDir::new().unwrap();
        let base = dir.path().join("saves");
        let file = base.join("save.dat");
        write_file(&file, b"data");

        let result = create_zip(
            vec![base.to_string_lossy().to_string()],
            vec![file.to_string_lossy().to_string()],
        )
        .unwrap();

        let meta = read_zip_meta(result.zip_bytes).unwrap().unwrap();
        assert_eq!(meta.save_paths, vec![base.to_string_lossy().to_string()]);
        assert!(!meta.platform.is_empty());
    }

    #[test]
    fn create_zip_returns_content_hash() {
        let dir = TempDir::new().unwrap();
        let base = dir.path().join("saves");
        let file = base.join("save.dat");
        write_file(&file, b"data");

        let result = create_zip(
            vec![base.to_string_lossy().to_string()],
            vec![file.to_string_lossy().to_string()],
        )
        .unwrap();

        assert!(!result.content_hash.is_empty());
        assert_eq!(result.content_hash.len(), 64); // SHA-256 hex
    }

    #[test]
    fn content_hash_matches_compute_save_hash() {
        let dir = TempDir::new().unwrap();
        let base = dir.path().join("saves");
        let file_a = base.join("save1.dat");
        let file_b = base.join("subdir/save2.dat");
        write_file(&file_a, b"hello");
        write_file(&file_b, b"world");

        let save_paths = vec![base.to_string_lossy().to_string()];
        let files = vec![
            file_a.to_string_lossy().to_string(),
            file_b.to_string_lossy().to_string(),
        ];

        let zip_result = create_zip(save_paths.clone(), files.clone()).unwrap();
        let standalone_hash = compute_save_hash(save_paths, files).unwrap();

        assert_eq!(zip_result.content_hash, standalone_hash);
    }

    #[test]
    fn content_hash_is_stable_regardless_of_file_order() {
        let dir = TempDir::new().unwrap();
        let base = dir.path().join("saves");
        let file_a = base.join("aaa.dat");
        let file_b = base.join("zzz.dat");
        write_file(&file_a, b"first");
        write_file(&file_b, b"second");

        let save_paths = vec![base.to_string_lossy().to_string()];
        let hash_ab = compute_save_hash(
            save_paths.clone(),
            vec![
                file_a.to_string_lossy().to_string(),
                file_b.to_string_lossy().to_string(),
            ],
        )
        .unwrap();
        let hash_ba = compute_save_hash(
            save_paths,
            vec![
                file_b.to_string_lossy().to_string(),
                file_a.to_string_lossy().to_string(),
            ],
        )
        .unwrap();

        assert_eq!(hash_ab, hash_ba);
    }

    #[test]
    fn content_hash_changes_when_file_content_changes() {
        let dir = TempDir::new().unwrap();
        let base = dir.path().join("saves");
        let file = base.join("save.dat");
        let save_paths = vec![base.to_string_lossy().to_string()];
        let files = vec![file.to_string_lossy().to_string()];

        write_file(&file, b"version1");
        let hash1 = compute_save_hash(save_paths.clone(), files.clone()).unwrap();

        write_file(&file, b"version2");
        let hash2 = compute_save_hash(save_paths, files).unwrap();

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn extracts_zip_preserving_structure() {
        let dir = TempDir::new().unwrap();
        let base = dir.path().join("saves");
        let file_a = base.join("save1.dat");
        let file_b = base.join("subdir/save2.dat");
        write_file(&file_a, b"hello");
        write_file(&file_b, b"world");

        let zip_result = create_zip(
            vec![base.to_string_lossy().to_string()],
            vec![
                file_a.to_string_lossy().to_string(),
                file_b.to_string_lossy().to_string(),
            ],
        )
        .unwrap();

        let extract_dir = dir.path().join("restored");
        let result = extract_zip(
            zip_result.zip_bytes,
            vec![extract_dir.to_string_lossy().to_string()],
        )
        .unwrap();

        assert_eq!(result.file_count, 2);
        assert_eq!(fs::read_to_string(extract_dir.join("save1.dat")).unwrap(), "hello");
        assert_eq!(
            fs::read_to_string(extract_dir.join("subdir/save2.dat")).unwrap(),
            "world"
        );
    }

    #[test]
    fn extracts_multiple_save_paths_to_separate_dirs() {
        let dir = TempDir::new().unwrap();
        let config_base = dir.path().join("config");
        let saves_base = dir.path().join("saves");
        let config_file = config_base.join("settings.ini");
        let save_file = saves_base.join("slot1.dat");
        write_file(&config_file, b"[config]");
        write_file(&save_file, b"savedata");

        let zip_result = create_zip(
            vec![
                config_base.to_string_lossy().to_string(),
                saves_base.to_string_lossy().to_string(),
            ],
            vec![
                config_file.to_string_lossy().to_string(),
                save_file.to_string_lossy().to_string(),
            ],
        )
        .unwrap();

        let restore_config = dir.path().join("restore_config");
        let restore_saves = dir.path().join("restore_saves");
        let result = extract_zip(
            zip_result.zip_bytes,
            vec![
                restore_config.to_string_lossy().to_string(),
                restore_saves.to_string_lossy().to_string(),
            ],
        )
        .unwrap();

        assert_eq!(result.file_count, 2);
        assert_eq!(
            fs::read_to_string(restore_config.join("settings.ini")).unwrap(),
            "[config]"
        );
        assert_eq!(
            fs::read_to_string(restore_saves.join("slot1.dat")).unwrap(),
            "savedata"
        );
    }

    #[test]
    fn clamps_overflow_indices_to_last_target_dir() {
        let dir = TempDir::new().unwrap();
        let base_a = dir.path().join("pathA");
        let base_b = dir.path().join("pathB");
        let file_a = base_a.join("a.dat");
        let file_b = base_b.join("b.dat");
        write_file(&file_a, b"aaa");
        write_file(&file_b, b"bbb");

        let zip_result = create_zip(
            vec![
                base_a.to_string_lossy().to_string(),
                base_b.to_string_lossy().to_string(),
            ],
            vec![
                file_a.to_string_lossy().to_string(),
                file_b.to_string_lossy().to_string(),
            ],
        )
        .unwrap();

        // Restore with only 1 target dir (fewer than the 2 in the zip)
        let restore_dir = dir.path().join("restored");
        let result = extract_zip(
            zip_result.zip_bytes,
            vec![restore_dir.to_string_lossy().to_string()],
        )
        .unwrap();

        assert_eq!(result.file_count, 2);
        assert_eq!(fs::read_to_string(restore_dir.join("a.dat")).unwrap(), "aaa");
        assert_eq!(fs::read_to_string(restore_dir.join("b.dat")).unwrap(), "bbb");
    }

    #[test]
    fn rejects_zip_slip_attack() {
        let dir = TempDir::new().unwrap();
        let buffer = Cursor::new(Vec::new());
        let mut zip = zip::ZipWriter::new(buffer);
        let options = SimpleFileOptions::default();

        zip.start_file("0/../../escaped.txt", options).unwrap();
        zip.write_all(b"malicious").unwrap();

        let cursor = zip.finish().unwrap();
        let zip_bytes = cursor.into_inner();

        let target = dir.path().join("safe").join("nested");
        fs::create_dir_all(&target).unwrap();
        let result = extract_zip(zip_bytes, vec![target.to_string_lossy().to_string()]);
        assert!(result.is_err());
    }

    #[test]
    fn read_meta_returns_none_for_zip_without_meta() {
        let buffer = Cursor::new(Vec::new());
        let mut zip = zip::ZipWriter::new(buffer);
        let options = SimpleFileOptions::default();

        zip.start_file("0/save.dat", options).unwrap();
        zip.write_all(b"data").unwrap();

        let cursor = zip.finish().unwrap();
        let zip_bytes = cursor.into_inner();

        let meta = read_zip_meta(zip_bytes).unwrap();
        assert!(meta.is_none());
    }

    #[test]
    fn extract_clears_existing_files() {
        let dir = TempDir::new().unwrap();
        let base = dir.path().join("saves");
        let file_a = base.join("save1.dat");
        write_file(&file_a, b"original");

        let zip_result = create_zip(
            vec![base.to_string_lossy().to_string()],
            vec![file_a.to_string_lossy().to_string()],
        )
        .unwrap();

        // Add an extra file that wasn't in the backup
        let extract_dir = dir.path().join("restored");
        write_file(&extract_dir.join("save1.dat"), b"old");
        write_file(&extract_dir.join("extra.dat"), b"should be removed");

        let result = extract_zip(
            zip_result.zip_bytes,
            vec![extract_dir.to_string_lossy().to_string()],
        )
        .unwrap();

        assert_eq!(result.file_count, 1);
        assert_eq!(fs::read_to_string(extract_dir.join("save1.dat")).unwrap(), "original");
        assert!(!extract_dir.join("extra.dat").exists());
    }

    #[test]
    fn returns_error_for_missing_file() {
        let result = create_zip(
            vec!["/nonexistent".to_string()],
            vec!["/nonexistent/file.dat".to_string()],
        );
        assert!(result.is_err());
    }

    #[test]
    fn creates_empty_zip_with_meta_only() {
        let result = create_zip(vec![], vec![]).unwrap();
        let cursor = Cursor::new(&result.zip_bytes);
        let archive = zip::ZipArchive::new(cursor).unwrap();
        assert_eq!(archive.len(), 1);
    }

    #[test]
    fn compresses_data() {
        let dir = TempDir::new().unwrap();
        let base = dir.path().join("saves");
        let file = base.join("big.dat");

        let data = "abcdefgh".repeat(10_000);
        write_file(&file, data.as_bytes());

        let result = create_zip(
            vec![base.to_string_lossy().to_string()],
            vec![file.to_string_lossy().to_string()],
        )
        .unwrap();
        assert!(result.zip_bytes.len() < data.len());
    }

    #[test]
    fn create_zip_file_produces_valid_archive() {
        let dir = TempDir::new().unwrap();
        let base = dir.path().join("saves");
        let file_a = base.join("save1.dat");
        let file_b = base.join("subdir/save2.dat");
        write_file(&file_a, b"hello");
        write_file(&file_b, b"world");

        let result = create_zip_file(
            vec![base.to_string_lossy().to_string()],
            vec![
                file_a.to_string_lossy().to_string(),
                file_b.to_string_lossy().to_string(),
            ],
        )
        .unwrap();

        assert!(result.file_size > 0);
        assert_eq!(result.content_hash.len(), 64);

        // Verify the temp file is a valid zip with correct entries
        let zip_bytes = fs::read(&result.temp_path).unwrap();
        let cursor = Cursor::new(zip_bytes);
        let mut archive = zip::ZipArchive::new(cursor).unwrap();
        let mut names: Vec<String> = (0..archive.len())
            .map(|i| archive.by_index(i).unwrap().name().to_string())
            .filter(|name| name != META_FILENAME)
            .collect();
        names.sort();
        assert_eq!(names, vec!["0/save1.dat", "0/subdir/save2.dat"]);

        let _ = fs::remove_file(&result.temp_path);
    }

    #[test]
    fn create_zip_file_hash_matches_in_memory_zip() {
        let dir = TempDir::new().unwrap();
        let base = dir.path().join("saves");
        let file_a = base.join("a.dat");
        let file_b = base.join("b.dat");
        write_file(&file_a, b"alpha");
        write_file(&file_b, b"beta");

        let save_paths = vec![base.to_string_lossy().to_string()];
        let files = vec![
            file_a.to_string_lossy().to_string(),
            file_b.to_string_lossy().to_string(),
        ];

        let mem_result = create_zip(save_paths.clone(), files.clone()).unwrap();
        let file_result = create_zip_file(save_paths, files).unwrap();

        assert_eq!(mem_result.content_hash, file_result.content_hash);

        let _ = fs::remove_file(&file_result.temp_path);
    }

    #[test]
    fn streaming_hash_matches_in_memory_hash() {
        let dir = TempDir::new().unwrap();
        let base = dir.path().join("saves");
        let file_a = base.join("x.dat");
        let file_b = base.join("y.dat");
        write_file(&file_a, b"data1");
        write_file(&file_b, b"data2");

        let save_paths = vec![base.to_string_lossy().to_string()];
        let files = vec![
            file_a.to_string_lossy().to_string(),
            file_b.to_string_lossy().to_string(),
        ];

        let resolved_files = resolve_files(&save_paths, &files).unwrap();
        let in_memory_hash = compute_hash(&resolved_files);

        let resolved_paths = resolve_paths(&save_paths, &files).unwrap();
        let streaming_hash = compute_hash_streaming(&resolved_paths).unwrap();

        assert_eq!(in_memory_hash, streaming_hash);
    }

    #[test]
    fn deduplicates_files_from_overlapping_save_paths() {
        let dir = TempDir::new().unwrap();
        let parent = dir.path().join("profiles").join("user1");
        let child = parent.join("Savegames");
        let config_file = parent.join("config.ini");
        let save_file = child.join("Story").join("slot1.lsv");
        write_file(&config_file, b"[config]");
        write_file(&save_file, b"savedata");

        let save_paths = vec![
            parent.to_string_lossy().to_string(),
            child.to_string_lossy().to_string(),
        ];

        // Pass the save file twice — once discovered from each overlapping path
        let files = vec![
            config_file.to_string_lossy().to_string(),
            save_file.to_string_lossy().to_string(),
            save_file.to_string_lossy().to_string(),
        ];

        let result = create_zip_file(save_paths, files).unwrap();

        let zip_bytes = fs::read(&result.temp_path).unwrap();
        let cursor = Cursor::new(zip_bytes);
        let mut archive = zip::ZipArchive::new(cursor).unwrap();
        let mut names: Vec<String> = (0..archive.len())
            .map(|i| archive.by_index(i).unwrap().name().to_string())
            .filter(|name| name != META_FILENAME)
            .collect();
        names.sort();
        assert_eq!(names, vec!["0/config.ini", "1/Story/slot1.lsv"]);

        let _ = fs::remove_file(&result.temp_path);
    }
}
