{{/*
Expand the name of the chart.
*/}}
{{- define "plotarr.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "plotarr.fullname" -}}
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
{{- define "plotarr.labels" -}}
helm.sh/chart: {{ include "plotarr.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: plotarr
{{- end }}

{{/*
Chart label
*/}}
{{- define "plotarr.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Web labels
*/}}
{{- define "plotarr.web.labels" -}}
{{ include "plotarr.labels" . }}
{{ include "plotarr.web.selectorLabels" . }}
{{- end }}

{{/*
Web selector labels
*/}}
{{- define "plotarr.web.selectorLabels" -}}
app.kubernetes.io/name: {{ include "plotarr.name" . }}-web
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: web
{{- end }}

{{/*
API labels
*/}}
{{- define "plotarr.api.labels" -}}
{{ include "plotarr.labels" . }}
{{ include "plotarr.api.selectorLabels" . }}
{{- end }}

{{/*
API selector labels
*/}}
{{- define "plotarr.api.selectorLabels" -}}
app.kubernetes.io/name: {{ include "plotarr.name" . }}-api
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: api
{{- end }}

{{/*
Web service account name
*/}}
{{- define "plotarr.web.serviceAccountName" -}}
{{- if .Values.serviceAccount.web.create }}
{{- default (printf "%s-web" (include "plotarr.fullname" .)) .Values.serviceAccount.web.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.web.name }}
{{- end }}
{{- end }}

{{/*
API service account name
*/}}
{{- define "plotarr.api.serviceAccountName" -}}
{{- if .Values.serviceAccount.api.create }}
{{- default (printf "%s-api" (include "plotarr.fullname" .)) .Values.serviceAccount.api.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.api.name }}
{{- end }}
{{- end }}

{{/*
Frontend URL from first web ingress host
*/}}
{{- define "plotarr.frontendUrl" -}}
{{- $host := first .Values.ingress.web.hosts }}
{{- printf "https://%s" $host }}
{{- end }}
