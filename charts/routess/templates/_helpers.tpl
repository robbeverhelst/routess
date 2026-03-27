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
Frontend URL from first web ingress host
*/}}
{{- define "routess.frontendUrl" -}}
{{- $host := first .Values.ingress.web.hosts }}
{{- printf "https://%s" $host }}
{{- end }}
