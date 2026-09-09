package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Every command in cmd/ must be built AND copied into the runtime image.
//
// A command that exists in the repo but not in the image is invisible until
// someone needs it, and the one that needs running at all is the identity
// import -- during a cutover window, on a host with no Go toolchain, against a
// database with no public exposure. Discovering it is missing at that moment
// leaves only bad options: install a toolchain on the server, or expose the
// database. Both decided under time pressure, at night.
//
// Two stages, two chances to forget. A binary built in the builder stage and
// never copied out is silently absent from the final image, and nothing about
// the build fails.
func TestDockerfileShipsEveryCommand(t *testing.T) {
	dockerfile, err := os.ReadFile(filepath.Join("..", "..", "Dockerfile"))
	if err != nil {
		t.Fatalf("read Dockerfile: %v", err)
	}
	content := string(dockerfile)

	commands, err := os.ReadDir(filepath.Join(".."))
	if err != nil {
		t.Fatalf("read cmd dir: %v", err)
	}

	found := 0
	for _, command := range commands {
		if !command.IsDir() {
			continue
		}
		found++
		name := command.Name()

		if !strings.Contains(content, "./cmd/"+name) {
			t.Errorf("cmd/%s is never built by the Dockerfile", name)
		}
		if !strings.Contains(content, "/bin/"+name+" /app/"+name) {
			t.Errorf("cmd/%s is built but never copied into the runtime image, so it "+
				"is absent at runtime and nothing about the build says so", name)
		}
	}

	if found == 0 {
		t.Fatal("no commands found; this check has stopped working")
	}
}

// The import writes to the database and creates accounts in Supabase. Running
// it automatically would re-run it on any unrelated container restart --
// mid-shift, unattended -- which is exactly when nobody is watching the output
// that says what it decided to do.
func TestTheImportIsNotRunAutomatically(t *testing.T) {
	dockerfile, err := os.ReadFile(filepath.Join("..", "..", "Dockerfile"))
	if err != nil {
		t.Fatalf("read Dockerfile: %v", err)
	}

	for _, line := range strings.Split(string(dockerfile), "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "CMD") || strings.HasPrefix(trimmed, "ENTRYPOINT") {
			if strings.Contains(trimmed, "import-identities") {
				t.Errorf("the container runs the identity import on startup: %s", trimmed)
			}
		}
	}
}
