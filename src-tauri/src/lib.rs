use pulldown_cmark::{Parser, Options, html};
use std::fs;
use std::env;
use std::path::Path;
use std::sync::{Arc, Mutex};
use notify::{Watcher, RecommendedWatcher, RecursiveMode, Event, EventKind};
use tauri::{AppHandle, Emitter};
use syntect::parsing::SyntaxSet;
use syntect::highlighting::ThemeSet;
use syntect::html::highlighted_html_for_string;
use regex;

// Global state for file watcher
type WatcherState = Arc<Mutex<Option<RecommendedWatcher>>>;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn parse_markdown(markdown_content: &str) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_TASKLISTS);
    
    let parser = Parser::new_ext(markdown_content, options);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);
    
    // Post-process HTML to add syntax highlighting
    post_process_syntax_highlighting(&html_output)
}

fn post_process_syntax_highlighting(html: &str) -> String {
    // Initialize syntax highlighting resources
    let syntax_set = SyntaxSet::load_defaults_newlines();
    let theme_set = ThemeSet::load_defaults();
    
    // Use a lighter theme that works better for markdown viewers
    let theme = theme_set.themes.get("InspiredGitHub")
        .or_else(|| theme_set.themes.get("Solarized (light)"))
        .or_else(|| theme_set.themes.get("base16-ocean.light"))
        .unwrap_or(&theme_set.themes["base16-ocean.dark"]);
    
    // Pattern to match fenced code blocks with language (non-greedy match)
    let re_with_lang = regex::Regex::new(r#"<pre><code class="language-([^"]+)">(.*?)</code></pre>"#).unwrap();
    
    // Process code blocks with language specification
    let result = re_with_lang.replace_all(html, |caps: &regex::Captures| {
        let language = &caps[1];
        let code = html_escape::decode_html_entities(&caps[2]).to_string();
        
        // Try multiple language variations to improve matching
        let language_variants = [
            language,
            &language.to_lowercase(),
            match language.to_lowercase().as_str() {
                "js" => "javascript",
                "ts" => "typescript", 
                "py" => "python",
                "rb" => "ruby",
                "sh" => "bash",
                "yml" => "yaml",
                "md" => "markdown",
                _ => language
            }
        ];
        
        for lang_variant in &language_variants {
            if let Some(syntax) = syntax_set.find_syntax_by_token(lang_variant) {
                match highlighted_html_for_string(&code, &syntax_set, syntax, theme) {
                    Ok(highlighted) => {
                        return highlighted;
                    },
                    Err(_) => {
                        // Continue trying other variants
                    }
                }
            }
        }
        
        // No syntax highlighting available for this language
        
        // Fallback to original format with proper escaping
        format!("<pre><code class=\"language-{}\">{}</code></pre>", 
               language, html_escape::encode_text(&code))
    });
    
    result.to_string()
}

#[tauri::command]
fn read_markdown_file(file_path: String) -> Result<String, String> {
    match fs::read_to_string(&file_path) {
        Ok(content) => {
            let html = parse_markdown(&content);
            Ok(html)
        },
        Err(e) => Err(format!("Failed to read file: {}", e))
    }
}

#[tauri::command]
fn get_launch_args() -> Vec<String> {
    env::args().collect()
}

#[tauri::command]
fn start_watching_file(
    file_path: String,
    app_handle: AppHandle,
    watcher_state: tauri::State<WatcherState>,
) -> Result<(), String> {
    // Stop any existing watcher first
    stop_watching_file(watcher_state.clone()).ok();
    
    let app_handle_clone = app_handle.clone();
    let file_path_clone = file_path.clone();
    
    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        match res {
            Ok(event) => {
                // Only respond to write events
                if matches!(event.kind, EventKind::Modify(_)) {
                    if let Some(path) = event.paths.first() {
                        if path.to_string_lossy() == file_path_clone {
                            // Emit event to frontend
                            app_handle_clone.emit("file-changed", &file_path_clone).ok();
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("Watch error: {:?}", e);
            }
        }
    }).map_err(|e| format!("Failed to create watcher: {}", e))?;
    
    // Watch the file's parent directory
    let path = Path::new(&file_path);
    if let Some(parent) = path.parent() {
        watcher.watch(parent, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to watch directory: {}", e))?;
    } else {
        return Err("File has no parent directory".to_string());
    }
    
    // Store the watcher in state
    let mut watcher_guard = watcher_state.lock().unwrap();
    *watcher_guard = Some(watcher);
    
    Ok(())
}

#[tauri::command]
fn stop_watching_file(watcher_state: tauri::State<WatcherState>) -> Result<(), String> {
    let mut watcher_guard = watcher_state.lock().unwrap();
    *watcher_guard = None;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let watcher_state: WatcherState = Arc::new(Mutex::new(None));
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(watcher_state)
        .invoke_handler(tauri::generate_handler![
            greet, 
            parse_markdown, 
            read_markdown_file, 
            get_launch_args,
            start_watching_file,
            stop_watching_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
