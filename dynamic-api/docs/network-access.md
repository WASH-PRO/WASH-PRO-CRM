---
layout: default
redirect_from:
  - /network-access.html

title: Network Access
description: Restrict dynamic API calls by domain and IP/CIDR
---

**Network access** rules let you restrict who can call a dynamic endpoint based on **client domain** (browser `Origin` / `Referer` / `Host`) and **client IP address** (including CIDR pools). This is separate from JWT/RBAC **access types** (`public`, `authenticated`, `group`).

Rules can be configured on **endpoint groups** (defaults for all endpoints in the group) and on individual **endpoints** (with optional inheritance from the group).

## Where to configure

| Level | UI location |
|-------|-------------|
| **Endpoint group** | **Endpoint Groups** → create/edit group → **Network Access** section |
| **Endpoint** | **Endpoints** → edit endpoint → **Network Access** tab |

When network restrictions are enabled on a group, its card shows a **Network restricted** badge with rule counts.

## Rule structure

Each endpoint or group stores:

| Field | Description |
|-------|-------------|
| `enabled` | Turn network filtering on or off |
| `allowedDomains` | Hostnames allowed to call the API (e.g. `app.example.com`, `*.example.com`) |
| `allowedIpRanges` | IPv4 addresses or CIDR blocks (e.g. `203.0.113.10`, `10.0.0.0/8`) |

### Domain patterns

- Exact match: `app.example.com`
- Wildcard subdomains: `*.example.com` matches `api.example.com` and `app.example.com`
- `localhost` is supported for local development

Domains are read from request headers in order: **`Origin`**, **`Referer`**, **`Host`**.

### IP / CIDR pools

- Single IPv4: `192.168.1.50`
- CIDR block: `10.0.0.0/8`, `203.0.113.0/24`

Client IP is taken from `X-Forwarded-For` (first hop) or the direct connection IP.

## Inheritance (endpoints)

Endpoints have **Inherit rules from endpoint group** (default: on).

| Endpoint setting | Group rules | Effective behavior |
|------------------|-------------|-------------------|
| Network access **off**, inherit **on** | enabled | Group rules apply |
| Network access **on**, inherit **on** | enabled | Group + endpoint rules **merged** (union of domains and IP ranges) |
| Network access **on**, inherit **off** | any | Endpoint rules only |
| Network access **off**, inherit **off** | enabled | No network filter on this endpoint |

## Enforcement logic

When network access is enabled and at least one domain or IP rule is configured:

- If **only domains** are set → request must match a domain
- If **only IPs** are set → request must match an IP/CIDR
- If **both** are set → request is allowed if **either** domain **or** IP matches

If enabled but both lists are empty, no network filter is applied (configure at least one rule to restrict access).

Blocked requests return **`403 Forbidden: network access denied`**.

Network checks run **after** the endpoint is matched and **before** JWT access-type checks (`public` / `authenticated` / `group`).

## Testing from the admin panel

The built-in **Test** tab does **not** apply network rules by default (so admins can test freely).

To simulate real client restrictions:

1. Enable **Apply network access rules during test**
2. Optionally set **Simulated client IP** and **Origin header**
3. Send the request

## Example: internal API for one frontend

**Endpoint group "Internal"**

- Enable network access
- Domains: `app.mycompany.com`, `*.mycompany.com`
- IPs: `10.0.0.0/8`

**Endpoint `GET /api/reports`**

- Inherit from group (default)
- Access type: `authenticated`

Result: only requests from your corporate network or your web app domain, with a valid JWT, succeed.

## Example: server-to-server only

**Endpoint `POST /api/webhooks/inbound`**

- Enable network access, inherit **off**
- IPs: `203.0.113.0/24` (partner subnet)
- Access type: `public` or `authenticated` as needed

Browser calls without matching IP are blocked even with a token.

## Limitations

- IPv6 CIDR matching is not supported (exact IPv6 match only if listed literally)
- Domain rules require browser-like headers; pure server clients without `Origin` rely on IP rules
- System/management routes (`/api/users`, `/api/auth/*`, etc.) are not affected — only **dynamic** endpoints served by the runtime engine

## Related

- [RBAC — endpoint access types]({{ '/rbac/' | relative_url }}#endpoint-access-types)
- [Dynamic API Engine]({{ '/dynamic-api-engine/' | relative_url }})
- [Troubleshooting — network access denied]({{ '/troubleshooting/' | relative_url }}#forbidden-network-access-denied)
