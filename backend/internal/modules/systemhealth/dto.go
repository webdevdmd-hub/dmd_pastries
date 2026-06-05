package systemhealth

type ApiRouteResponse struct {
	ApiName   string `json:"api_name"`
	Handler   string `json:"handler"`
	Method    string `json:"method"`
	Module    string `json:"module"`
	Path      string `json:"path"`
	ProbeMode string `json:"probe_mode"`
}
