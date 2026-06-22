## 1. Start platform

```bash
docker compose up -d
```

## 2. Login

- URL: http://localhost:8080
- Login: `admin` / Password: `Admin123!`

## 3. Create endpoint group

**Endpoint Groups** → **New Group** → Name: `SHOP`

## 4. Create endpoint

**Endpoints** → **New Endpoint**:
- Name: Products
- Path: `/api/products`
- Method: GET
- Group: SHOP

## 5. Add schema

Open full editor → **Schema** → Add fields:
- `name` (string, required)
- `price` (number, required)

## 6. Create POST endpoint

Same path `/api/products`, method POST, same schema.

## 7. Test

**Test** tab → Send request with JSON body.

Or via curl — see [Getting Started](https://dynamic-api-platform.github.io/Dynamic-API-Platform/getting-started/).
