package operations

import (
	"context"
	"errors"
	"math"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"
)

// The private path belongs to this monitor's mount namespace, not the remote
// health endpoint. This is filesystem headroom, not collection/directory size.
type StorageConfig struct {
	Path                         string
	Timeout                      time.Duration
	MinFreeBytes, MinFreePercent uint64
}

type StorageMetrics struct {
	TotalBytes     uint64 `json:"totalBytes"`
	AvailableBytes uint64 `json:"availableBytes"`
}

type StorageProbe struct {
	config StorageConfig
	active atomic.Bool
	read   func(string) (*StorageMetrics, error)
}

var errStorageUnavailable = errors.New("storage measurement unavailable")

func NewStorageProbe(config StorageConfig) (*StorageProbe, error) {
	if config == (StorageConfig{}) {
		return nil, nil // Disabled: no filesystem read, timeout or worker.
	}
	if !filepath.IsAbs(config.Path) || len(config.Path) > 4096 || strings.ContainsAny(config.Path, "\x00\r\n") ||
		config.Timeout <= 0 || config.Timeout > 10*time.Second || config.MinFreePercent > 100 {
		return nil, errors.New("invalid local storage probe configuration")
	}
	return &StorageProbe{config: config, read: readLocalStorage}, nil
}

func (p *StorageProbe) check(ctx context.Context) (*StorageMetrics, string) {
	if ctx.Err() != nil {
		return nil, "cancelled"
	}
	// statfs cannot be cancelled inside the kernel. A timed-out read retains
	// this one slot until it returns; later polls never spawn another worker.
	if !p.active.CompareAndSwap(false, true) {
		return nil, "storage_unavailable"
	}
	type result struct {
		metrics *StorageMetrics
		err     error
	}
	response := make(chan result, 1)
	go func() {
		defer p.active.Store(false)
		metrics, err := p.read(p.config.Path)
		response <- result{metrics, err} // One slot, safe even after caller cancellation.
	}()
	bounded, cancel := context.WithTimeout(ctx, p.config.Timeout)
	defer cancel()
	select {
	case <-bounded.Done():
		if ctx.Err() != nil {
			return nil, "cancelled"
		}
		return nil, "storage_timeout"
	case received := <-response:
		if ctx.Err() != nil {
			return nil, "cancelled"
		}
		if bounded.Err() != nil {
			return nil, "storage_timeout"
		}
		m := received.metrics
		if received.err != nil || m == nil || m.TotalBytes == 0 || m.AvailableBytes > m.TotalBytes {
			return nil, "storage_unavailable" // Never echo paths or kernel error text.
		}
		if m.AvailableBytes < p.config.MinFreeBytes || m.AvailableBytes < minimumStorageBytes(m.TotalBytes, p.config.MinFreePercent) {
			return m, "storage_budget"
		}
		return m, ""
	}
}

// Ceiling(total*percent/100), without overflowing even near uint64 maximum.
func minimumStorageBytes(total, percent uint64) uint64 {
	return total/100*percent + (total%100*percent+99)/100
}

func storageBytes(unit int64, blocks, available uint64) (*StorageMetrics, error) {
	if unit <= 0 || blocks == 0 || blocks == math.MaxUint64 || available == math.MaxUint64 || available > blocks || blocks > math.MaxUint64/uint64(unit) {
		return nil, errStorageUnavailable
	}
	return &StorageMetrics{TotalBytes: blocks * uint64(unit), AvailableBytes: available * uint64(unit)}, nil
}
