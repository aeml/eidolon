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

// Registration reservation is deliberately broader than role authorization:
// case variants also collide with new accounts' public-name index. This never
// grants a role; bootstrap authorization itself remains exact/case-sensitive.
func isReservedBootstrapRegistrationName(username string) bool {
	for reserved := range adminBootstrapUsernames {
		if strings.EqualFold(username, reserved) {
			return true
		}
	}
	return false
}
