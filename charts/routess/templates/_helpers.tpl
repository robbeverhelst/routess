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
