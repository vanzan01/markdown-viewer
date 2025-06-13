use pulldown_cmark::{Parser, Options, html};
use std::fs;
use std::env;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use notify::{Watcher, RecommendedWatcher, RecursiveMode, Event, EventKind};
use tauri::{AppHandle, Emitter};
use syntect::parsing::SyntaxSet;
use syntect::highlighting::ThemeSet;
use syntect::html::highlighted_html_for_string;
use regex;

// Global state for file watcher
type WatcherState = Arc<Mutex<Option<RecommendedWatcher>>>;

// Security validation functions
fn validate_file_path(file_path: &str) -> Result<PathBuf, String> {
    let path = Path::new(file_path);
    
    // Check for path traversal attempts
    if file_path.contains("..") {
        return Err("Path traversal detected: '..' not allowed in file paths".to_string());
    }
    
    // Check for absolute paths to system directories (Windows and Unix)
    let absolute_path = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?
            .join(path)
    };
    
    // Canonicalize to resolve any remaining relative components
    let canonical_path = absolute_path.canonicalize()
        .map_err(|e| format!("Invalid file path: {}", e))?;
    
    // Check file extension - only allow markdown files
    let allowed_extensions = ["md", "markdown", "mdown", "mkd"];
    if let Some(extension) = canonical_path.extension() {
        if let Some(ext_str) = extension.to_str() {
            if !allowed_extensions.contains(&ext_str.to_lowercase().as_str()) {
                return Err(format!("Invalid file extension: {}. Only markdown files are allowed.", ext_str));
            }
        } else {
            return Err("Invalid file extension encoding".to_string());
        }
    } else {
        return Err("File must have a valid markdown extension (.md, .markdown, .mdown, .mkd)".to_string());
    }
    
    // Prevent access to system directories
    let canonical_str = canonical_path.to_string_lossy().to_lowercase();
    let forbidden_paths = if cfg!(windows) {
        vec![
            "c:\\windows",
            "c:\\program files",
            "c:\\program files (x86)",
            "c:\\users\\default",
            "c:\\programdata",
        ]
    } else {
        vec![
            "/etc",
            "/proc",
            "/sys",
            "/dev",
            "/root",
            "/boot",
            "/var/log",
        ]
    };
    
    for forbidden in &forbidden_paths {
        if canonical_str.starts_with(forbidden) {
            return Err(format!("Access denied: Cannot read files from system directory {}", forbidden));
        }
    }
    
    // Check if file actually exists
    if !canonical_path.exists() {
        return Err(format!("File does not exist: {}", canonical_path.display()));
    }
    
    // Check if it's actually a file (not a directory)
    if !canonical_path.is_file() {
        return Err(format!("Path is not a file: {}", canonical_path.display()));
    }
    
    Ok(canonical_path)
}

fn sanitize_markdown_content(content: &str) -> String {
    // Basic content validation - check for suspicious patterns
    let suspicious_patterns = [
        "<script",
        "javascript:",
        "data:text/html",
        "vbscript:",
        "on[a-z]*=", // onerror, onclick, onload, etc.
    ];
    
    let content_lower = content.to_lowercase();
    for pattern in &suspicious_patterns {
        if content_lower.contains(pattern) {
            eprintln!("Warning: Suspicious content detected in markdown: {}", pattern);
        }
    }
    
    // Return content as-is for now - client-side sanitization will handle the rest
    // In a future version, we could implement server-side sanitization here
    content.to_string()
}

fn validate_image_url(url: &str) -> bool {
    // Allow local file:// URLs and common image hosting domains
    if url.starts_with("file://") || url.starts_with("data:image/") {
        return true;
    }
    
    // Allow specific trusted domains for images
    let trusted_domains = [
        "httpbin.org",
        "via.placeholder.com",
        "picsum.photos",
        "images.unsplash.com",
        "raw.githubusercontent.com",
    ];
    
    if url.starts_with("http://") || url.starts_with("https://") {
        for domain in &trusted_domains {
            if url.contains(domain) {
                return true;
            }
        }
        eprintln!("Warning: Image URL from untrusted domain: {}", url);
        return false;
    }
    
    true
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn parse_markdown(markdown_content: &str) -> String {
    // Sanitize content first
    let sanitized_content = sanitize_markdown_content(markdown_content);
    
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_TASKLISTS);
    
    let parser = Parser::new_ext(&sanitized_content, options);
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
    // Validate file path for security
    let validated_path = validate_file_path(&file_path)?;
    
    match fs::read_to_string(&validated_path) {
        Ok(content) => {
            // Sanitize content
            let sanitized_content = sanitize_markdown_content(&content);
            let html = parse_markdown_with_base_path(&sanitized_content, &validated_path.to_string_lossy());
            Ok(html)
        },
        Err(e) => Err(format!("Failed to read file: {}", e))
    }
}

fn parse_markdown_with_base_path(markdown_content: &str, file_path: &str) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_TASKLISTS);
    
    let parser = Parser::new_ext(markdown_content, options);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);
    
    // Post-process HTML to add syntax highlighting and resolve image paths
    let html_with_syntax = post_process_syntax_highlighting(&html_output);
    post_process_image_paths(&html_with_syntax, file_path)
}

fn post_process_image_paths(html: &str, file_path: &str) -> String {
    let base_path = Path::new(file_path).parent().unwrap_or(Path::new("."));
    
    // Pattern to match image tags with relative paths
    let re_img = regex::Regex::new(r#"<img src="([^"]+)"#).unwrap();
    
    re_img.replace_all(html, |caps: &regex::Captures| {
        let src = &caps[1];
        
        // Validate URL for security
        if !validate_image_url(src) {
            eprintln!("Blocked unsafe image URL: {}", src);
            return format!("<img src=\"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkJsb2NrZWQgSW1hZ2U8L3RleHQ+PC9zdmc+\" alt=\"Blocked unsafe image\"");
        }
        
        // Skip URLs that are already absolute (http/https/data)
        if src.starts_with("http://") || src.starts_with("https://") || src.starts_with("data:") || src.starts_with("file://") {
            return caps[0].to_string();
        }
        
        // Convert relative path to absolute file:// URL with validation
        let full_path = base_path.join(src);
        
        // Security check: ensure the resolved path doesn't escape the base directory
        if let Ok(canonical_full) = full_path.canonicalize() {
            if let Ok(canonical_base) = base_path.canonicalize() {
                if !canonical_full.starts_with(&canonical_base) {
                    eprintln!("Blocked path traversal attempt in image: {}", src);
                    return format!("<img src=\"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkJsb2NrZWQgSW1hZ2U8L3RleHQ+PC9zdmc+\" alt=\"Blocked unsafe image\"");
                }
            }
        }
        
        if full_path.exists() {
            let absolute_path = full_path.canonicalize().unwrap_or(full_path);
            format!("<img src=\"file://{}\"", absolute_path.to_string_lossy())
        } else {
            // Keep original if file doesn't exist (might be intentional)
            caps[0].to_string()
        }
    }).to_string()
}

#[tauri::command]
fn get_launch_args() -> Vec<String> {
    env::args().collect()
}

#[tauri::command]
fn export_html(content: String, title: String) -> Result<String, String> {
    let html_template = format!(r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{}</title>
    <style>
        :root {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 16px;
            line-height: 1.6;
            color: #333;
            background-color: #fff;
        }}
        
        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}
        
        body {{
            max-width: 900px;
            margin: 0 auto;
            padding: 2rem;
        }}
        
        h1, h2, h3, h4, h5, h6 {{
            margin-top: 1.5rem;
            margin-bottom: 0.5rem;
            font-weight: 600;
            line-height: 1.25;
        }}
        
        h1 {{
            font-size: 2rem;
            border-bottom: 1px solid #e9ecef;
            padding-bottom: 0.5rem;
        }}
        
        h2 {{
            font-size: 1.5rem;
            border-bottom: 1px solid #f1f3f4;
            padding-bottom: 0.25rem;
        }}
        
        h3 {{ font-size: 1.25rem; }}
        h4 {{ font-size: 1rem; }}
        
        p {{ margin-bottom: 1rem; }}
        
        ul, ol {{
            margin-bottom: 1rem;
            padding-left: 2rem;
        }}
        
        li {{ margin-bottom: 0.25rem; }}
        
        blockquote {{
            border-left: 4px solid #e9ecef;
            padding-left: 1rem;
            margin: 1rem 0;
            color: #6c757d;
            font-style: italic;
        }}
        
        code {{
            background: #f8f9fa;
            padding: 0.125rem 0.25rem;
            border-radius: 0.25rem;
            font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
            font-size: 0.875rem;
        }}
        
        pre {{
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 0.5rem;
            overflow-x: auto;
            margin: 1rem 0;
        }}
        
        pre code {{
            background: none;
            padding: 0;
        }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border-radius: 0.5rem;
            overflow: hidden;
        }}
        
        th, td {{
            border: 1px solid #e9ecef;
            padding: 0.75rem;
            text-align: left;
            vertical-align: top;
        }}
        
        th {{
            background: #f8f9fa;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.875rem;
            letter-spacing: 0.05em;
        }}
        
        tr:nth-child(even) {{
            background-color: #f8f9fa;
        }}
        
        tr:hover {{
            background-color: #e9ecef;
        }}
        
        img {{
            max-width: 100%;
            height: auto;
            border-radius: 0.5rem;
            margin: 1rem 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }}
        
        a {{
            color: #007bff;
            text-decoration: none;
        }}
        
        a:hover {{
            text-decoration: underline;
        }}
        
        @media print {{
            body {{
                padding: 1rem;
                max-width: none;
            }}
            
            img {{
                page-break-inside: avoid;
            }}
            
            table {{
                page-break-inside: avoid;
            }}
        }}
    </style>
</head>
<body>
{}
</body>
</html>"#, title, content);

    Ok(html_template)
}

#[tauri::command]
fn start_watching_file(
    file_path: String,
    app_handle: AppHandle,
    watcher_state: tauri::State<WatcherState>,
) -> Result<(), String> {
    // Validate file path for security
    let validated_path = validate_file_path(&file_path)?;
    let validated_path_str = validated_path.to_string_lossy().to_string();
    
    // Stop any existing watcher first
    stop_watching_file(watcher_state.clone()).ok();
    
    let app_handle_clone = app_handle.clone();
    let file_path_clone = validated_path_str.clone();
    
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
    let path = Path::new(&validated_path_str);
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

#[tauri::command]
fn read_file_content(file_path: String) -> Result<String, String> {
    // Validate file path for security
    let validated_path = validate_file_path(&file_path)?;
    
    match fs::read_to_string(&validated_path) {
        Ok(content) => {
            // Return raw content without processing for DOCX export
            Ok(content)
        },
        Err(e) => Err(format!("Failed to read file: {}", e))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let watcher_state: WatcherState = Arc::new(Mutex::new(None));
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(watcher_state)
        .invoke_handler(tauri::generate_handler![
            greet, 
            parse_markdown, 
            read_markdown_file, 
            get_launch_args,
            start_watching_file,
            stop_watching_file,
            export_html,
            read_file_content
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
