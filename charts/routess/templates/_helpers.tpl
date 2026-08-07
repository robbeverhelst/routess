{{/*
Expand the name of the chart.
*/}}
{{- define "routess.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "routess.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "routess.labels" -}}
helm.sh/chart: {{ include "routess.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: routess
{{- end }}

{{/*
Chart label
*/}}
{{- define "routess.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Web labels
*/}}
{{- define "routess.web.labels" -}}
{{ include "routess.labels" . }}
{{ include "routess.web.selectorLabels" . }}
{{- end }}

{{/*
Web selector labels
*/}}
{{- define "routess.web.selectorLabels" -}}
app.kubernetes.io/name: {{ include "routess.name" . }}-web
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: web
{{- end }}

{{/*
API labels
*/}}
{{- define "routess.api.labels" -}}
{{ include "routess.labels" . }}
{{ include "routess.api.selectorLabels" . }}
{{- end }}

{{/*
API selector labels
*/}}
{{- define "routess.api.selectorLabels" -}}
app.kubernetes.io/name: {{ include "routess.name" . }}-api
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: api
{{- end }}

{{/*
Web service account name
*/}}
{{- define "routess.web.serviceAccountName" -}}
{{- if .Values.serviceAccount.web.create }}
{{- default (printf "%s-web" (include "routess.fullname" .)) .Values.serviceAccount.web.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.web.name }}
{{- end }}
{{- end }}

{{/*
API service account name
*/}}
{{- define "routess.api.serviceAccountName" -}}
{{- if .Values.serviceAccount.api.create }}
{{- default (printf "%s-api" (include "routess.fullname" .)) .Values.serviceAccount.api.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.api.name }}
{{- end }}
{{- end }}

{{/*
Docs labels
*/}}
{{- define "routess.docs.labels" -}}
{{ include "routess.labels" . }}
{{ include "routess.docs.selectorLabels" . }}
{{- end }}

{{/*
Docs selector labels
*/}}
{{- define "routess.docs.selectorLabels" -}}
app.kubernetes.io/name: {{ include "routess.name" . }}-docs
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: docs
{{- end }}

{{/*
Docs service account name
*/}}
{{- define "routess.docs.serviceAccountName" -}}
{{- if .Values.serviceAccount.docs.create }}
{{- default (printf "%s-docs" (include "routess.fullname" .)) .Values.serviceAccount.docs.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.docs.name }}
{{- end }}
{{- end }}

{{/*
Redis labels
*/}}
{{- define "routess.redis.labels" -}}
{{ include "routess.labels" . }}
{{ include "routess.redis.selectorLabels" . }}
{{- end }}

{{/*
Redis selector labels
*/}}
{{- define "routess.redis.selectorLabels" -}}
app.kubernetes.io/name: {{ include "routess.name" . }}-redis
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: redis
{{- end }}

{{/*
Frontend URLs from web ingress hosts (these are the origins allowed by the API CORS policy)
*/}}
{{- define "routess.frontendUrls" -}}
{{- range $index, $host := .Values.ingress.web.hosts -}}
{{- if $index }},{{ end -}}
{{- printf "https://%s" $host -}}
{{- end -}}
{{- end }}

{{/*
Landing labels
*/}}
{{- define "routess.landing.labels" -}}
{{ include "routess.labels" . }}
{{ include "routess.landing.selectorLabels" . }}
{{- end }}

{{/*
Landing selector labels
*/}}
{{- define "routess.landing.selectorLabels" -}}
app.kubernetes.io/name: {{ include "routess.name" . }}-landing
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: landing
{{- end }}

{{/*
Landing service account name
*/}}
{{- define "routess.landing.serviceAccountName" -}}
{{- if .Values.serviceAccount.landing.create }}
{{- default (printf "%s-landing" (include "routess.fullname" .)) .Values.serviceAccount.landing.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.landing.name }}
{{- end }}
{{- end }}

{{/*
Node-tiles labels (monthly OSM -> PMTiles build job, ADR 0033)
*/}}
{{- define "routess.nodeTiles.labels" -}}
{{ include "routess.labels" . }}
app.kubernetes.io/name: {{ include "routess.name" . }}-node-tiles
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: node-tiles
{{- end }}

{{/*
Name of the secret holding the node-tiles S3 credentials (existing or generated)
*/}}
{{- define "routess.nodeTiles.secretName" -}}
{{- if .Values.nodeTiles.s3.existingSecret -}}
{{- .Values.nodeTiles.s3.existingSecret -}}
{{- else -}}
{{- printf "%s-node-tiles" (include "routess.fullname" .) -}}
{{- end -}}
{{- end }}

{{/*
Shared Umami analytics env. Plain UMAMI_* names (landing + docs read them at
runtime, server-side). Emits nothing when unset.
*/}}
{{- define "routess.umamiEnv" -}}
{{- if .Values.global.umami.url }}
- name: UMAMI_URL
  value: {{ .Values.global.umami.url | quote }}
{{- end }}
{{- if .Values.global.umami.websiteId }}
- name: UMAMI_WEBSITE_ID
  value: {{ .Values.global.umami.websiteId | quote }}
{{- end }}
{{- end }}

{{/*
Shared Umami analytics env, VITE_ names for the web app (substituted into
env-config.js by its entrypoint at container start).
*/}}
{{- define "routess.umamiEnvVite" -}}
{{- if .Values.global.umami.url }}
- name: VITE_UMAMI_URL
  value: {{ .Values.global.umami.url | quote }}
{{- end }}
{{- if .Values.global.umami.websiteId }}
- name: VITE_UMAMI_WEBSITE_ID
  value: {{ .Values.global.umami.websiteId | quote }}
{{- end }}
{{- end }}

{{/*
Full API container env. Shared by the api Deployment and the seed-refresh
CronJob so they never drift: the refresh script boots the same AppModule and
validates the same production config, so it needs every value the api needs.
*/}}
{{- define "routess.api.env" -}}
- name: NODE_ENV
  value: {{ .Values.api.env.nodeEnv | quote }}
# Stamped into logs and the Prometheus target_info series so
# Grafana can segment by release. Falls back to the image tag.
- name: APP_VERSION
  value: {{ .Values.api.env.appVersion | default .Values.api.image.tag | quote }}
- name: PORT
  value: {{ .Values.api.env.port | quote }}
- name: FRONTEND_URLS
  value: {{ include "routess.frontendUrls" . | quote }}
- name: PUBLIC_SITE_URL
  value: {{ .Values.api.env.publicSiteUrl | quote }}
- name: SWAGGER_ENABLED
  value: {{ .Values.api.env.swaggerEnabled | quote }}
- name: SWAGGER_PATH
  value: {{ .Values.api.env.swaggerPath | quote }}
{{- with .Values.api.adminEmails }}
- name: ADMIN_EMAILS
  value: {{ join "," . | quote }}
{{- end }}
{{- $grafana := dict }}
{{- range $k, $v := .Values.monitoring.grafanaUrls }}
{{- if $v }}
{{- $_ := set $grafana $k $v }}
{{- end }}
{{- end }}
{{- if $grafana }}
- name: GRAFANA_URLS
  value: {{ $grafana | toJson | quote }}
{{- end }}
- name: JWT_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ include "routess.fullname" . }}-api
      key: jwt-secret
- name: GOOGLE_CLIENT_ID
  valueFrom:
    secretKeyRef:
      name: {{ include "routess.fullname" . }}-api
      key: google-client-id
- name: GOOGLE_CLIENT_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ include "routess.fullname" . }}-api
      key: google-client-secret
- name: DB_HOST
  valueFrom:
    secretKeyRef:
      name: {{ include "routess.fullname" . }}-api
      key: db-host
- name: DB_PORT
  valueFrom:
    secretKeyRef:
      name: {{ include "routess.fullname" . }}-api
      key: db-port
- name: DB_USER
  valueFrom:
    secretKeyRef:
      name: {{ include "routess.fullname" . }}-api
      key: db-user
- name: DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "routess.fullname" . }}-api
      key: db-password
- name: DB_NAME
  valueFrom:
    secretKeyRef:
      name: {{ include "routess.fullname" . }}-api
      key: db-name
- name: ANALYTICS_SALT
  valueFrom:
    secretKeyRef:
      name: {{ include "routess.fullname" . }}-api
      key: analytics-salt
- name: PAT_PEPPER
  valueFrom:
    secretKeyRef:
      name: {{ include "routess.fullname" . }}-api
      key: pat-pepper
{{- if .Values.api.secrets.umamiDatabaseUrl }}
- name: UMAMI_DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: {{ include "routess.fullname" . }}-api
      key: umami-database-url
{{- end }}
{{- with .Values.global.umami.websiteId }}
- name: UMAMI_WEBSITE_ID
  value: {{ . | quote }}
{{- end }}
- name: EMAIL_FROM
  value: {{ .Values.api.env.emailFrom | quote }}
{{- with .Values.api.env.valhallaUrl }}
- name: VALHALLA_URL
  value: {{ . | quote }}
{{- end }}
{{- with .Values.api.env.nodeTilesUrl }}
- name: NODE_TILES_URL
  value: {{ . | quote }}
{{- end }}
{{- with .Values.api.env.mapboxPublicToken }}
- name: MAPBOX_PUBLIC_TOKEN
  value: {{ . | quote }}
{{- end }}
{{- with .Values.api.env.geocodingReferer }}
- name: GEOCODING_REFERER
  value: {{ . | quote }}
{{- end }}
{{- if .Values.redis.enabled }}
- name: REDIS_URL
  value: "redis://{{ include "routess.fullname" . }}-redis:{{ .Values.redis.service.port }}"
{{- end }}
{{- with .Values.api.env.generationQuotaPerDay }}
- name: GENERATION_QUOTA_PER_DAY
  value: {{ . | quote }}
{{- end }}
- name: RESEND_API_KEY
  valueFrom:
    secretKeyRef:
      name: {{ include "routess.fullname" . }}-api
      key: resend-api-key
{{- end }}
