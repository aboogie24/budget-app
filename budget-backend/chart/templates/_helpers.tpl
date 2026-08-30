{{- define "budget-api.name" -}}
{{- .Chart.Name -}}
{{- end }}

{{- define "budget-api.fullname" -}}
{{- if contains .Chart.Name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end }}

{{- define "budget-api.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{ include "budget-api.selectorLabels" . }}
{{- end }}

{{- define "budget-api.selectorLabels" -}}
app.kubernetes.io/name: {{ include "budget-api.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/* Database connection pieces, bundled vs external */}}
{{- define "budget-api.dbHost" -}}
{{- if .Values.postgresql.enabled -}}
{{- printf "%s-postgresql" .Release.Name -}}
{{- else -}}
{{- required "externalDatabase.host is required when postgresql.enabled=false" .Values.externalDatabase.host -}}
{{- end -}}
{{- end }}

{{- define "budget-api.dbPort" -}}
{{- if .Values.postgresql.enabled -}}5432{{- else -}}{{ .Values.externalDatabase.port }}{{- end -}}
{{- end }}

{{- define "budget-api.dbUser" -}}
{{- if .Values.postgresql.enabled -}}{{ .Values.postgresql.auth.username }}{{- else -}}{{ .Values.externalDatabase.user }}{{- end -}}
{{- end }}

{{- define "budget-api.dbName" -}}
{{- if .Values.postgresql.enabled -}}{{ .Values.postgresql.auth.database }}{{- else -}}{{ .Values.externalDatabase.database }}{{- end -}}
{{- end }}

{{/* Env entries shared by the API container and the migration init container */}}
{{- define "budget-api.dbEnv" -}}
- name: PG_HOST
  value: {{ include "budget-api.dbHost" . | quote }}
- name: PG_PORT
  value: {{ include "budget-api.dbPort" . | quote }}
- name: PG_USER
  value: {{ include "budget-api.dbUser" . | quote }}
- name: PG_DB
  value: {{ include "budget-api.dbName" . | quote }}
{{- if .Values.postgresql.enabled }}
- name: PG_PASS
  valueFrom:
    secretKeyRef:
      name: {{ printf "%s-postgresql" .Release.Name }}
      key: password
{{- end }}
{{- end }}
