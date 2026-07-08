package systemhealth

type ApiRouteResponse struct {
	ApiName                    string   `json:"api_name"`
	ExpectedValidationMessages []string `json:"expected_validation_messages,omitempty"`
	Handler                    string   `json:"handler"`
	Method                     string   `json:"method"`
	Module                     string   `json:"module"`
	Path                       string   `json:"path"`
	ProbeCategory              string   `json:"probe_category"`
	ProbeMode                  string   `json:"probe_mode"`
	ProbePath                  string   `json:"probe_path,omitempty"`
}
