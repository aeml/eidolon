package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"eidolon-server/internal/database"
)

func main() {
	defaultURI := os.Getenv("MONGO_URI")
	if defaultURI == "" {
		defaultURI = "mongodb://localhost:27017"
	}
	uri := flag.String("mongo-uri", defaultURI, "MongoDB connection URI")
	timeout := flag.Duration("timeout", 30*time.Second, "migration timeout")
	flag.Parse()

	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()

	db, err := database.New(*uri)
	if err != nil {
		log.Fatalf("database migration failed: %v", err)
	}
	defer func() { _ = db.Close(context.Background()) }()

	version, err := db.SchemaVersion(ctx)
	if err != nil {
		log.Fatalf("read schema version: %v", err)
	}
	if version != database.CurrentSchemaVersion {
		log.Fatalf("schema stopped at version %d; expected %d", version, database.CurrentSchemaVersion)
	}
	fmt.Printf("Eidolon schema is current at version %d\n", version)
}
