# 🖼️ Image and Table Rendering Test

This test file verifies **enhanced image and table rendering capabilities** with improved CSS styling.

## 📊 Table Examples

### Basic Table with Enhanced Styling
| Name | Age | City | Status |
|------|-----|------|--------|
| Alice | 30 | New York | ✅ Active |
| Bob | 25 | London | 🔄 Pending |
| Charlie | 35 | Tokyo | ✅ Active |
| Diana | 28 | Paris | ❌ Inactive |

### Table with Alignment
| Left Aligned | Center Aligned | Right Aligned |
|:-------------|:--------------:|--------------:|
| Left text | Center text | Right text |
| More left | More center | More right |
| Even more | Even more | Even more |

### Complex Table
| Feature | Status | Language | Performance | Notes |
|---------|--------|----------|-------------|-------|
| Syntax Highlighting | ✅ Complete | Rust + syntect | Excellent | 20+ languages |
| Auto-reload | ✅ Complete | Rust + notify | Fast | File watching |
| Tables | 🧪 Testing | pulldown-cmark | Good | This table |
| Images | 🧪 Testing | pulldown-cmark | TBD | Below examples |

## Image Examples

### Basic Image Reference
![Test Image](https://via.placeholder.com/300x200/0066cc/ffffff?text=Test+Image)

### Image with Alt Text
![Beautiful landscape with mountains and lake](https://via.placeholder.com/400x250/4CAF50/ffffff?text=Beautiful+Landscape)

### Reference Style Image
This is an image reference: ![Reference Image][ref-img]

### Local Image Reference (may not load)
![Local test image](./test-image.png)

## Mixed Content

Here's a table with image references:

| Type | Preview | Status |
|------|---------|--------|
| Online Image | ![Small](https://via.placeholder.com/50x50/ff6b6b/ffffff?text=OK) | Working |
| Local Image | ![Local](./missing.png) | May fail |
| No Image | N/A | Control |

## Image Variations

### Different Sizes
- Small: ![Small](https://via.placeholder.com/100x100/6c5ce7/ffffff?text=Small)
- Medium: ![Medium](https://via.placeholder.com/200x150/a29bfe/ffffff?text=Medium)
- Large: ![Large](https://via.placeholder.com/400x300/fd79a8/ffffff?text=Large)

### Image Links
[![Clickable Image](https://via.placeholder.com/200x100/00b894/ffffff?text=Click+Me)](https://example.com)

---

[ref-img]: https://via.placeholder.com/350x200/2d3436/ffffff?text=Reference+Style+Image

*This file tests both table rendering and image display capabilities.*