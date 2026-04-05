use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::time::Duration;

fn url_decode(s: &str) -> String {
    urlencoding::decode(s)
        .unwrap_or(std::borrow::Cow::Borrowed(s))
        .into_owned()
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

#[derive(Debug, serde::Serialize)]
pub struct OAuthResult {
    pub code: String,
    pub redirect_uri: String,
}

/// Starts a one-shot HTTP server on an ephemeral port, opens the OAuth URL
/// in the browser, waits for Google to redirect back with a `code`, and
/// returns both the code and the redirect URI that was used.
/// If `expected_state` is provided, validates the `state` parameter in the callback.
pub fn wait_for_oauth_code(auth_url_base: &str, expected_state: Option<&str>) -> Result<OAuthResult, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind OAuth listener: {}", e))?;

    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get listener address: {}", e))?
        .port();

    let redirect_uri = format!("http://localhost:{}/callback", port);

    let auth_url = format!(
        "{}&redirect_uri={}",
        auth_url_base,
        urlencoding::encode(&redirect_uri)
    );

    open::that(&auth_url).map_err(|e| format!("Failed to open browser: {}", e))?;

    // 5 minute timeout — avoids blocking forever if user cancels the browser flow
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("Failed to configure listener: {}", e))?;

    let timeout = Duration::from_secs(300);
    let start = std::time::Instant::now();
    let (mut stream, _) = loop {
        match listener.accept() {
            Ok(conn) => break conn,
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                if start.elapsed() >= timeout {
                    return Err("OAuth timed out after 5 minutes".to_string());
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(e) => return Err(format!("Failed to accept connection: {}", e)),
        }
    };

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

    Ok(OAuthResult { code: params.code, redirect_uri })
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
}
