variable "DEPS_IMAGE" { default = "" }
variable "VERSION"    { default = "" }
variable "MINOR"      { default = "" }
variable "MAJOR"      { default = "" }
variable "SHA"        { default = "" }
variable "OWNER"      { default = "" }
variable "REGISTRY"   { default = "ghcr.io" }

group "default" {
  targets = ["web", "api", "docs", "landing"]
}

target "common" {
  context = ".."
  args = {
    DEPS_IMAGE = "${DEPS_IMAGE}"
  }
  platforms  = ["linux/amd64"]
  provenance = "mode=max"
  sbom       = true
}

variable "SENTRY_ORG"        { default = "" }
variable "SENTRY_PROJECT"    { default = "routess" }
variable "SENTRY_URL"        { default = "" }
# Default keeps the runtime placeholder behaviour when CI does not pass
# a real version (local builds, PR builds), so entrypoint.sh can still
# substitute at container start.
variable "VITE_APP_VERSION"  { default = "__VITE_APP_VERSION__" }

target "web" {
  inherits   = ["common"]
  dockerfile = "apps/web/Dockerfile"
  args = {
    DEPS_IMAGE        = "${DEPS_IMAGE}"
    SENTRY_ORG        = "${SENTRY_ORG}"
    SENTRY_PROJECT    = "${SENTRY_PROJECT}"
    SENTRY_URL        = "${SENTRY_URL}"
    VITE_APP_VERSION  = "${VITE_APP_VERSION}"
  }
  # SENTRY_AUTH_TOKEN is consumed via BuildKit secret mount inside the
  # Dockerfile (RUN --mount=type=secret,id=sentry_auth_token). Set the env
  # var SENTRY_AUTH_TOKEN in the calling environment (CI) and buildx will
  # forward it. The token never enters image layers.
  secret = ["id=sentry_auth_token,env=SENTRY_AUTH_TOKEN"]
  tags = [
    "${REGISTRY}/${OWNER}/routess-web:${VERSION}",
    "${REGISTRY}/${OWNER}/routess-web:${MINOR}",
    "${REGISTRY}/${OWNER}/routess-web:${MAJOR}",
    "${REGISTRY}/${OWNER}/routess-web:sha-${SHA}",
  ]
  cache-from = ["type=registry,ref=${REGISTRY}/${OWNER}/routess-web:buildcache"]
  cache-to   = ["type=registry,ref=${REGISTRY}/${OWNER}/routess-web:buildcache,mode=max"]
}

target "api" {
  inherits   = ["common"]
  dockerfile = "apps/api/Dockerfile"
  tags = [
    "${REGISTRY}/${OWNER}/routess-api:${VERSION}",
    "${REGISTRY}/${OWNER}/routess-api:${MINOR}",
    "${REGISTRY}/${OWNER}/routess-api:${MAJOR}",
    "${REGISTRY}/${OWNER}/routess-api:sha-${SHA}",
  ]
  cache-from = ["type=registry,ref=${REGISTRY}/${OWNER}/routess-api:buildcache"]
  cache-to   = ["type=registry,ref=${REGISTRY}/${OWNER}/routess-api:buildcache,mode=max"]
}

target "docs" {
  inherits   = ["common"]
  dockerfile = "apps/docs/Dockerfile"
  tags = [
    "${REGISTRY}/${OWNER}/routess-docs:${VERSION}",
    "${REGISTRY}/${OWNER}/routess-docs:${MINOR}",
    "${REGISTRY}/${OWNER}/routess-docs:${MAJOR}",
    "${REGISTRY}/${OWNER}/routess-docs:sha-${SHA}",
  ]
  cache-from = ["type=registry,ref=${REGISTRY}/${OWNER}/routess-docs:buildcache"]
  cache-to   = ["type=registry,ref=${REGISTRY}/${OWNER}/routess-docs:buildcache,mode=max"]
}

target "landing" {
  inherits   = ["common"]
  dockerfile = "apps/landing/Dockerfile"
  tags = [
    "${REGISTRY}/${OWNER}/routess-landing:${VERSION}",
    "${REGISTRY}/${OWNER}/routess-landing:${MINOR}",
    "${REGISTRY}/${OWNER}/routess-landing:${MAJOR}",
    "${REGISTRY}/${OWNER}/routess-landing:sha-${SHA}",
  ]
  cache-from = ["type=registry,ref=${REGISTRY}/${OWNER}/routess-landing:buildcache"]
  cache-to   = ["type=registry,ref=${REGISTRY}/${OWNER}/routess-landing:buildcache,mode=max"]
}

# OSM -> PMTiles toolchain for the monthly node-network tile job (ADR 0033).
# Deliberately NOT in the default group: it is a heavy, rarely-changing build
# image (compiles tippecanoe from source), and coupling it to the per-release
# image bake means one broken target blocks every app image. It is published
# on its own by .github/workflows/node-tiles-image.yml (manual or on changes to
# its files), tagged latest + sha rather than tracking the app version.
target "node-tiles" {
  inherits   = ["common"]
  dockerfile = "docker/Dockerfile.node-tiles"
  tags = [
    "${REGISTRY}/${OWNER}/routess-node-tiles:latest",
    "${REGISTRY}/${OWNER}/routess-node-tiles:sha-${SHA}",
  ]
  cache-from = ["type=registry,ref=${REGISTRY}/${OWNER}/routess-node-tiles:buildcache"]
  cache-to   = ["type=registry,ref=${REGISTRY}/${OWNER}/routess-node-tiles:buildcache,mode=max"]
}
