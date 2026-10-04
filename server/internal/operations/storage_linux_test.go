//go:build linux

package operations

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

func TestStorageLinuxActualFilesystemAndMissingPath(t *testing.T) {
	path := t.TempDir()
	probe, err := NewStorageProbe(StorageConfig{Path: path, Timeout: time.Second})
	if err != nil {
		t.Fatal(err)
	}
	metrics, cause := probe.check(context.Background())
	if cause != "" || metrics == nil || metrics.TotalBytes == 0 || metrics.AvailableBytes > metrics.TotalBytes {
		t.Fatal("actual filesystem measurement failed", cause)
	}
	probe, err = NewStorageProbe(StorageConfig{Path: filepath.Join(path, "absent"), Timeout: time.Second})
	if err != nil {
		t.Fatal(err)
	}
	if metrics, cause := probe.check(context.Background()); metrics != nil || cause != "storage_unavailable" {
		t.Fatal("absent path became healthy storage")
	}
}
