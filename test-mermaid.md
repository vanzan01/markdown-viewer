# Mermaid Diagram Test

This file tests the Mermaid diagram integration.

## Flowchart Example

```mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant App
    participant Mermaid
    
    User->>App: Load markdown file
    App->>Mermaid: Parse diagram syntax
    Mermaid->>App: Return SVG
    App->>User: Display rendered diagram
```

## Gantt Chart

```mermaid
gantt
    title Mermaid Integration Timeline
    dateFormat  YYYY-MM-DD
    section Development
    Add Mermaid library    :done, lib, 2024-01-01, 1d
    Implement processing   :active, proc, after lib, 2d
    Test diagrams         :test, after proc, 1d
    section Documentation
    Update README         :doc, after test, 1d
```

## Class Diagram

```mermaid
classDiagram
    class MarkdownViewer {
        +String currentFilePath
        +String currentContent
        +loadFile(path)
        +processMermaid()
        +renderHTML()
    }
    
    class MermaidProcessor {
        +initialize()
        +renderDiagram(text)
        +handleError(error)
    }
    
    MarkdownViewer --> MermaidProcessor : uses
```

## Pie Chart

```mermaid
pie title Implementation Status
    "Complete" : 70
    "In Progress" : 20
    "Planned" : 10
```

## Invalid Mermaid (should show error)

```mermaid
this is not valid mermaid syntax
it should show an error message
```

## Regular Code Block (should not be processed)

```javascript
// This is regular JavaScript, not Mermaid
console.log("This should stay as code");
```