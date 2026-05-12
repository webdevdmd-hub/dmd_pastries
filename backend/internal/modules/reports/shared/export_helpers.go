package shared

import (
	"bytes"
	"encoding/csv"
)

type CSVFile struct {
	Filename string
	Content  []byte
}

func BuildCSV(filename string, headers []string, rows [][]string) (*CSVFile, error) {
	var buffer bytes.Buffer
	writer := csv.NewWriter(&buffer)
	if len(headers) > 0 {
		if err := writer.Write(headers); err != nil {
			return nil, err
		}
	}
	for _, row := range rows {
		if err := writer.Write(row); err != nil {
			return nil, err
		}
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}
	return &CSVFile{Filename: filename, Content: buffer.Bytes()}, nil
}
