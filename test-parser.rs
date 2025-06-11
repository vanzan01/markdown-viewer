use pulldown_cmark::{Parser, Options, html};

fn main() {
    let test_content = r#"# Test Images and Tables

## Table Test
| Name | Age | City |
|------|-----|------|
| Alice | 30 | New York |
| Bob | 25 | London |

## Image Test
![Test Image](https://via.placeholder.com/300x200/0066cc/ffffff?text=Test+Image)

## Raw Output Test
This shows what pulldown-cmark currently outputs.
"#;

    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_TASKLISTS);
    
    let parser = Parser::new_ext(test_content, options);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);
    
    println!("Raw HTML output:");
    println!("{}", html_output);
}