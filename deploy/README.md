# Helm chart

`deploy/ftree/` installs the ftree UI and BFF into Kubernetes.
Every release pushes it to `oci://ghcr.io/schillpeet/charts/ftree`, with the release version as chart and app version.
Running it in a cluster (Flux, Terraform, Secrets, backups) lives in the private [`schillpeet/ftree-infra`](https://github.com/schillpeet/ftree-infra) repository.

## Before installing

- PostgreSQL is not part of the chart: the database and a Secret with its password (`db.existingSecret`, key `password`) must exist.
- Name the release `ftree`: the UI proxies `/api` to `http://ftree-bff:8080`.
- Set `bff.corsAllowedOrigins` to the origin the browser opens, for example `http://localhost:8088` behind a port-forward; otherwise every write fails with `403 Invalid CORS request`.

## Values

[`values.yaml`](ftree/values.yaml) explains each value; these are the ones you set.

| Value | Default | What it does |
| --- | --- | --- |
| `bff.auth.mode` | `cloudflare` | `cloudflare` verifies the Access JWT; `dev` signs everyone in as `dev@localhost`, for local clusters only |
| `bff.auth.teamDomain`, `bff.auth.audience` | empty | Access team domain and application AUD tag; required in `cloudflare` mode, or the chart refuses to render and Flux keeps the running release |
| `bff.roles.admins` | `[]` | emails of the bootstrap admins, who always stay admins |
| `bff.access` | empty | instead of `roles.admins`: an access file (`--set-file bff.access=access.yaml`) whose `admin: true` entries are the bootstrap admins and whose other entries the BFF imports into its database once; changing it restarts the BFF |
| `bff.cloudflare.*` | empty | `existingSecret` (key `api-token`), `accountId`, and `accessGroupId` let the BFF keep the Access group equal to everyone with access; `dryRun` only logs; unset, nothing is synced |
| `operator.name`, `operator.email` | empty | who runs the instance, shown on `/terms`, `/privacy`, and as the "Feedback" address; changing them needs a rollout, not a new image |
| `db.url`, `db.user`, `db.existingSecret` | `ftree-db`, `app` | the database connection |
| `ui.resources`, `bff.resources` | 256Mi, 512Mi | memory request and limit |

The BFF also exposes `/actuator/prometheus` on port `management` (8081, not in the Service) for a PodMonitor.

## Develop the chart

| Command | What it does |
| --- | --- |
| `helm lint deploy/ftree` | checks the structure and that the templates render valid YAML |
| `helm template ftree deploy/ftree` | renders the manifests without installing; `-s templates/ui.yaml` renders one template |
| `helm template ftree deploy/ftree \| kubectl apply --dry-run=server -f -` | lets a cluster validate the manifests |
| `helm package deploy/ftree --version 0.0.1 --app-version 0.0.1 --destination /tmp` | packs the chart as the release workflow does |

To try unreleased changes in kind, load locally built images into the cluster (it cannot see them otherwise) and install from this checkout; the database and the `ftree-db` Secret must exist first (cheatsheet in `ftree-infra`).

```bash
podman build -t localhost/ftree-ui:dev -f ui/Dockerfile ui
podman build -t localhost/ftree-bff:dev -f bff/Dockerfile .
podman save localhost/ftree-ui:dev localhost/ftree-bff:dev -o /tmp/ftree-images.tar
kind load image-archive /tmp/ftree-images.tar --name ftree
helm install ftree deploy/ftree --set ui.image.repository=localhost/ftree-ui --set ui.image.tag=dev --set ui.image.pullPolicy=Never --set bff.image.repository=localhost/ftree-bff --set bff.image.tag=dev --set bff.image.pullPolicy=Never --set bff.corsAllowedOrigins=http://localhost:8088 --set bff.auth.mode=dev --set bff.roles.admins={dev@localhost}
```

With Docker, use `docker build` and `docker save` with the same arguments.
If Flux manages the `ftree` release in that cluster, run `flux suspend helmrelease ftree` first and `helm upgrade` instead of `helm install`.
