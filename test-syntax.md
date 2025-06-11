# Syntax Highlighting Test

This is a test file to verify syntax highlighting is working.

## JavaScript Example

```javascript
function greet(name) {
    console.log("Hello, " + name + "!");
    return `Welcome ${name}`;
}

const user = "World";
greet(user);
```

## Python Example

```python
def fibonacci(n):
    """Calculate fibonacci number."""
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# Test the function
for i in range(10):
    print(f"fib({i}) = {fibonacci(i)}")
```

## Rust Example

```rust
fn main() {
    let message = "Hello, Rust!";
    println!("{}", message);
    
    let numbers = vec![1, 2, 3, 4, 5];
    let sum: i32 = numbers.iter().sum();
    println!("Sum: {}", sum);
}
```

## Plain Code Block

```
This is a plain code block without language specification.
No syntax highlighting should be applied here.
```