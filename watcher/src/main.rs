use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::mpsc::channel;
use walkdir::WalkDir;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum FileEventType {
    Created,
    Modified,
    Deleted,
    Initial,
}

#[derive(Serialize, Deserialize, Debug)]
struct FileEvent {
    event_type: FileEventType,
    path: String,
    timestamp: u64,
}

fn send_event(event: &FileEvent) {
    let client = reqwest::blocking::Client::new();
    let res = client.post("http://localhost:3000/api/ingest")
        .json(event)
        .send();

    match res {
        Ok(response) => {
            if response.status().is_success() {
                println!("✅ Event Synced: [{:?}] {}", event.event_type, event.path);
            } else {
                println!("⚠️ Ingestion Rejected: {:?} for {}", response.status(), event.path);
            }
        }
        Err(e) => println!("❌ API Unreachable: {:?}", e),
    }
}

fn is_ignored(path: &Path) -> bool {
    let path_str = path.to_string_lossy();
    
    // Directory Ignore List
    let ignore_dirs = [
        "node_modules", ".git", "venv", ".venv", "target", "dist", ".next", 
        "__pycache__", ".lancedb", "bin", "obj", "build", "coverage", ".cache"
    ];

    // Extension Ignore List
    let ignore_exts = ["lock", "log", "tmp", "map", "bak", "swp"];

    for ignore in ignore_dirs {
        if path_str.contains(&format!("/{}", ignore)) || path_str.contains(&format!("\\{}", ignore)) {
            return true;
        }
    }

    if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
        if ignore_exts.contains(&ext) {
            return true;
        }
    }

    false
}

fn initial_scan(path: &str) {
    println!("🔍 [Phase 1] Building initial index map for {}...", path);
    let mut count = 0;
    for entry in WalkDir::new(path)
        .into_iter()
        .filter_entry(|e| !is_ignored(e.path()))
        .filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            let path = entry.path();
            // We support md, txt, pdf (upcoming), js, ts, rs
            let supported_exts = ["md", "txt", "js", "ts", "rs", "tsx", "py"];
            let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
            
            if supported_exts.contains(&ext) {
                let event = FileEvent {
                    event_type: FileEventType::Initial,
                    path: path.to_string_lossy().into_owned(),
                    timestamp: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
                };
                send_event(&event);
                count += 1;
            }
        }
    }
    println!("✅ [Phase 1] Initial scan complete. Dispatched {} files.", count);
}

fn main() -> notify::Result<()> {
    let watch_path = std::env::var("WATCH_PATH").unwrap_or_else(|_| "../test-docs".to_string());
    
    println!("📡 ShadowDB Observer Core v0.3.0");
    
    let path_to_check = Path::new(&watch_path);
    if !path_to_check.exists() || !path_to_check.is_dir() {
        eprintln!("❌ ERROR: Provided path '{}' is invalid.", watch_path);
        std::process::exit(1);
    }

    println!("👀 Monitoring: {}", watch_path);

    // Run Initial Scan
    initial_scan(&watch_path);

    println!("🚀 Entering Live Watch Mode...");
    let (tx, rx) = channel();
    let mut watcher = RecommendedWatcher::new(tx, Config::default())?;
    watcher.watch(Path::new(&watch_path), RecursiveMode::Recursive)?;

    // Simple Debouncing Map: Path -> Last Event Time
    let mut debounce_map: HashMap<(PathBuf, FileEventType), Instant> = HashMap::new();
    let debounce_duration = Duration::from_millis(500);

    for res in rx {
        match res {
            Ok(event) => {
                let et = match event.kind {
                    notify::EventKind::Create(_) => Some(FileEventType::Created),
                    notify::EventKind::Modify(_) => Some(FileEventType::Modified),
                    notify::EventKind::Remove(_) => Some(FileEventType::Deleted),
                    _ => None,
                };

                if let Some(event_type) = et {
                    for path in event.paths {
                        if is_ignored(&path) { continue; }
                        
                        // DEBOUNCE LOGIC: Prevent rapid-fire events for the same file/action
                        let key = (path.clone(), event_type);
                        if let Some(last_time) = debounce_map.get(&key) {
                            if last_time.elapsed() < debounce_duration {
                                continue;
                            }
                        }
                        debounce_map.insert(key, Instant::now());

                        let file_event = FileEvent {
                            event_type,
                            path: path.to_string_lossy().into_owned(),
                            timestamp: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
                        };
                        
                        send_event(&file_event);
                    }
                }
            }
            Err(e) => println!("⚠️ Watcher internal error: {:?}", e),
        }
    }

    Ok(())
}
