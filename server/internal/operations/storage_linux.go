//go:build linux

package operations

import "syscall"

func readLocalStorage(path string) (*StorageMetrics, error) {
	var stat syscall.Statfs_t
	if syscall.Statfs(path, &stat) != nil {
		return nil, errStorageUnavailable
	}
	// Linux fragment units, with the conventional block-size fallback. Available
	// blocks exclude the root reserve: monitor the unprivileged game's headroom.
	unit := int64(stat.Frsize)
	if unit == 0 {
		unit = int64(stat.Bsize)
	}
	return storageBytes(unit, uint64(stat.Blocks), uint64(stat.Bavail))
}
