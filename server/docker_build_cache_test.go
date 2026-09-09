package main

import (
	"os"
	"strings"
	"testing"
)

func TestDockerReleaseMetadataDoesNotInvalidateDependencyCache(t *testing.T) {
	data, err := os.ReadFile("Dockerfile")
	if err != nil {
		t.Fatal(err)
	}
	source := string(data)
	dependencies := strings.Index(source, "RUN go mod download")
	compile := strings.Index(source, "RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build")
	if dependencies < 0 || compile <= dependencies {
		t.Fatal("expected separate dependency and compilation stages")
	}
	for _, name := range []string{"BUILD_COMMIT", "BUILD_VERSION"} {
		declaration := strings.Index(source, "ARG "+name+"=")
		if declaration <= dependencies || declaration >= compile {
			t.Errorf("%s must enter the build after dependency installation, before linking", name)
		}
		if !strings.Contains(source[compile:], "${"+name+"}") {
			t.Errorf("compiled server must still receive %s", name)
		}
	}
}
