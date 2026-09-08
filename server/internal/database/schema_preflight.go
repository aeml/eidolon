package database

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// CheckSchemaCompatibility is a read-only deployment preflight. Do not use New:
// it applies migrations, which must wait until the preceding writer has stopped.
// Startup repeats this check; preflight is not an admission or migration lock.
func CheckSchemaCompatibility(ctx context.Context, uri string) (int, error) {
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return 0, fmt.Errorf("connect for schema check: %w", err)
	}
	defer func() {
		closeCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = client.Disconnect(closeCtx)
	}()
	if err := client.Ping(ctx, nil); err != nil {
		return 0, fmt.Errorf("ping for schema check: %w", err)
	}
	db := &DB{migrations: client.Database("eidolon").Collection("schema_migrations")}
	version, err := db.SchemaVersion(ctx)
	if err != nil {
		return 0, fmt.Errorf("read schema compatibility: %w", err)
	}
	return version, validateSupportedSchema(version)
}
