Full FAQ: [FAQ](https://dynamic-api-platform.github.io/Dynamic-API-Platform/faq/)

**Q: Which deployment option should I use?**  
- Quick start / dev → Docker single (`docker compose up -d`)  
- HA MongoDB without K8s → [Docker replica set](MongoDB-Replica-Set)  
- Production cluster → [Kubernetes](Kubernetes)  
See [Deployment Variants](Deployment-Variants).

**Q: Can I use GET and POST on same path?**  
Yes, data is shared via `resourcePath`.

**Q: Can I link records between endpoints?**  
Yes. Use schema type **`reference`**, pick the target endpoint, pass a record `id`. Use `?populate=` on GET.

**Q: Do I need to restart the server for new endpoints?**  
No. Routes are loaded from MongoDB on each request.

**Q: How do I run tests?**  
`cd backend && npm test` — see [Testing](Testing).

**Q: Can I delete system endpoints?**  
No, they are protected.

**Q: Test on `/api/users` returns Forbidden?**  
Update to the latest backend — the tester uses the real management API with RBAC.

**Q: Can I restrict endpoints by domain or IP?**  
Yes — [Network Access](Network-Access). Configure on endpoint groups or the Network Access tab.

**Q: Can I browse MongoDB in the UI?**  
Yes — [Database Explorer](Database-Explorer) (`/database`, requires `manage_users`).

**Q: What is MCP Server?**  
JSON-RPC at `POST /api/mcp` exposes dynamic endpoints as AI agent tools. **Requires JWT Bearer or API key** (same as direct `/api/…` calls). Admin UI at `/mcp`.

**Q: Light or dark theme?**  
Four themes: Dark, Light, Ocean, Forest. Click the **palette** icon in the header. See [Themes](Themes).

**Q: What is the Live badge in the header?**  
**Dashboard** and **System** auto-refresh (shows interval and time). Other pages show **статические данные**. See [Live UI](Live-UI).

**Q: How to reset database?**  
`docker compose down -v && docker compose up -d` (**deletes all data**). Replica set: `docker compose -f docker-compose.replica.yml down -v`.

**Q: License?**  
Apache License 2.0
