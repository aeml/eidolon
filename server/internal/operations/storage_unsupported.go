//go:build !linux

package operations

func readLocalStorage(string) (*StorageMetrics, error) {
	return nil, errStorageUnavailable // Unsupported is never a healthy zero.
}
