# Deployment

`deploy/ftree/` is the Helm chart that installs the ftree UI and BFF into Kubernetes.
PostgreSQL is not part of the chart; the BFF reads `db.url`, `db.user`, and the `password` key of the Secret named in `db.existingSecret`.
Always install the release as `ftree`: the UI image proxies `/api` to `http://ftree-bff:8080`, so the BFF Service must be named `ftree-bff`.
Set `bff.corsAllowedOrigins` to the origin the browser opens the UI on (for example `http://localhost:8088` behind a port-forward); the proxy forwards the browser's `Origin`, so the BFF otherwise rejects every write with `403 Invalid CORS request`.
`bff.auth.mode` is `cloudflare` by default: the BFF then verifies the Cloudflare Access JWT and needs `bff.auth.teamDomain` (for example `example.cloudflareaccess.com`) and `bff.auth.audience` (the Access application's AUD tag); without them the chart refuses to render, so Flux keeps the running release.
`bff.auth.mode: dev` signs every request in as the unverified `dev@localhost` and is only for local clusters without Cloudflare Access.
`bff.access` holds the access file as one string (for example `--set-file bff.access=access.yaml`): every person with `admin: true`, `developer: true`, or exactly one family slug with their role (`editor` or `visitor`) under `trees`.
Its `admin: true` entries are the bootstrap admins, who always stay admins; the BFF imports everything else into the database once (`developer: true` as permission to create trees), and the database alone decides from then on.
The chart puts it into the ConfigMap `ftree-bff-access`, mounts it as `/config/access.yaml`, sets `APP_ACCESS_FILE`, and restarts the BFF when it changes (checksum annotation).
Without `bff.access`, `bff.roles.admins` lists the bootstrap admins' emails, and everyone else Access lets in sees only the trees the database gives them; the chart refuses to render with both set.

`bff.cloudflare.existingSecret` names a Secret whose `api-token` key holds the BFF's Cloudflare API token (Access: Organizations, Identity Providers, and Groups Edit); with `bff.cloudflare.accountId` and `bff.cloudflare.accessGroupId` the BFF then keeps the Access group equal to everyone with access, and `bff.cloudflare.dryRun: true` only logs the counts it would change.
Without the Secret the BFF runs with a noop gateway and changes nothing at Cloudflare.
The BFF container also exposes the port `management` (8081, not part of the Service) with `/actuator/prometheus`, which a PodMonitor can scrape.
The chart passes the other values to the BFF as `APP_AUTH_MODE`, `APP_AUTH_TEAM_DOMAIN`, `APP_AUTH_AUDIENCE`, and `APP_ROLES_ADMINS` (joined with `,`), leaving unset values out.
`operator.name` and `operator.email` (default empty) name who runs the instance; the chart sets them on the UI container as `OPERATOR_NAME` and `OPERATOR_EMAIL`, which the UI reads per request for `/terms`, `/privacy`, and the menu's "Feedback" link, so changing them only needs a rollout, not a new image.
Running ftree in a cluster (Flux manifests, the kubectl, kind, Helm, and Flux cheatsheet, and the plan for a local kind cluster) lives in the private [`schillpeet/ftree-infra`](https://github.com/schillpeet/ftree-infra) repository.

## Develop the chart

Check the chart without a cluster:

| Command | What it does |
| --- | --- |
| `helm lint deploy/ftree` | Checks chart structure and that templates render to valid YAML; does not check Kubernetes fields |
| `helm template ftree deploy/ftree` | Renders the manifests that would be installed, without installing |
| `helm template ftree deploy/ftree -s templates/ui.yaml` | Renders a single template |
| `helm template ftree deploy/ftree \| kubectl apply --dry-run=server -f -` | Lets a cluster validate the manifests without applying them; catches missing required fields |
| `helm package deploy/ftree --version 0.0.1 --app-version 0.0.1 --destination /tmp` | Packs the chart into a `.tgz`, as the release workflow does |

To try unreleased changes in kind, build the images, load them into the cluster (it cannot see local images), and install the chart from this checkout.
The database and the `ftree-db` Secret must exist first (see the cheatsheet in `ftree-infra`).

```bash
podman build -t localhost/ftree-ui:dev -f ui/Dockerfile ui
podman build -t localhost/ftree-bff:dev -f bff/Dockerfile .
podman save localhost/ftree-ui:dev localhost/ftree-bff:dev -o /tmp/ftree-images.tar
kind load image-archive /tmp/ftree-images.tar --name ftree
helm install ftree deploy/ftree --set ui.image.repository=localhost/ftree-ui --set ui.image.tag=dev --set ui.image.pullPolicy=Never --set bff.image.repository=localhost/ftree-bff --set bff.image.tag=dev --set bff.image.pullPolicy=Never --set bff.corsAllowedOrigins=http://localhost:8088 --set bff.auth.mode=dev --set bff.roles.admins={dev@localhost}
```

With Docker instead of Podman, use `docker build` and `docker save` with the same arguments.
If Flux manages the `ftree` release in that cluster, run `flux suspend helmrelease ftree` first and `helm upgrade` instead of `helm install`.

## Work in progress

The chart is being built step by step (see the plan below).
Each published release pushes it to `oci://ghcr.io/schillpeet/charts/ftree` with the release version as chart and app version.

### Helm chart (phase 1b)

- [x] Scaffold: `Chart.yaml` (version placeholders set by the release workflow), `values.yaml`, `templates/_helpers.tpl` (labels take `(dict "ctx" . "component" "ui|bff")`)
- [x] `templates/bff.yaml`: Deployment and ClusterIP Service `ftree-bff` on port 8080, DB password from `secretKeyRef`, TCP probes, non-root
- [x] `templates/ui.yaml`: copy `bff.yaml`, then `component: ui`, port 3000, no `env`, `httpGet /` probes, about `256Mi` memory in `values.yaml`
- [x] Check with `helm lint deploy/ftree` and `helm template ftree deploy/ftree`
- [x] Try it in kind: create the cluster, load the images, add a throwaway PostgreSQL and the `ftree-db` Secret, `helm install`, `kubectl port-forward svc/ftree-ui 8088:3000`

### Publish the chart (phase 1c)

- [x] `release-images.yml` runs `helm package --version <release> --app-version <release>` and `helm push` to `oci://ghcr.io/schillpeet/charts` after the images are built
- [x] Spring Actuator probes on the BFF's management port instead of the TCP probes

### Next phases

1. Flux in a local kind cluster: started in `schillpeet/ftree-infra` (Flux bootstrap, HelmRepository, and HelmRelease `ftree` with a semver range); its README has the step-by-step plan.
2. Terraform in `ftree-infra`: state in Hetzner Object Storage, a CAX21 server with k3s via cloud-init, a firewall, and a Cloudflare Tunnel, DNS record, and Access application; then a workflow that plans on pull requests and applies after review.
3. Production: point Flux at the Hetzner cluster, run PostgreSQL with CloudNativePG, encrypt Secrets with SOPS and age, run `cloudflared` in the cluster, and set up backups with a tested restore.

All three run in production; Cloudflare Access signs people in, and the BFF decides what each of them may see and change.
