# Tauri Development Troubleshooting Guide

## WSL + Windows Rust Development Setup

This document outlines the troubleshooting steps taken to get Tauri development working in a WSL environment with Windows-installed Rust.

### Problem

Initial attempt to run `npm run tauri dev` failed with multiple issues:
1. Tauri CLI couldn't find Rust/Cargo
2. Configuration errors in `tauri.conf.json`
3. Invalid dependency features in `Cargo.toml`

### Environment

- **Development Environment**: WSL2 (Linux)
- **Rust Installation**: Windows (via Scoop package manager)
- **Project Structure**: Tauri v2 application
- **Rust Location**: `C:\Users\nicki\scoop\apps\rustup\current\.cargo\bin\`

### Troubleshooting Steps

#### 1. Rust Detection Issues

**Problem**: WSL couldn't find Windows-installed Rust
```bash
cargo --version
# bash: cargo: command not found
```

**Investigation**:
```bash
# Tried basic PowerShell invocation
powershell.exe -Command "rustc --version"
# Error: rustc not recognized

# Checked Windows PATH
powershell.exe -Command "where.exe cargo"
# Error: Could not find files

# Found Rust was installed but not configured
powershell.exe -Command "C:\Users\nicki\scoop\apps\rustup\current\.cargo\bin\cargo.exe --version"
# Error: rustup could not choose a version
```

**Solution**: Set default Rust toolchain
```bash
powershell.exe -Command "C:\Users\nicki\scoop\apps\rustup\current\.cargo\bin\rustup.exe default stable"
```

#### 2. Tauri Configuration Errors

**Problem**: Duplicate `identifier` in `tauri.conf.json`
```json
{
  "identifier": "com.markdown-viewer.app",  // ❌ Duplicate
  "bundle": {
    "identifier": "com.markdown-viewer.app"  // ❌ Duplicate
  }
}
```

**Error Message**:
```
Error `tauri.conf.json` error on `bundle`: Additional properties are not allowed ('identifier' was unexpected)
```

**Solution**: Keep identifier only at root level for Tauri v2
```json
{
  "identifier": "com.markdown-viewer.app",  // ✅ Keep this
  "bundle": {
    // ✅ Remove identifier from bundle section
  }
}
```

#### 3. Invalid Cargo Dependencies

**Problem 1**: Invalid Tauri features
```toml
tauri = { version = "2", features = ["api-all"] }  # ❌ api-all doesn't exist in v2
```

**Error**: 
```
the package `markdown-viewer` depends on `tauri`, with features: `api-all` but `tauri` does not have these features.
```

**Solution**:
```toml
tauri = { version = "2", features = [] }  # ✅ Use empty features for basic setup
```

**Problem 2**: Invalid pulldown-cmark features
```toml
pulldown-cmark = { version = "0.9", features = ["html"] }  # ❌ html feature doesn't exist
```

**Solution**:
```toml
pulldown-cmark = "0.9"  # ✅ Use default features
```

#### 4. Final Working Command

**PowerShell Command from WSL**:
```bash
powershell.exe -Command '$env:PATH += ";C:\Users\nicki\scoop\apps\rustup\current\.cargo\bin"; cd "H:\Active\Markdown-Viewer\project\markdown-viewer"; npm run tauri dev -- --no-watch'
```

### Key Learnings

1. **WSL-Windows PATH Issues**: Windows-installed tools need explicit PATH setup when called from WSL
2. **Tauri v2 Changes**: Configuration schema differs from v1, features have changed
3. **Rust Toolchain**: Must have default toolchain set for rustup to work properly
4. **Dependency Features**: Always verify feature flags exist in the specified version

### Working Development Workflow

For future development, use this command pattern:

```bash
# Set up environment and run Tauri dev
powershell.exe -Command '
$env:PATH += ";C:\Users\nicki\scoop\apps\rustup\current\.cargo\bin"; 
cd "H:\Active\Markdown-Viewer\project\markdown-viewer"; 
npm run tauri dev
'
```

### Performance Results

- **Initial Build**: ~65 seconds (with dependency compilation)
- **Application Launch**: Successful
- **Configuration**: All files validated and working

### Files Modified

1. **`src-tauri/tauri.conf.json`**: Removed duplicate identifier
2. **`src-tauri/Cargo.toml`**: Fixed invalid features for tauri and pulldown-cmark

This troubleshooting process established a working Tauri development environment in WSL with Windows Rust installation.