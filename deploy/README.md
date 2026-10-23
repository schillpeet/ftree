# Deployment

`deploy/ftree/` is the Helm chart that installs the ftree UI and BFF into Kubernetes.
PostgreSQL is not part of the chart; the BFF reads `db.url`, `db.user`, and the `password` key of the Secret named in `db.existingSecret`.
Always install the release as `ftree`: the UI image proxies `/api` to `http://ftree-bff:8080`, so the BFF Service must be named `ftree-bff`.
Set `bff.corsAllowedOrigins` to the origin the browser opens the UI on (for example `http://localhost:8088` behind a port-forward); the proxy forwards the browser's `Origin`, so the BFF otherwise rejects every write with `403 Invalid CORS request`.
[CHEATSHEET.md](CHEATSHEET.md) lists the Helm, kubectl, and kind commands for testing the chart locally.

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
- [ ] Optional: Spring Actuator for a real BFF health check instead of the TCP probes

### Next phases

1. Flux in a local kind cluster: bootstrap the private `schillpeet/ftree-infra` repository, add a HelmRepository and HelmRelease (`metadata.name: ftree`, semver range), and let Flux roll out new releases.
2. Terraform in `ftree-infra`: state in Hetzner Object Storage, a CAX21 server with k3s via cloud-init, a firewall, and a Cloudflare Tunnel, DNS record, and Access application; then a workflow that plans on pull requests and applies after review.
3. Production: point Flux at the Hetzner cluster, run PostgreSQL with CloudNativePG, encrypt Secrets with SOPS and age, run `cloudflared` in the cluster, and set up backups with a tested restore.

Cloudflare Access keeps the site private until ftree itself has authentication and authorization.
