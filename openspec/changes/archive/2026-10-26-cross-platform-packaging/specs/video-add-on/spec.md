## ADDED Requirements

### Requirement: Downloading behind a proxy
The add-on download SHALL use the standard `HTTPS_PROXY`, `HTTP_PROXY` and `NO_PROXY` settings (in either upper or lower case) when they are set, through Node.js's built-in proxy support.

#### Scenario: Behind a proxy
- **WHEN** `HTTPS_PROXY` (or `HTTP_PROXY` for an `http` address) points to a proxy and the add-on is downloaded
- **THEN** the download goes through the proxy and the add-on is installed

#### Scenario: HTTPS download through HTTPS_PROXY
- **WHEN** `HTTPS_PROXY` is set and the download address starts with `https`
- **THEN** konvertoj connects to the proxy and asks it for a tunnel to the download host on port 443

#### Scenario: Excluded by NO_PROXY
- **WHEN** the download address is listed in `NO_PROXY`
- **THEN** the download connects directly

#### Scenario: No proxy settings
- **WHEN** no proxy setting is set
- **THEN** the download connects directly, as before

### Requirement: Proxy problems explained
A proxy setting that isn't a valid address SHALL fail with a plain-English message naming the setting and showing the expected form. On a Node.js version without runtime proxy support, a failed connection with a proxy setting SHALL say how to use the proxy: set `NODE_USE_ENV_PROXY=1` (Node.js 22.21 or newer) or update Node.js.

#### Scenario: Invalid proxy setting
- **WHEN** `HTTPS_PROXY` is set to `proxy.corp:8080`, which has no `http://`
- **THEN** the run fails saying `HTTPS_PROXY` isn't a valid proxy address, that it should look like `http://proxy.example.com:8080`, and to fix or unset it, with no stack trace

#### Scenario: Older Node.js with a proxy setting
- **WHEN** Node.js has no runtime proxy support, `NODE_USE_ENV_PROXY` isn't set, a proxy setting is set and the download can't connect
- **THEN** the connection message adds that konvertoj found a proxy setting and says to set `NODE_USE_ENV_PROXY=1` (Node.js 22.21 or newer) or update Node.js
