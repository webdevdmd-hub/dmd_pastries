package shared

type ChartDataset struct {
	Label string    `json:"label"`
	Data  []float64 `json:"data"`
}

type ChartResponse struct {
	Labels   []string       `json:"labels"`
	Datasets []ChartDataset `json:"datasets"`
}

func SingleDatasetChart(label string, points []ChartPoint) ChartResponse {
	labels := make([]string, 0, len(points))
	data := make([]float64, 0, len(points))
	for _, point := range points {
		labels = append(labels, point.Label)
		data = append(data, point.Value)
	}
	return ChartResponse{
		Labels: labels,
		Datasets: []ChartDataset{
			{Label: label, Data: data},
		},
	}
}

type ChartPoint struct {
	Label string
	Value float64
}
