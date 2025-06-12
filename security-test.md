# Security Test Document

This document tests various security scenarios to ensure the markdown viewer is protected.

## Script Injection Test
```html
<script>alert('XSS Attack!');</script>
```

## Event Handler Test
<img src="nonexistent.jpg" onerror="alert('Image XSS')" />

## Path Traversal Test
![Image](../../../etc/passwd)

## Malicious Link Test
[Malicious Link](javascript:alert('JavaScript URI'))

## Data URI Test
![Data URI](data:text/html,<script>alert('Data URI XSS')</script>)

## Iframe Test
<iframe src="javascript:alert('Iframe XSS')"></iframe>

## Object Test
<object data="data:text/html,<script>alert('Object XSS')</script>"></object>

## Form Test
<form action="javascript:alert('Form XSS')">
  <input type="submit" value="Submit">
</form>

This should all be safely rendered without executing any scripts.