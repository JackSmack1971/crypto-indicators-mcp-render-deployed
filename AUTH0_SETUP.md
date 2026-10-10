# Auth0 setup for ChatGPT MCP

This repository's HTTP resource server supports Auth0-issued **RS256 JWT access tokens** after the Auth0 tenant is configured. This server is **not** an OAuth authorization server.

## Configure Auth0

1. Open https://manage.auth0.com and select the intended tenant.
2. **Applications → APIs → Create API**:
   - Name: `Crypto Indicators MCP`
   - Identifier: `https://crypto-indicators-mcp-render.onrender.com/mcp`
   - Signing algorithm: `RS256`
3. Add the API permission **`indicators:read`**. Configure the API's RBAC and token permissions as needed for allowed users.
4. For third-party clients such as ChatGPT, configure Auth0 **Dynamic Client Registration** and third-party application client grants / default permissions so dynamically created clients can request **only** `indicators:read`. DCR is disabled by default; enabling open DCR allows external clients to register, so review tenant security and access controls first.
5. Under tenant **Settings → Advanced**, enable **Resource Parameter Compatibility Profile**, so OAuth `resource` requests target the registered API audience. Without this, clients may receive opaque userinfo tokens that the MCP server correctly rejects.
6. Enable PKCE S256 / authorization-code flow as supported by the client registration. Configure allowed callbacks if using a manually registered client; use the exact callback provided by the ChatGPT connection setup, not a guessed callback URL.

Auth0 sources:
- https://auth0.com/docs/get-started/applications/dynamic-client-registration
- https://support.auth0.com/center/s/article/mcp-audience-error-with-auth0
- https://developers.openai.com/plugins/build/auth

## Configure Render

In Render, edit **crypto-indicators-mcp-render → Environment** and add:

```text
OAUTH_ISSUER_URL=https://YOUR_AUTH0_DOMAIN/
OAUTH_AUDIENCE=https://crypto-indicators-mcp-render.onrender.com/mcp
OAUTH_SCOPE=indicators:read
MCP_RESOURCE_URL=https://crypto-indicators-mcp-render.onrender.com/mcp
```

Use the issuer URL that Auth0 actually uses when issuing tokens, including a trailing slash. `YOUR_AUTH0_DOMAIN` is the verified Auth0 tenant domain (or configured custom domain). Never put Auth0 client secrets or management API tokens in GitHub.

After these variables are set and the service restarts, `/mcp` requires valid OAuth access tokens, not the legacy static bearer token. Remove or rotate the legacy `MCP_BEARER_TOKEN` in Render when the migration is verified.

## Acceptance checks (not yet completed)

1. `GET /health` returns `oauth_configured: true`.
2. `GET /.well-known/oauth-protected-resource` advertises the expected resource and authorization server.
3. Unauthenticated `POST /mcp` returns 401 with `WWW-Authenticate` resource metadata.
4. Auth0's OIDC metadata supports PKCE S256 and the chosen client-registration method (DCR or a supported predefined client).
5. A real Auth0 access token issued for the registered API with `indicators:read` can call `tools/list`; missing / invalid audience, scope or signature is rejected.
6. One indicator call works with exchange OHLCV data. An OAuth login and ChatGPT plugin connection succeed.

Do not interpret a live Render health check as proof that Auth0 login or ChatGPT OAuth works.
