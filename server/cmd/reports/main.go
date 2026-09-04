package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"

	"eidolon-server/internal/database"
)

func main() {
	defaultURI := os.Getenv("MONGO_URI")
	if defaultURI == "" {
		defaultURI = "mongodb://localhost:27017"
	}
	uri := flag.String("mongo-uri", defaultURI, "MongoDB connection URI")
	action := flag.String("action", "list", "triage action: list or resolve")
	status := flag.String("status", database.ReportStatusOpen, "status filter for list (empty lists all)")
	limit := flag.Int64("limit", 100, "maximum reports to list")
	id := flag.String("id", "", "report id for resolve")
	flag.Parse()

	db, err := database.New(*uri)
	if err != nil {
		log.Fatal(err)
	}
	defer func() { _ = db.Close(context.Background()) }()

	switch *action {
	case "list":
		reports, err := db.ListReports(*status, *limit)
		if err != nil {
			log.Fatal(err)
		}
		encoder := json.NewEncoder(os.Stdout)
		for _, report := range reports {
			if err := encoder.Encode(report); err != nil {
				log.Fatal(err)
			}
		}
	case "resolve":
		if *id == "" {
			log.Fatal("-id is required for resolve")
		}
		if err := db.ResolveReport(*id); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("resolved report %s\n", *id)
	default:
		log.Fatalf("unsupported action %q", *action)
	}
}
