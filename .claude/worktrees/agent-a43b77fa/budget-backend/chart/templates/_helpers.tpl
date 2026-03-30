{{- define "budget-app-backend.name" -}}
budget-app-backend
{{- end }}

{{- define "budget-app-backend.fullname" -}}
{{ include "budget-app-backend.name" . }}
{{- end }}
