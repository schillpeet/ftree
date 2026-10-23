# Helm and kubectl cheatsheet

Commands for working with the ftree chart, most of them used for the kind test in [README.md](README.md).
kind detects Podman on its own here; if it ever looks for Docker, run `export KIND_EXPERIMENTAL_PROVIDER=podman` once per terminal.

## Context first

Your kubeconfig also holds work and production clusters, so check where a command will go before running it.

| Command | What it does |
| --- | --- |
| `kubectl config current-context` | Shows the cluster that `kubectl` and `helm` talk to |
| `kubectl config get-contexts` | Lists all clusters in your kubeconfig |
| `kubectl config use-context kind-ftree` | Switches to the local kind cluster |

## kind

| Command | What it does |
| --- | --- |
| `kind get clusters` | Lists local clusters |
| `kind create cluster --name ftree` | Creates a cluster and switches the context to `kind-ftree` |
| `kind delete cluster --name ftree` | Deletes the cluster and its context |
| `kind load image-archive /tmp/ftree-images.tar --name ftree` | Copies images into the cluster, which cannot see your local Podman images |

Build and export the images before loading them:

```bash
podman build -t localhost/ftree-ui:dev -f ui/Dockerfile ui
podman build -t localhost/ftree-bff:dev -f bff/Dockerfile .
podman save localhost/ftree-ui:dev localhost/ftree-bff:dev -o /tmp/ftree-images.tar
```

## Helm: check the chart without a cluster

| Command | What it does |
| --- | --- |
| `helm lint deploy/ftree` | Checks chart structure and that templates render to valid YAML; does not check Kubernetes fields |
| `helm template ftree deploy/ftree` | Renders the manifests that would be installed, without installing |
| `helm template ftree deploy/ftree -s templates/ui.yaml` | Renders a single template |
| `helm template ftree deploy/ftree \| kubectl apply --dry-run=server -f -` | Lets the cluster validate the manifests without applying them; catches missing required fields |
| `helm package deploy/ftree --version 0.0.1 --app-version 0.0.1 --destination /tmp` | Packs the chart into a `.tgz`, as the release workflow does |

## Helm: releases in the cluster

| Command | What it does |
| --- | --- |
| `helm install ftree deploy/ftree --set key=value` | Installs the chart as release `ftree`; `--set` overrides `values.yaml` |
| `helm upgrade ftree deploy/ftree --reuse-values --set key=value` | Changes a release; `--reuse-values` keeps earlier `--set` values |
| `helm list` | Lists releases in the current namespace |
| `helm get values ftree` | Shows the values you set for the release; check here for typos |
| `helm get manifest ftree` | Shows the manifests that are actually installed |
| `helm history ftree` | Lists the release's revisions |
| `helm rollback ftree 1` | Goes back to revision 1 |
| `helm uninstall ftree` | Removes everything the release installed |

The kind test install, using the locally loaded images:

```bash
helm install ftree deploy/ftree --set ui.image.repository=localhost/ftree-ui --set ui.image.tag=dev --set ui.image.pullPolicy=Never --set bff.image.repository=localhost/ftree-bff --set bff.image.tag=dev --set bff.image.pullPolicy=Never --set bff.corsAllowedOrigins=http://localhost:8088
```

## kubectl: create things by hand

| Command | What it does |
| --- | --- |
| `kubectl create secret generic ftree-db --from-literal=password=app` | Creates the Secret the BFF reads its database password from |
| `kubectl run ftree-db --image=postgres:17 --port=5432 --env=POSTGRES_DB=appdb --env=POSTGRES_USER=app --env=POSTGRES_PASSWORD=app` | Starts a throwaway PostgreSQL pod; anything without `--` becomes the container command |
| `kubectl expose pod ftree-db --port=5432` | Creates a Service `ftree-db` so the BFF finds the database by name |
| `kubectl delete pod ftree-db` | Deletes a pod (also `secret`, `svc`, `deploy`, …) |

## kubectl: look around

| Command | What it does |
| --- | --- |
| `kubectl get pods` | Lists pods with status and restarts; add `-w` to watch, Ctrl+C to stop |
| `kubectl get pods,svc,secret` | Lists several kinds at once |
| `kubectl get deploy ftree-bff -o yaml` | Shows the full object, including the env variables the pod gets |
| `kubectl describe pod -l app.kubernetes.io/component=bff` | Shows details and Events; the first stop for `CreateContainerConfigError`, `ImagePullBackOff`, or failing probes |
| `kubectl logs deploy/ftree-bff` | Shows the app's log; add `--tail=50`, `-f` to follow, or `--previous` after a crash |
| `kubectl get events --sort-by=.lastTimestamp` | Shows what happened in the namespace, newest last |
| `kubectl exec -it ftree-db -- psql -U app appdb` | Runs an interactive command inside a running container, here `psql` |

## kubectl: reach and restart

| Command | What it does |
| --- | --- |
| `kubectl port-forward svc/ftree-ui 8088:3000` | Forwards `localhost:8088` to the UI Service; open http://localhost:8088 |
| `kubectl rollout restart deploy/ftree-bff` | Replaces the pods, for example after recreating a Secret |
| `kubectl rollout status deploy/ftree-bff` | Waits until the new pods are ready |

## Errors we hit

| Symptom | Cause |
| --- | --- |
| `exec: env=POSTGRES_USER=app: not found` | A `--` was missing in `kubectl run`, so the flag became the container command |
| `CreateContainerConfigError` | The pod refers to something missing, here the Secret was named `free-db` instead of `ftree-db` |
| `Readiness probe failed: connection refused` right after start | The app was still starting; harmless if the pod becomes `1/1` |
| `403 Invalid CORS request` on saving | `bff.corsAllowedOrigins` did not match the browser's address (`http://localhost:8088`) |
| `403 denied` on `helm push` | Not logged in to GHCR; publishing is the release workflow's job |
