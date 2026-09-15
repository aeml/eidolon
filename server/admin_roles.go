package main

import "strings"

type adminRoleStore interface {
	HasAdminRole(username string) (bool, error)
	GrantAdminRole(username, grantedBy, source string) (bool, error)
}

var (
	adminRoles              adminRoleStore
	adminBootstrapUsernames = map[string]struct{}{}
)

func parseAdminBootstrapUsernames(raw string) map[string]struct{} {
	parsed := make(map[string]struct{})
	for _, username := range strings.Split(raw, ",") {
		username = strings.TrimSpace(username)
		if username != "" {
			parsed[username] = struct{}{}
		}
	}
	return parsed
}

func isAdminBootstrapUsername(username string) bool {
	_, ok := adminBootstrapUsernames[username]
	return ok
}
