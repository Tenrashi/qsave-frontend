use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;

const LISTEN_PORT: u16 = 19842;

pub fn get_redirect_uri() -> String {
    format!("http://localhost:{}/callback", LISTEN_PORT)
}

fn url_decode(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.bytes();
    while let Some(b) = chars.next() {
        if b == b'%' {
            let hi = chars.next().unwrap_or(0);
            let lo = chars.next().unwrap_or(0);
            let hex = [hi, lo];
            if let Ok(decoded) = u8::from_str_radix(std::str::from_utf8(&hex).unwrap_or(""), 16) {
                result.push(decoded as char);
                continue;
            }
            result.push('%');
            result.push(hi as char);
            result.push(lo as char);
            continue;
        }
        result.push(b as char);
    }
    result
}

#[derive(Debug)]
struct CallbackParams {
    code: String,
    state: Option<String>,
}

fn extract_callback_params(request_line: &str) -> Result<CallbackParams, String> {
    // Request line looks like: GET /callback?code=XXXX&scope=...&state=YYY HTTP/1.1
    let path = request_line
        .split_whitespace()
        .nth(1)
        .ok_or("Malformed request")?;

    let query = path.split('?').nth(1).ok_or("No query parameters")?;

    let mut code: Option<String> = None;
    let mut state: Option<String> = None;

    for param in query.split('&') {
        let Some((key, value)) = param.split_once('=') else {
            continue;
        };
        match key {
            "code" => code = Some(url_decode(value)),
            "state" => state = Some(url_decode(value)),
            "error" => return Err(format!("OAuth error: {}", value)),
            _ => {}
        }
    }

    let code = code.ok_or_else(|| "No authorization code in callback".to_string())?;
    Ok(CallbackParams { code, state })
}

fn send_html_response(stream: &mut std::net::TcpStream, html: &str) {
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html.len(),
        html
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

/// Starts a one-shot HTTP server, opens the OAuth URL in the browser,
/// waits for Google to redirect back with a `code`, and returns it.
/// If `expected_state` is provided, validates the `state` parameter in the callback.
pub fn wait_for_oauth_code(auth_url: &str, expected_state: Option<&str>) -> Result<String, String> {
    let listener = TcpListener::bind(format!("127.0.0.1:{}", LISTEN_PORT))
        .map_err(|e| format!("Failed to bind OAuth listener: {}", e))?;

    open::that(auth_url).map_err(|e| format!("Failed to open browser: {}", e))?;

    let (mut stream, _) = listener
        .accept()
        .map_err(|e| format!("Failed to accept connection: {}", e))?;

    let reader = BufReader::new(&stream);
    let request_line = reader
        .lines()
        .next()
        .ok_or("No request received")?
        .map_err(|e| format!("Failed to read request: {}", e))?;

    let params = extract_callback_params(&request_line)?;

    if let Some(expected) = expected_state {
        let actual = params.state.as_deref().unwrap_or("");
        if actual != expected {
            let html = r#"<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
        <p>Authentication failed — invalid state. Please try again from QSave.</p>
    </body></html>"#;
            send_html_response(&mut stream, html);
            return Err("OAuth state mismatch — possible CSRF attack".to_string());
        }
    }

    let html = r#"<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
        <p>Signed in! You can close this tab and return to QSave.</p>
    </body></html>"#;
    send_html_response(&mut stream, html);

    Ok(params.code)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_code_from_request_line() {
        let line = "GET /callback?code=4/0abc123&scope=email HTTP/1.1";
        let params = extract_callback_params(line).unwrap();
        assert_eq!(params.code, "4/0abc123");
        assert_eq!(params.state, None);
    }

    #[test]
    fn extracts_code_and_state() {
        let line = "GET /callback?code=4/0abc123&state=abc-def&scope=email HTTP/1.1";
        let params = extract_callback_params(line).unwrap();
        assert_eq!(params.code, "4/0abc123");
        assert_eq!(params.state.as_deref(), Some("abc-def"));
    }

    #[test]
    fn decodes_url_encoded_code() {
        let line = "GET /callback?code=4%2F0abc123&scope=email HTTP/1.1";
        let params = extract_callback_params(line).unwrap();
        assert_eq!(params.code, "4/0abc123");
    }

    #[test]
    fn returns_error_for_oauth_error() {
        let line = "GET /callback?error=access_denied HTTP/1.1";
        assert!(extract_callback_params(line)
            .unwrap_err()
            .contains("access_denied"));
    }

    #[test]
    fn returns_error_for_missing_code() {
        let line = "GET /callback?state=xyz HTTP/1.1";
        assert!(extract_callback_params(line).is_err());
    }

    #[test]
    fn returns_error_for_malformed_request() {
        assert!(extract_callback_params("").is_err());
    }

    #[test]
    fn redirect_uri_includes_port() {
        let uri = get_redirect_uri();
        assert_eq!(uri, format!("http://localhost:{}/callback", LISTEN_PORT));
    }
}
