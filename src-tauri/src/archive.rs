use std::fs::{self, File};
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;

const META_FILENAME: &str = "_qsave_meta.json";

#[derive(Debug, Serialize, Deserialize)]
pub struct ZipMeta {
    pub platform: String,
    pub save_paths: Vec<String>,
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

/// Compresses files into an in-memory zip archive.
/// Files are stored with paths relative to their matching save_path,
/// prefixed by the save_path index (e.g., `0/subdir/save.dat`).
/// A `_qsave_meta.json` entry records the platform and save paths for restore.
pub fn create_zip(save_paths: Vec<String>, files: Vec<String>) -> Result<Vec<u8>, String> {
    let buffer = Cursor::new(Vec::new());
    let mut zip = zip::ZipWriter::new(buffer);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    let meta = ZipMeta {
        platform: current_platform(),
        save_paths: save_paths.clone(),
    };
    let meta_json =
        serde_json::to_string_pretty(&meta).map_err(|e| format!("Failed to serialize meta: {e}"))?;
    zip.start_file(META_FILENAME, options)
        .map_err(|e| format!("Failed to add meta to zip: {e}"))?;
    zip.write_all(meta_json.as_bytes())
        .map_err(|e| format!("Failed to write meta to zip: {e}"))?;

    for file_path in &files {
        let path = Path::new(file_path);

        let base_index = find_base_index(path, &save_paths)
            .ok_or_else(|| format!("No matching save path for: {file_path}"))?;

        let relative = path
            .strip_prefix(&save_paths[base_index])
            .map_err(|e| format!("Failed to compute relative path for {file_path}: {e}"))?
            .to_string_lossy();

        let entry_name = format!("{base_index}/{relative}");

        let mut file =
            File::open(path).map_err(|e| format!("Failed to open {file_path}: {e}"))?;
        let mut contents = Vec::new();
        file.read_to_end(&mut contents)
            .map_err(|e| format!("Failed to read {file_path}: {e}"))?;

        zip.start_file(&entry_name, options)
            .map_err(|e| format!("Failed to add {entry_name} to zip: {e}"))?;
        zip.write_all(&contents)
            .map_err(|e| format!("Failed to write {entry_name} to zip: {e}"))?;
    }

    let cursor = zip
        .finish()
        .map_err(|e| format!("Failed to finalize zip: {e}"))?;
    Ok(cursor.into_inner())
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

    // Create temp staging dirs next to each target (same filesystem for rename)
    let staging_dirs: Vec<PathBuf> = target_dirs
        .iter()
        .enumerate()
        .map(|(index, dir)| {
            let parent = PathBuf::from(dir)
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| PathBuf::from(dir));
            let staging = parent.join(format!(".qsave_restore_tmp_{index}"));
            if staging.exists() {
                fs::remove_dir_all(&staging)
                    .map_err(|e| format!("Failed to clean staging dir: {e}"))?;
            }
            fs::create_dir_all(&staging)
                .map_err(|e| format!("Failed to create staging dir: {e}"))?;
            Ok(staging)
        })
        .collect::<Result<Vec<_>, String>>()?;

    // Extract to staging dirs
    let result = extract_to_dirs(&mut archive, &staging_dirs);

    // On failure, clean up staging dirs and return error
    if let Err(err) = result {
        for staging in &staging_dirs {
            let _ = fs::remove_dir_all(staging);
        }
        return Err(err);
    }

    let file_count = result.unwrap();

    // Swap: remove originals, rename staging to target
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

    Ok(ExtractResult { file_count })
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

        let name = entry.name().to_string();
        if name == META_FILENAME {
            continue;
        }

        let (index, relative) = name
            .split_once('/')
            .and_then(|(idx, rest)| idx.parse::<usize>().ok().map(|i| (i, rest)))
            .ok_or_else(|| format!("Invalid zip entry (no index prefix): {name}"))?;

        if index >= canonical_targets.len() {
            return Err(format!(
                "Zip entry index {index} exceeds target dirs count {}",
                canonical_targets.len()
            ));
        }

        // Zip-slip protection
        if Path::new(relative).components().any(|c| c == std::path::Component::ParentDir) {
            return Err(format!("Zip entry escapes target directory: {name}"));
        }

        let out_path = canonical_targets[index].join(relative);

        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create dir for {name}: {e}"))?;
        }

        if entry.is_dir() {
            fs::create_dir_all(&out_path)
                .map_err(|e| format!("Failed to create dir {name}: {e}"))?;
            continue;
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

        file_count += 1;
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

        let zip_bytes = create_zip(
            vec![base.to_string_lossy().to_string()],
            vec![
                file_a.to_string_lossy().to_string(),
                file_b.to_string_lossy().to_string(),
            ],
        )
        .unwrap();

        let cursor = Cursor::new(zip_bytes);
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

        let zip_bytes = create_zip(
            vec![base.to_string_lossy().to_string()],
            vec![file.to_string_lossy().to_string()],
        )
        .unwrap();

        let meta = read_zip_meta(zip_bytes).unwrap().unwrap();
        assert_eq!(meta.save_paths, vec![base.to_string_lossy().to_string()]);
        assert!(!meta.platform.is_empty());
    }

    #[test]
    fn extracts_zip_preserving_structure() {
        let dir = TempDir::new().unwrap();
        let base = dir.path().join("saves");
        let file_a = base.join("save1.dat");
        let file_b = base.join("subdir/save2.dat");
        write_file(&file_a, b"hello");
        write_file(&file_b, b"world");

        let zip_bytes = create_zip(
            vec![base.to_string_lossy().to_string()],
            vec![
                file_a.to_string_lossy().to_string(),
                file_b.to_string_lossy().to_string(),
            ],
        )
        .unwrap();

        let extract_dir = dir.path().join("restored");
        let result = extract_zip(
            zip_bytes,
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

        let zip_bytes = create_zip(
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
            zip_bytes,
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

        let zip_bytes = create_zip(
            vec![base.to_string_lossy().to_string()],
            vec![file_a.to_string_lossy().to_string()],
        )
        .unwrap();

        // Add an extra file that wasn't in the backup
        let extract_dir = dir.path().join("restored");
        write_file(&extract_dir.join("save1.dat"), b"old");
        write_file(&extract_dir.join("extra.dat"), b"should be removed");

        let result = extract_zip(
            zip_bytes,
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
        let zip_bytes = create_zip(vec![], vec![]).unwrap();
        let cursor = Cursor::new(&zip_bytes);
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

        let zip_bytes = create_zip(
            vec![base.to_string_lossy().to_string()],
            vec![file.to_string_lossy().to_string()],
        )
        .unwrap();
        assert!(zip_bytes.len() < data.len());
    }
}
