package main

import (
	"errors"
	"log"
)

func saveReport(username string, payload ReportPayload) error {
	if db == nil {
		log.Printf("Failed to save report from %s: database unavailable", username)
		return errors.New("database unavailable")
	}
	report, err := db.CreateReport(username, payload.ReportType, payload.Text)
	if err != nil {
		log.Printf("Failed to save report from %s: %v", username, err)
		return err
	}
	log.Printf("Queued report %s from %s: %s", report.ID.Hex(), username, payload.ReportType)
	return nil
}
